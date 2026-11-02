import { conflict, notFound, unprocessable, UniqueViolation } from '../lib/errors.js'
import { istDate, istDayStartUtc, istMonthToUtc, minutesBetween, nowIso, toIso } from '../lib/time.js'
import { notify as defaultNotify } from '../lib/notify.js'
import { assertApprover, categoryFields, resolveExpectedReturn, toMovementDto } from './movementService.js'
import { activeAdminsInOrder } from './staffService.js'

// A rejection stays on the staff member's screen for this long, so they see the answer.
const SHOW_REJECTION_MIN = 60

// What the staff home screen shows. The most recent of "returned" and "rejected" wins, since
// the person may have been turned down after an earlier outing, or the other way round.
export function homeState({ openMovement, request, recentReturn }) {
  if (openMovement) return 'OUT'
  if (request?.status === 'pending') return 'PENDING'
  const rejectedAt = request?.status === 'rejected' ? request.decidedAt : null
  const returnedAt = recentReturn?.timeIn ?? null
  if (rejectedAt && (!returnedAt || rejectedAt > returnedAt)) return 'REJECTED'
  if (returnedAt) return 'RETURNED'
  return 'IDLE'
}

// One line in the staff "Today" panel.
const STATUS_OF_MOVEMENT = (m) => (m.voided ? 'cancelled' : m.timeIn ? 'returned' : 'out')

export function toRequestDto(row) {
  return {
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name,
    purpose: row.purpose,
    place: row.place,
    requestedFrom: row.requested_from,
    requestedFromName: row.requested_from_name,
    status: row.status,
    decidedByName: row.decided_by_name ?? null,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    movementId: row.movement_id,
    createdAt: row.created_at,
    category: row.category ?? null,
    categoryOther: row.category_other ?? null,
    expectedReturnAt: row.expected_return_at ?? null,
    expectedMinutes: row.expected_minutes ?? null
  }
}

// Staff ask for permission in the app; an admin's approval is what starts the Time Out.
export function createRequestService({ requestRepo, movementRepo, staffRepo, settingsService, admins, now = nowIso, notify = defaultNotify }) {
  function assertPending(row) {
    if (row.status !== 'pending') throw conflict('REQUEST_DECIDED', `This request has already been ${row.status}.`)
  }

  async function findPending(id) {
    const row = await requestRepo.findById(id)
    if (!row) throw notFound('Request not found.')
    assertPending(row)
    return row
  }

  return {
    // The request to show on the staff member's home screen, if any.
    async currentFor(user) {
      const row = await requestRepo.findLatestByStaff(user.id)
      if (!row) return null
      if (row.status === 'pending') return toRequestDto(row)
      if (row.status === 'rejected' && minutesBetween(row.decided_at, now()) < SHOW_REJECTION_MIN) return toRequestDto(row)
      return null
    },

    async create(user, { purpose, place, requestedFrom, category, categoryOther, expectedMinutes, expectedReturnAt }) {
      const { timeLimitMin } = await settingsService.get()
      if (await movementRepo.findOpenByStaff(user.id, timeLimitMin)) {
        throw conflict('ALREADY_OUT', 'You are already out. Record your Time In before asking again.')
      }
      // Staff don't pick an admin: the request goes to the admins, addressed to the first configured one.
      let approverId = requestedFrom
      if (approverId) {
        await assertApprover(staffRepo, admins, approverId)
      } else {
        const [first] = await activeAdminsInOrder(staffRepo, admins)
        if (!first) throw unprocessable('NO_ADMIN', 'No admin is available yet. An admin needs to sign in once first.')
        approverId = first.id
      }

      const at = now()
      // A duration is stored as minutes too, so it can be counted again from the approval.
      const expected = resolveExpectedReturn({ expectedMinutes, expectedReturnAt }, at)

      let row
      try {
        row = await requestRepo.create({
          staffId: user.id, purpose, place: place ?? null, requestedFrom: approverId, createdAt: at,
          ...categoryFields({ category, categoryOther }), expectedReturnAt: expected, expectedMinutes: expectedMinutes ?? null
        })
      } catch (err) {
        if (err instanceof UniqueViolation) {
          throw conflict('REQUEST_PENDING', 'You already have a request waiting for an answer.')
        }
        throw err
      }
      await notify({ type: 'permission_requested', requestIds: [row.id] })
      return toRequestDto(row)
    },

    async cancel(user, id) {
      const row = await requestRepo.findById(id)
      if (!row || row.staff_id !== user.id) throw notFound('Request not found.')
      assertPending(row)
      const changed = await requestRepo.close(id, { status: 'cancelled', decidedBy: user.id, at: now(), note: null })
      if (changed === 0) throw conflict('REQUEST_DECIDED', 'This request has already been answered.')
      return toRequestDto(await requestRepo.findById(id))
    },

    async listPending() {
      return (await requestRepo.listPending()).map(toRequestDto)
    },

    // Any active admin may approve, not only the one asked. Time Out is the moment of approval.
    async approve(admin, id) {
      const request = await findPending(id)
      const at = now()
      // "30 min" means 30 minutes from leaving; a clock time ("back by 3 PM") stays as asked.
      const expectedReturnAt = request.expected_minutes
        ? toIso(Date.parse(at) + request.expected_minutes * 60000)
        : request.expected_return_at
      let changed
      try {
        changed = await requestRepo.approve(id, { decidedBy: admin.id, at, expectedReturnAt })
      } catch (err) {
        if (err instanceof UniqueViolation) {
          throw conflict('ALREADY_OUT', 'This person already has an open movement.')
        }
        throw err
      }
      if (changed === 0) throw conflict('REQUEST_DECIDED', 'This request has already been answered.')
      return toRequestDto(await requestRepo.findById(id))
    },

    async reject(admin, id, { note }) {
      await findPending(id)
      const changed = await requestRepo.close(id, { status: 'rejected', decidedBy: admin.id, at: now(), note: note ?? null })
      if (changed === 0) throw conflict('REQUEST_DECIDED', 'This request has already been answered.')
      return toRequestDto(await requestRepo.findById(id))
    },

    // Cron, at office close.
    async cancelAllPending() {
      return requestRepo.cancelAllPending(now())
    },

    async lastStatusChange(user) {
      return requestRepo.lastStatusChange(user.id)
    },

    // The staff "Today" panel: today's outings plus requests that never became one
    // (pending or rejected), newest first, and this month's totals.
    async myDay(user) {
      const at = now()
      const today = istDate(at)
      const { timeLimitMin } = await settingsService.get()
      const [movements, requests, month] = await Promise.all([
        movementRepo.listByStaffSince(user.id, istDayStartUtc(today), timeLimitMin),
        requestRepo.listByStaffSince(user.id, istDayStartUtc(today)),
        movementRepo.staffTotals(user.id, istMonthToUtc(today.slice(0, 7)))
      ])

      const items = [
        ...movements.map(toMovementDto).map((m) => ({
          key: `m${m.id}`, status: STATUS_OF_MOVEMENT(m), at: m.timeOut,
          purpose: m.purpose, place: m.place, category: m.category, categoryOther: m.categoryOther,
          timeOut: m.timeOut, timeIn: m.timeIn, minutesAway: m.minutesAway, expectedReturnAt: m.expectedReturnAt
        })),
        ...requests.filter((r) => r.status === 'pending' || r.status === 'rejected').map(toRequestDto).map((r) => ({
          key: `r${r.id}`, status: r.status, at: r.createdAt,
          purpose: r.purpose, place: r.place, category: r.category, categoryOther: r.categoryOther,
          timeOut: null, timeIn: null, minutesAway: null, expectedReturnAt: r.expectedReturnAt, decisionNote: r.decisionNote
        }))
      ].sort((a, b) => (a.at < b.at ? 1 : -1))

      return { items, month: { outings: month.outings, totalMinutes: month.total_minutes } }
    }
  }
}
