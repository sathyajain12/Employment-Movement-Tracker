import { beforeEach, describe, expect, it } from 'vitest'
import { UniqueViolation } from '../src/lib/errors.js'
import { createAuditRepo } from '../src/repo/auditRepo.js'
import { createMovementRepo } from '../src/repo/movementRepo.js'
import { toRegisterRow } from '../src/services/reportService.js'
import { createTestD1 } from './sqliteD1.js'

// Runs the real SQL against the real migration, so the derived columns are tested where they live.
let db
let repo

beforeEach(() => {
  db = createTestD1()
  db.sqlite.exec(`INSERT INTO staff (id, name, email, role) VALUES
    (1, 'Boss', 'boss@example.com', 'admin'), (2, 'Asha', 'asha@example.com', 'staff')`)
  repo = createMovementRepo(db, createAuditRepo(db))
})

const addMovement = async (timeOut, timeIn) => {
  const m = await repo.create({ staffId: 2, timeOut, purpose: 'Bank', place: null, permissionBy: 1 }, 60)
  if (timeIn) await repo.setTimeIn(m.id, timeIn)
  return m.id
}

describe('derived columns in SQL', () => {
  it.each([
    ['2026-10-31T05:59:00Z', 59, 'Y'],
    ['2026-10-31T06:00:00Z', 60, 'Y'],
    ['2026-10-31T06:00:59Z', 60, 'Y'],
    ['2026-10-31T06:01:00Z', 61, 'N']
  ])('Time In %s gives %i minutes, within limit %s', async (timeIn, minutes, within) => {
    const id = await addMovement('2026-10-31T05:00:00Z', timeIn)
    expect(await repo.findById(id, 60)).toMatchObject({ minutes_away: minutes, within_limit: within })
  })

  it('leaves minutes and Y/N empty while out', async () => {
    const id = await addMovement('2026-10-31T05:00:00Z')
    expect(await repo.findById(id, 60)).toMatchObject({ minutes_away: null, within_limit: null })
  })
})

describe('constraints', () => {
  it('turns the one-open-per-staff index violation into UniqueViolation', async () => {
    await addMovement('2026-10-31T05:00:00Z')
    await expect(addMovement('2026-10-31T05:10:00Z')).rejects.toBeInstanceOf(UniqueViolation)
  })

  it('writes the change and its audit rows atomically', async () => {
    const id = await addMovement('2026-10-31T05:00:00Z', '2026-10-31T05:30:00Z')
    const audit = { movementId: id, oldValue: 'Bank', newValue: 'Changed', reason: 'r', changedAt: '2026-10-31T06:00:00Z' }
    // The second audit row references a missing staff member, so the whole batch must roll back.
    await expect(repo.updateWithAudit(id, { purpose: 'Changed' }, [
      { ...audit, field: 'purpose', changedBy: 1 },
      { ...audit, field: 'place', changedBy: 999 }
    ])).rejects.toThrow(/FOREIGN KEY/)
    expect((await repo.findById(id, 60)).purpose).toBe('Bank')
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM movement_audit').get().n).toBe(0)

    await repo.updateWithAudit(id, { purpose: 'Changed' }, [{ ...audit, field: 'purpose', changedBy: 1 }])
    expect((await repo.findById(id, 60)).purpose).toBe('Changed')
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM movement_audit').get().n).toBe(1)
  })
})

describe('register', () => {
  it('numbers rows by Time Out within the IST date range and formats the paper columns', async () => {
    await addMovement('2026-10-31T09:00:00Z', '2026-10-31T09:45:00Z')
    await addMovement('2026-10-31T04:30:00Z', '2026-10-31T05:40:00Z')
    await addMovement('2026-10-30T18:00:00Z', '2026-10-30T18:10:00Z') // 30 Oct 23:30 IST: outside
    const rows = await repo.register({ start: '2026-10-30T18:30:00Z', end: '2026-10-31T18:30:00Z', limitMin: 60 })
    expect(rows.map(toRegisterRow)).toEqual([
      [1, '31-10-2026', 'Asha', '10:00 AM', 'Bank', 'Boss', '11:10 AM', 70, 'N', ''],
      [2, '31-10-2026', 'Asha', '02:30 PM', 'Bank', 'Boss', '03:15 PM', 45, 'Y', '']
    ])
  })
})
