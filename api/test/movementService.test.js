import { describe, expect, it } from 'vitest'
import {
  CANCEL_WINDOW_MIN, REASON_ADMIN_RETURN, REASON_SELF_CANCEL, REMARK_EXCEEDED, REMARK_NOT_RECORDED
} from '../src/services/movementService.js'
import { asha, boss, ravi, setup } from './fakes.js'

const stepOut = (service, user = asha, extra = {}) =>
  service.timeOut(user, { purpose: 'Bank', place: 'SBI', permissionBy: boss.id, ...extra })

describe('one open movement per staff member', () => {
  it('rejects a second Time Out with 409', async () => {
    const { service } = setup()
    await stepOut(service)
    await expect(stepOut(service)).rejects.toMatchObject({ status: 409, code: 'ALREADY_OUT' })
  })

  it('maps the unique-index violation from a racing request to the same 409', async () => {
    const { service, movementRepo } = setup()
    movementRepo.findOpenByStaff = async () => null // simulate the race slipping past the pre-check
    await stepOut(service)
    await expect(stepOut(service)).rejects.toMatchObject({ status: 409, code: 'ALREADY_OUT' })
  })

  it('allows stepping out again after returning', async () => {
    const { service, clock } = setup()
    const first = await stepOut(service)
    clock.advanceMinutes(5)
    await service.recordReturn(asha, first.id)
    clock.advanceMinutes(5)
    await expect(stepOut(service)).resolves.toMatchObject({ staffId: asha.id })
  })
})

describe('Time Out uses the server clock and a valid approver', () => {
  it('stamps time_out from the server clock', async () => {
    const { service } = setup({ now: '2026-10-31T05:00:00Z' })
    const m = await stepOut(service, asha, { timeOut: '2020-01-01T00:00:00Z' })
    expect(m.timeOut).toBe('2026-10-31T05:00:00Z')
  })

  it('rejects an approver who is not an admin', async () => {
    const { service } = setup()
    await expect(stepOut(service, asha, { permissionBy: ravi.id }))
      .rejects.toMatchObject({ status: 422, code: 'INVALID_APPROVER' })
  })

  it('rejects an approver whose role column says admin but who is no longer in ADMIN_EMAILS', async () => {
    const { service } = setup()
    await expect(stepOut(service, asha, { permissionBy: 4 }))
      .rejects.toMatchObject({ code: 'INVALID_APPROVER' })
  })

  it('rejects an inactive admin as approver', async () => {
    const { service, staffRepo } = setup()
    staffRepo.rows[0].active = 0
    await expect(stepOut(service)).rejects.toMatchObject({ code: 'INVALID_APPROVER' })
  })
})

describe('Time In ordering', () => {
  it('rejects a Time In that is not after Time Out', async () => {
    const { service } = setup()
    const m = await stepOut(service)
    // Same second as Time Out.
    await expect(service.recordReturn(asha, m.id)).rejects.toMatchObject({ status: 422, code: 'INVALID_TIME_ORDER' })
  })

  it('records Time In from the server clock', async () => {
    const { service, clock } = setup({ now: '2026-10-31T05:00:00Z' })
    const m = await stepOut(service)
    clock.advanceMinutes(25)
    const back = await service.recordReturn(asha, m.id)
    expect(back.timeIn).toBe('2026-10-31T05:25:00Z')
    expect(back.minutesAway).toBe(25)
  })

  it('rejects a second Time In', async () => {
    const { service, clock } = setup()
    const m = await stepOut(service)
    clock.advanceMinutes(1)
    await service.recordReturn(asha, m.id)
    await expect(service.recordReturn(asha, m.id)).rejects.toMatchObject({ status: 409, code: 'ALREADY_RETURNED' })
  })

  it('rejects an admin correction with Time In before Time Out', async () => {
    const { service, clock } = setup({ now: '2026-10-31T05:00:00Z' })
    const m = await stepOut(service)
    clock.advanceMinutes(30)
    await expect(service.correct(boss, m.id, { timeIn: '2026-10-31T04:59:00Z', reason: 'Fix' }))
      .rejects.toMatchObject({ status: 422, code: 'INVALID_TIME_ORDER' })
  })
})

describe('60-minute limit boundary', () => {
  it.each([
    [59, 'Y'],
    [60, 'Y'],
    [61, 'N']
  ])('%i minutes away is within limit = %s', async (minutes, expected) => {
    const { service, clock } = setup()
    const m = await stepOut(service)
    clock.advanceMinutes(minutes)
    const back = await service.recordReturn(asha, m.id)
    expect(back.minutesAway).toBe(minutes)
    expect(back.withinLimit).toBe(expected)
  })

  it('marks a live movement over the limit only after 60 minutes', async () => {
    const { service, clock } = setup()
    await stepOut(service)
    clock.advanceMinutes(60)
    expect((await service.openFor(asha)).overLimit).toBe(false)
    clock.advanceMinutes(1)
    expect((await service.openFor(asha)).overLimit).toBe(true)
  })
})

describe('row ownership', () => {
  it('stops staff from recording Time In on another person\'s movement', async () => {
    const { service, clock } = setup()
    const m = await stepOut(service, asha)
    clock.advanceMinutes(5)
    await expect(service.recordReturn(ravi, m.id)).rejects.toMatchObject({ status: 404 })
  })

  it('stops staff from editing another person\'s details', async () => {
    const { service } = setup()
    const m = await stepOut(service, asha)
    await expect(service.editDetails(ravi, m.id, { purpose: 'Hacked' })).rejects.toMatchObject({ status: 404 })
  })

  it('lists only the caller\'s own movements', async () => {
    const { service } = setup()
    await stepOut(service, asha)
    await stepOut(service, ravi)
    const mine = await service.listMine(ravi, 1)
    expect(mine.items).toHaveLength(1)
    expect(mine.items[0].staffId).toBe(ravi.id)
  })
})

describe('editing details', () => {
  it('is allowed while out and pending', async () => {
    const { service } = setup()
    const m = await stepOut(service)
    const edited = await service.editDetails(asha, m.id, { purpose: 'Post office', place: null })
    expect(edited).toMatchObject({ purpose: 'Post office', place: null })
  })

  it('is refused after Time In', async () => {
    const { service, clock } = setup()
    const m = await stepOut(service)
    clock.advanceMinutes(10)
    await service.recordReturn(asha, m.id)
    await expect(service.editDetails(asha, m.id, { purpose: 'Changed' })).rejects.toMatchObject({ code: 'NOT_EDITABLE' })
  })
})

describe('admin corrections', () => {
  it('writes one audit row per changed field and resets review to pending', async () => {
    const { service, movementRepo, clock } = setup({ now: '2026-10-31T05:00:00Z' })
    const m = await stepOut(service)
    clock.advanceMinutes(70)
    await service.recordReturn(asha, m.id)
    await service.review(boss, m.id, { review: 'confirmed' })

    const corrected = await service.correct(boss, m.id, {
      timeIn: '2026-10-31T05:45:00Z',
      purpose: 'Bank', // unchanged: no audit row
      place: 'SBI Main Branch',
      reason: 'Staff forgot to tap I am back'
    })

    expect(movementRepo.audit).toHaveLength(2)
    expect(movementRepo.audit.map((a) => a.field).sort()).toEqual(['place', 'time_in'])
    expect(movementRepo.audit.find((a) => a.field === 'time_in')).toMatchObject({
      oldValue: '2026-10-31T06:10:00Z',
      newValue: '2026-10-31T05:45:00Z',
      reason: 'Staff forgot to tap I am back',
      changedBy: boss.id
    })
    expect(corrected).toMatchObject({ review: 'pending', reviewedAt: null, minutesAway: 45, withinLimit: 'Y' })
  })

  it('records approver changes by name', async () => {
    const { service, movementRepo, staffRepo, clock } = setup()
    staffRepo.rows.push({ id: 5, name: 'Deputy', email: 'deputy@example.com', role: 'admin', active: 1 })
    const m = await stepOut(service)
    clock.advanceMinutes(5)
    await service.correct(boss, m.id, { permissionBy: 5, reason: 'Deputy gave permission' })
    expect(movementRepo.audit[0]).toMatchObject({ field: 'permission_by', oldValue: 'Boss', newValue: 'Deputy' })
  })

  it('refuses a correction that changes nothing', async () => {
    const { service } = setup()
    const m = await stepOut(service)
    await expect(service.correct(boss, m.id, { purpose: 'Bank', reason: 'x' }))
      .rejects.toMatchObject({ status: 422, code: 'NO_CHANGES' })
  })
})

describe('review', () => {
  it('appends the review remark without overwriting existing remarks', async () => {
    const { service, movementRepo, clock } = setup()
    const m = await stepOut(service)
    movementRepo.rows[0].remarks = 'Went with family'
    clock.advanceMinutes(80)
    await service.recordReturn(asha, m.id)
    const reviewed = await service.review(boss, m.id, { review: 'flagged', remark: 'Too long' })
    expect(reviewed.remarks).toBe('Went with family; Too long')
    expect(reviewed.review).toBe('flagged')
    expect(reviewed.reviewedAt).not.toBeNull()
  })

  it('refuses to confirm an entry without Time In', async () => {
    const { service } = setup()
    const m = await stepOut(service)
    await expect(service.review(boss, m.id, { review: 'confirmed' })).rejects.toMatchObject({ code: 'NO_TIME_IN' })
  })

  it('bulk-confirms several entries', async () => {
    const { service, movementRepo, clock } = setup()
    const a = await stepOut(service, asha)
    const r = await stepOut(service, ravi)
    clock.advanceMinutes(10)
    await service.recordReturn(asha, a.id)
    await service.recordReturn(ravi, r.id)
    await expect(service.bulkReview(boss, [a.id, r.id], 'confirmed')).resolves.toEqual({ updated: 2 })
    expect(movementRepo.rows.every((row) => row.review === 'confirmed')).toBe(true)
  })
})

describe('scheduled jobs', () => {
  it('appends "Exceeded time limit" once, after limit + grace', async () => {
    const { service, movementRepo, clock, notifications } = setup()
    await stepOut(service)
    clock.advanceMinutes(70)
    expect(await service.markOverdue()).toEqual([])
    clock.advanceMinutes(1)
    expect(await service.markOverdue()).toEqual([1])
    clock.advanceMinutes(10)
    expect(await service.markOverdue()).toEqual([])
    expect(movementRepo.rows[0].remarks).toBe(REMARK_EXCEEDED)
    expect(notifications).toEqual([{ type: 'overdue', movementIds: [1] }])
  })

  it('closes open movements at end of day without guessing a Time In', async () => {
    const { service, movementRepo, clock } = setup({ now: '2026-10-31T10:00:00Z' }) // 15:30 IST
    const m = await stepOut(service)
    movementRepo.rows[0].remarks = 'Doctor'
    clock.set('2026-10-31T12:00:00Z') // 17:30 IST
    expect(await service.closeEndOfDay()).toEqual([m.id])
    expect(await service.closeEndOfDay()).toEqual([])
    expect(movementRepo.rows[0]).toMatchObject({ time_in: null, remarks: `Doctor; ${REMARK_NOT_RECORDED}` })
  })

  it('stops the owner recording Time In after the end-of-day close', async () => {
    const { service, clock } = setup({ now: '2026-10-31T10:00:00Z' })
    const m = await stepOut(service)
    clock.set('2026-10-31T12:00:00Z')
    await service.closeEndOfDay()
    clock.advanceMinutes(5)
    await expect(service.recordReturn(asha, m.id)).rejects.toMatchObject({ code: 'CLOSED_AT_END_OF_DAY' })
  })
})

describe('cancelling and voiding', () => {
  it('lets the owner cancel within the window, telling the admins, and frees them to step out again', async () => {
    const { service, clock, notifications } = setup()
    const m = await stepOut(service)
    clock.advanceMinutes(4)
    const voided = await service.void(asha, m.id, {})
    expect(voided).toMatchObject({ voided: true, voidReason: REASON_SELF_CANCEL })
    expect(notifications).toEqual([{ type: 'movement_cancelled', movementIds: [m.id] }])
    expect(await service.openFor(asha)).toBeNull()
    await expect(stepOut(service)).resolves.toMatchObject({ staffId: asha.id })
  })

  it('refuses the owner once the window has passed', async () => {
    const { service, clock } = setup()
    const m = await stepOut(service)
    clock.advanceMinutes(CANCEL_WINDOW_MIN)
    await expect(service.void(asha, m.id, {})).rejects.toMatchObject({ status: 409, code: 'CANCEL_WINDOW_PASSED' })
  })

  it('hides other people\'s entries from staff', async () => {
    const { service } = setup()
    const m = await stepOut(service)
    await expect(service.void(ravi, m.id, {})).rejects.toMatchObject({ status: 404 })
  })

  it('lets an admin void any entry with a reason, and audits it', async () => {
    const { service, movementRepo, clock, notifications } = setup()
    const m = await stepOut(service)
    clock.advanceMinutes(30)
    await expect(service.void(boss, m.id, {})).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
    await service.void(boss, m.id, { reason: 'Duplicate entry' })
    expect(movementRepo.audit).toEqual([expect.objectContaining({ field: 'voided', reason: 'Duplicate entry', changedBy: boss.id })])
    expect(notifications).toEqual([])
    await expect(service.void(boss, m.id, { reason: 'again' })).rejects.toMatchObject({ code: 'VOIDED' })
    await expect(service.review(boss, m.id, { review: 'flagged' })).rejects.toMatchObject({ code: 'VOIDED' })
  })
})

describe('admin marks someone returned', () => {
  it('sets Time In now and audits who did it', async () => {
    const { service, movementRepo, clock } = setup({ now: '2026-10-31T05:00:00Z' })
    const m = await stepOut(service)
    clock.advanceMinutes(40)
    const back = await service.adminReturn(boss, m.id)
    expect(back).toMatchObject({ timeIn: '2026-10-31T05:40:00Z', minutesAway: 40, review: 'pending' })
    expect(movementRepo.audit).toEqual([expect.objectContaining({ field: 'time_in', reason: REASON_ADMIN_RETURN, changedBy: boss.id })])
    await expect(service.adminReturn(boss, m.id)).rejects.toMatchObject({ code: 'ALREADY_RETURNED' })
  })

  it('refuses after the end-of-day close, so nobody guesses the time', async () => {
    const { service, clock } = setup({ now: '2026-10-31T10:00:00Z' })
    const m = await stepOut(service)
    clock.set('2026-10-31T12:00:00Z')
    await service.closeEndOfDay()
    await expect(service.adminReturn(boss, m.id)).rejects.toMatchObject({ code: 'CLOSED_AT_END_OF_DAY' })
  })
})
