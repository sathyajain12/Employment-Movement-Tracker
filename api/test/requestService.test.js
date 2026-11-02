import { beforeEach, describe, expect, it } from 'vitest'
import { createAuditRepo } from '../src/repo/auditRepo.js'
import { createMovementRepo } from '../src/repo/movementRepo.js'
import { createRequestRepo } from '../src/repo/requestRepo.js'
import { createStaffRepo } from '../src/repo/staffRepo.js'
import { createMovementService } from '../src/services/movementService.js'
import { createRequestService, homeState } from '../src/services/requestService.js'
import { asha, boss, fakeAdmins, fakeClock, fakeSettings, ravi } from './fakes.js'
import { schemas } from '../src/lib/validate.js'
import { createTestD1 } from './sqliteD1.js'

// Runs the request flow on the real repositories and migrations, since approval is one SQL batch.
let db, requests, movements, clock, notifications

beforeEach(() => {
  db = createTestD1()
  db.sqlite.exec(`INSERT INTO staff (id, name, email, role) VALUES
    (1, 'Boss', 'boss@example.com', 'admin'), (2, 'Asha', 'asha@example.com', 'staff'),
    (3, 'Ravi', 'ravi@example.com', 'staff'), (5, 'Deputy', 'deputy@example.com', 'admin')`)
  const movementRepo = createMovementRepo(db, createAuditRepo(db))
  const deps = {
    movementRepo,
    staffRepo: createStaffRepo(db),
    settingsService: fakeSettings(),
    admins: fakeAdmins
  }
  clock = fakeClock('2026-11-02T04:00:00Z')
  notifications = []
  requests = createRequestService({
    ...deps, requestRepo: createRequestRepo(db), now: clock, notify: async (e) => { notifications.push(e) }
  })
  movements = createMovementService({ ...deps, auditRepo: createAuditRepo(db), now: clock, notify: async () => {} })
})

const ask = (user = asha, extra = {}) => requests.create(user, { purpose: 'Bank', place: 'SBI', requestedFrom: boss.id, ...extra })

describe('asking for permission', () => {
  it('creates a pending request, notifies, and shows it on the staff screen', async () => {
    const r = await ask()
    expect(r).toMatchObject({ status: 'pending', staffName: 'Asha', requestedFromName: 'Boss', purpose: 'Bank' })
    expect(notifications).toEqual([{ type: 'permission_requested', requestIds: [r.id] }])
    expect(await requests.currentFor(asha)).toMatchObject({ id: r.id, status: 'pending' })
    expect(await requests.listPending()).toHaveLength(1)
  })

  it('allows only one pending request per person', async () => {
    await ask()
    await expect(ask()).rejects.toMatchObject({ status: 409, code: 'REQUEST_PENDING' })
  })

  it('goes to the first configured admin when the staff member names nobody', async () => {
    const r = await requests.create(asha, { purpose: 'Bank' })
    expect(r).toMatchObject({ requestedFrom: boss.id, requestedFromName: 'Boss' })
  })

  it('must be asked of an active admin', async () => {
    await expect(ask(asha, { requestedFrom: ravi.id })).rejects.toMatchObject({ code: 'INVALID_APPROVER' })
  })
})

describe('approving', () => {
  it('starts the Time Out at approval, with the deciding admin as permission', async () => {
    const r = await ask()
    clock.advanceMinutes(3)
    const approved = await requests.approve({ id: 5 }, r.id) // the deputy, not the one asked
    expect(approved).toMatchObject({ status: 'approved', decidedByName: 'Deputy' })
    const open = await movements.openFor(asha)
    expect(open).toMatchObject({ id: approved.movementId, timeOut: '2026-11-02T04:03:00Z', permissionByName: 'Deputy', purpose: 'Bank', place: 'SBI' })
    expect(await requests.currentFor(asha)).toBeNull()
    expect(await requests.listPending()).toEqual([])
  })

  it('lets only one admin win', async () => {
    const r = await ask()
    await requests.approve(boss, r.id)
    await expect(requests.approve({ id: 5 }, r.id)).rejects.toMatchObject({ code: 'REQUEST_DECIDED' })
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM movements').get().n).toBe(1)
  })

  it('refuses a new request while the person is out', async () => {
    await requests.approve(boss, (await ask()).id)
    await expect(ask()).rejects.toMatchObject({ code: 'ALREADY_OUT' })
  })

  it('counts pending requests for the admin badge', async () => {
    await ask()
    await ask(ravi)
    expect((await movements.counts()).pendingRequests).toBe(2)
  })
})

describe('rejecting and withdrawing', () => {
  it('shows a rejection with its note for an hour, and creates no movement', async () => {
    const r = await ask()
    await requests.reject(boss, r.id, { note: 'Not now, meeting at 10' })
    expect(await requests.currentFor(asha)).toMatchObject({ status: 'rejected', decisionNote: 'Not now, meeting at 10', decidedByName: 'Boss' })
    clock.advanceMinutes(60)
    expect(await requests.currentFor(asha)).toBeNull()
    expect(await movements.openFor(asha)).toBeNull()
  })

  it('lets the owner withdraw while pending, then ask again', async () => {
    const r = await ask()
    await expect(requests.cancel(ravi, r.id)).rejects.toMatchObject({ status: 404 })
    expect(await requests.cancel(asha, r.id)).toMatchObject({ status: 'cancelled' })
    await expect(requests.approve(boss, r.id)).rejects.toMatchObject({ code: 'REQUEST_DECIDED' })
    await expect(ask()).resolves.toMatchObject({ status: 'pending' })
  })

  it('cancels everything unanswered at office close', async () => {
    const r = await ask()
    expect(await requests.cancelAllPending()).toEqual([r.id])
    expect(await requests.currentFor(asha)).toBeNull()
  })
})

describe('voided entries leave the register', () => {
  it('drops a voided entry from counts, search and Sl. No., and frees the open slot', async () => {
    const r = await ask()
    const { movementId } = await requests.approve(boss, r.id)
    expect((await movements.counts()).outNow).toBe(1)
    clock.advanceMinutes(2)
    await movements.void(asha, movementId, {})
    expect((await movements.counts()).outNow).toBe(0)
    expect((await movements.search({ page: 1 })).total).toBe(0)
    expect((await movements.search({ review: 'voided', page: 1 })).items).toEqual([expect.objectContaining({ id: movementId, voided: true })])
    await expect(ask()).resolves.toMatchObject({ status: 'pending' })
  })

  it('counts and lists today\'s staff cancellations for the admin, but not admin voids', async () => {
    const first = await requests.approve(boss, (await ask()).id)
    clock.advanceMinutes(1)
    await movements.void(asha, first.movementId, {})
    const second = await requests.approve(boss, (await ask(ravi)).id)
    clock.advanceMinutes(1)
    await movements.void(boss, second.movementId, { reason: 'Duplicate' })
    expect((await movements.counts()).cancelledToday).toBe(1)
    expect(await movements.cancelledToday()).toEqual([expect.objectContaining({ id: first.movementId, staffName: 'Asha' })])
  })
})

// Mirrors GET /api/me: what the staff home screen shows.
const home = async (user) => {
  const [openMovement, request, recentReturn] = await Promise.all([
    movements.openFor(user), requests.currentFor(user), movements.recentReturnFor(user)
  ])
  return { state: homeState({ openMovement, request, recentReturn }), openMovement, request, recentReturn }
}

describe('home screen state transitions', () => {
  it('IDLE → PENDING → OUT → RETURNED, with the expected return counted from approval', async () => {
    expect((await home(asha)).state).toBe('IDLE')

    const r = await ask(asha, { category: 'Bank', expectedMinutes: 30 })
    expect(r).toMatchObject({ category: 'Bank', expectedMinutes: 30, expectedReturnAt: '2026-11-02T04:30:00Z' })
    expect((await home(asha)).state).toBe('PENDING')

    clock.advanceMinutes(5) // the admin answers five minutes later
    await requests.approve(boss, r.id)
    const out = await home(asha)
    expect(out.state).toBe('OUT')
    expect(out.openMovement).toMatchObject({
      category: 'Bank', requestedAt: '2026-11-02T04:00:00Z', timeOut: '2026-11-02T04:05:00Z', expectedReturnAt: '2026-11-02T04:35:00Z'
    })

    clock.advanceMinutes(20)
    await movements.recordReturn(asha, out.openMovement.id)
    const back = await home(asha)
    expect(back.state).toBe('RETURNED')
    expect(back.recentReturn).toMatchObject({ minutesAway: 20 })

    clock.advanceMinutes(60)
    expect((await home(asha)).state).toBe('IDLE')
  })

  it('PENDING → CANCELLED goes back to IDLE', async () => {
    const r = await ask(asha, { expectedMinutes: 15 })
    await requests.cancel(asha, r.id)
    expect((await home(asha)).state).toBe('IDLE')
  })

  it('PENDING → REJECTED shows the reason, even after an earlier return', async () => {
    const first = await requests.approve(boss, (await ask(asha, { expectedMinutes: 15 })).id)
    clock.advanceMinutes(10)
    await movements.recordReturn(asha, first.movementId)
    clock.advanceMinutes(5)
    const r = await ask(asha, { expectedMinutes: 15 })
    await requests.reject(boss, r.id, { note: 'Audit visit today' })
    const view = await home(asha)
    expect(view.state).toBe('REJECTED')
    expect(view.request).toMatchObject({ decisionNote: 'Audit visit today' })
  })

  it('keeps a clock-time expected return as asked, and refuses one in the past', async () => {
    const r = await ask(asha, { expectedReturnAt: '2026-11-02T09:30:00Z' })
    clock.advanceMinutes(10)
    await requests.approve(boss, r.id)
    expect((await movements.openFor(asha)).expectedReturnAt).toBe('2026-11-02T09:30:00Z')
    await expect(ask(ravi, { expectedReturnAt: '2026-11-02T04:00:00Z' }))
      .rejects.toMatchObject({ code: 'INVALID_EXPECTED_RETURN' })
  })
})

describe('staff Today panel and places', () => {
  it('lists today\'s outings and unanswered or rejected requests, with month totals', async () => {
    const done = await requests.approve(boss, (await ask(asha, { place: 'SBI' })).id)
    clock.advanceMinutes(30)
    await movements.recordReturn(asha, done.movementId)
    const rejected = await ask(asha, { place: 'Post office' })
    await requests.reject(boss, rejected.id, { note: 'Later' })
    clock.advanceMinutes(1)
    await ask(asha, { place: 'sbi' })

    const day = await requests.myDay(asha)
    expect(day.items.map((i) => i.status)).toEqual(['pending', 'rejected', 'returned'])
    expect(day.month).toEqual({ outings: 1, totalMinutes: 30 })
    expect(await movements.recentPlaces(asha)).toEqual(['SBI'])
  })
})

describe('the Other category', () => {
  it('keeps the person\'s own words through approval, and drops them for other categories', async () => {
    const r = await ask(asha, { category: 'Other', categoryOther: 'Courier pickup', expectedMinutes: 15 })
    expect(r).toMatchObject({ category: 'Other', categoryOther: 'Courier pickup' })
    await requests.approve(boss, r.id)
    expect(await movements.openFor(asha)).toMatchObject({ category: 'Other', categoryOther: 'Courier pickup' })
    expect(await ask(ravi, { category: 'Bank', categoryOther: 'ignored' })).toMatchObject({ category: 'Bank', categoryOther: null })
  })

  it('must be specified, and only the remaining categories are accepted', () => {
    const base = { purpose: 'x', expectedMinutes: 15 }
    expect(schemas.permissionRequest.safeParse({ ...base, category: 'Other' }).success).toBe(false)
    expect(schemas.permissionRequest.safeParse({ ...base, category: 'Other', categoryOther: 'Courier' }).success).toBe(true)
    expect(schemas.permissionRequest.safeParse({ ...base, category: 'Lunch' }).success).toBe(false)
  })
})
