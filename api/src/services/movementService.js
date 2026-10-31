import { conflict, notFound, unprocessable, UniqueViolation } from '../lib/errors.js'
import { istDate, istDayStartUtc, istDateTimeUtc, istRangeToUtc, minutesBetween, nowIso } from '../lib/time.js'
import { notify as defaultNotify } from '../lib/notify.js'

export const REMARK_EXCEEDED = 'Exceeded time limit'
export const REMARK_NOT_RECORDED = 'Time In not recorded'

const MINE_PAGE_SIZE = 20
const SEARCH_PAGE_SIZE = 50

const remarkParts = (remarks) => (remarks ? remarks.split('; ') : [])
export const hasRemark = (remarks, text) => remarkParts(remarks).includes(text)
export const appendRemark = (remarks, text) => (remarks ? `${remarks}; ${text}` : text)

// API field -> column, for admin corrections.
const CORRECTABLE = {
  timeOut: 'time_out',
  timeIn: 'time_in',
  purpose: 'purpose',
  place: 'place',
  permissionBy: 'permission_by',
  remarks: 'remarks'
}

export function toMovementDto(row) {
  return {
    id: row.id,
    slNo: row.sl_no ?? undefined,
    staffId: row.staff_id,
    staffName: row.staff_name,
    timeOut: row.time_out,
    purpose: row.purpose,
    place: row.place,
    permissionBy: row.permission_by,
    permissionByName: row.permission_by_name,
    timeIn: row.time_in,
    minutesAway: row.minutes_away,
    withinLimit: row.within_limit,
    review: row.review,
    reviewedAt: row.reviewed_at,
    remarks: row.remarks,
    closedAtEndOfDay: hasRemark(row.remarks, REMARK_NOT_RECORDED),
    updatedAt: row.updated_at
  }
}

export function createMovementService({ movementRepo, staffRepo, auditRepo, settingsService, admins, now = nowIso, notify = defaultNotify }) {
  const todayStart = (at) => istDayStartUtc(istDate(at))

  async function limitMin() {
    return (await settingsService.get()).timeLimitMin
  }

  async function assertApprover(staffId) {
    const approver = await staffRepo.findById(staffId)
    if (!approver || !approver.active || !admins.isAdmin(approver.email)) {
      throw unprocessable('INVALID_APPROVER', 'Permission must be granted by an active admin.')
    }
    return approver
  }

  // Staff only ever see their own rows; anyone else's id looks like it doesn't exist.
  async function findOwned(user, id, limit) {
    const row = await movementRepo.findById(id, limit)
    if (!row || row.staff_id !== user.id) throw notFound('Movement not found.')
    return row
  }

  async function findOrThrow(id, limit) {
    const row = await movementRepo.findById(id, limit)
    if (!row) throw notFound('Movement not found.')
    return row
  }

  // A forgotten Time In can't be filled in by the owner on a later day or after the
  // end-of-day close; an admin has to correct it so nobody guesses a return time.
  function ownerCanReturn(row, at) {
    return !hasRemark(row.remarks, REMARK_NOT_RECORDED) && istDate(row.time_out) === istDate(at)
  }

  const withLive = (dto, at, limit) => {
    const minutesSoFar = minutesBetween(dto.timeOut, at)
    return { ...dto, minutesSoFar, overLimit: minutesSoFar > limit }
  }

  return {
    async openFor(user) {
      const limit = await limitMin()
      const row = await movementRepo.findOpenByStaff(user.id, limit)
      if (!row) return null
      const at = now()
      return { ...withLive(toMovementDto(row), at, limit), canReturn: ownerCanReturn(row, at) }
    },

    async timeOut(user, { purpose, place, permissionBy }) {
      const limit = await limitMin()
      if (await movementRepo.findOpenByStaff(user.id, limit)) {
        throw conflict('ALREADY_OUT', 'You are already out. Record your Time In before stepping out again.')
      }
      await assertApprover(permissionBy)

      try {
        const row = await movementRepo.create(
          { staffId: user.id, timeOut: now(), purpose, place: place ?? null, permissionBy },
          limit
        )
        return toMovementDto(row)
      } catch (err) {
        // The partial unique index catches a double-tap that slipped past the check above.
        if (err instanceof UniqueViolation) {
          throw conflict('ALREADY_OUT', 'You are already out. Record your Time In before stepping out again.')
        }
        throw err
      }
    },

    async recordReturn(user, id) {
      const limit = await limitMin()
      const row = await findOwned(user, id, limit)
      if (row.time_in) throw conflict('ALREADY_RETURNED', 'Time In is already recorded for this entry.')

      const at = now()
      if (!ownerCanReturn(row, at)) {
        throw conflict('CLOSED_AT_END_OF_DAY',
          'This entry was closed at end of day without a Time In. Ask the admin to correct it.')
      }
      if (at <= row.time_out) throw unprocessable('INVALID_TIME_ORDER', 'Time In must be after Time Out.')

      const changed = await movementRepo.setTimeIn(id, at)
      if (changed === 0) throw conflict('ALREADY_RETURNED', 'Time In is already recorded for this entry.')
      return toMovementDto(await movementRepo.findById(id, limit))
    },

    async editDetails(user, id, { purpose, place }) {
      const limit = await limitMin()
      const row = await findOwned(user, id, limit)
      if (row.time_in || row.review !== 'pending') {
        throw conflict('NOT_EDITABLE', 'Details can only be changed while you are still out and the entry is unreviewed.')
      }
      const changed = await movementRepo.updateDetailsWhileOpen(id, { purpose, place: place ?? null }, now())
      if (changed === 0) throw conflict('NOT_EDITABLE', 'This entry can no longer be edited.')
      return toMovementDto(await movementRepo.findById(id, limit))
    },

    async listMine(user, page) {
      const limit = await limitMin()
      const { rows, total } = await movementRepo.listByStaff(user.id, {
        limitMin: limit,
        limit: MINE_PAGE_SIZE,
        offset: (page - 1) * MINE_PAGE_SIZE
      })
      return { items: rows.map(toMovementDto), page, pageSize: MINE_PAGE_SIZE, total }
    },

    async listActive() {
      const settings = await settingsService.get()
      const at = now()
      const rows = await movementRepo.listCurrentlyOut({
        limitMin: settings.timeLimitMin,
        todayStart: todayStart(at),
        closedRemark: REMARK_NOT_RECORDED
      })
      return {
        timeLimitMin: settings.timeLimitMin,
        serverTime: at,
        items: rows.map((row) => withLive(toMovementDto(row), at, settings.timeLimitMin))
      }
    },

    async search({ from, to, staffId, review, withinLimit, queue, page }) {
      const limit = await limitMin()
      const range = {}
      if (from) range.start = istDayStartUtc(from)
      if (to) range.end = istRangeToUtc(to, to).end

      const { rows, total } = await movementRepo.search(
        { ...range, staffId, review, withinLimit, queue },
        {
          limitMin: limit,
          limit: SEARCH_PAGE_SIZE,
          offset: (page - 1) * SEARCH_PAGE_SIZE,
          todayStart: todayStart(now()),
          closedRemark: REMARK_NOT_RECORDED
        }
      )
      return { items: rows.map(toMovementDto), page, pageSize: SEARCH_PAGE_SIZE, total, timeLimitMin: limit }
    },

    async review(admin, id, { review, remark }) {
      const limit = await limitMin()
      const row = await findOrThrow(id, limit)
      if (review === 'confirmed' && !row.time_in) {
        throw unprocessable('NO_TIME_IN', 'Correct the Time In before confirming this entry.')
      }
      await movementRepo.update(id, {
        review,
        reviewed_at: now(),
        remarks: remark ? appendRemark(row.remarks, remark) : row.remarks
      })
      return toMovementDto(await movementRepo.findById(id, limit))
    },

    async bulkReview(admin, ids, review) {
      const limit = await limitMin()
      const unique = [...new Set(ids)]
      const rows = await Promise.all(unique.map((id) => findOrThrow(id, limit)))
      if (review === 'confirmed' && rows.some((row) => !row.time_in)) {
        throw unprocessable('NO_TIME_IN', 'Some selected entries have no Time In. Correct them before confirming.')
      }
      const at = now()
      await movementRepo.updateMany(unique.map((id) => ({ id, fields: { review, reviewed_at: at } })))
      return { updated: unique.length }
    },

    // Writes one audit row per changed field, atomically with the change, and sends the entry back for review.
    async correct(admin, id, input) {
      const limit = await limitMin()
      const row = await findOrThrow(id, limit)
      const at = now()

      const changes = {}
      for (const [key, column] of Object.entries(CORRECTABLE)) {
        if (input[key] !== undefined && input[key] !== row[column]) changes[column] = input[key]
      }
      if (Object.keys(changes).length === 0) {
        throw unprocessable('NO_CHANGES', 'Nothing was changed.')
      }

      const timeOut = changes.time_out ?? row.time_out
      const timeIn = changes.time_in ?? row.time_in
      if (timeOut > at || (timeIn && timeIn > at)) {
        throw unprocessable('FUTURE_TIME', 'Times cannot be in the future.')
      }
      if (timeIn && timeIn <= timeOut) {
        throw unprocessable('INVALID_TIME_ORDER', 'Time In must be after Time Out.')
      }

      const display = { ...changes }
      const previous = {}
      if (changes.permission_by !== undefined) {
        const approver = await assertApprover(changes.permission_by)
        display.permission_by = approver.name
        previous.permission_by = row.permission_by_name
      }

      const auditRows = Object.keys(changes).map((column) => ({
        movementId: id,
        field: column,
        oldValue: previous[column] ?? row[column] ?? null,
        newValue: display[column] ?? null,
        reason: input.reason,
        changedBy: admin.id,
        changedAt: at
      }))

      await movementRepo.updateWithAudit(
        id,
        { ...changes, review: 'pending', reviewed_at: null, updated_at: at },
        auditRows
      )
      return toMovementDto(await movementRepo.findById(id, limit))
    },

    async audit(id) {
      await findOrThrow(id, await limitMin())
      const rows = await auditRepo.listForMovement(id)
      return rows.map((row) => ({
        id: row.id,
        field: row.field,
        oldValue: row.old_value,
        newValue: row.new_value,
        reason: row.reason,
        changedBy: row.changed_by_name,
        changedAt: row.changed_at
      }))
    },

    async counts() {
      const settings = await settingsService.get()
      const at = now()
      const row = await movementRepo.counts({
        now: at,
        todayStart: todayStart(at),
        closedRemark: REMARK_NOT_RECORDED,
        overdueAfterMin: settings.timeLimitMin + settings.graceMin
      })
      return { pendingReview: row.pending_review, outNow: row.out_now, overdueNow: row.overdue_now }
    },

    // Cron: flag open movements past limit + grace. Idempotent.
    async markOverdue() {
      const settings = await settingsService.get()
      const at = now()
      const threshold = settings.timeLimitMin + settings.graceMin
      const targets = (await movementRepo.listOpen(settings.timeLimitMin)).filter((row) =>
        minutesBetween(row.time_out, at) > threshold &&
        !hasRemark(row.remarks, REMARK_EXCEEDED) &&
        !hasRemark(row.remarks, REMARK_NOT_RECORDED)
      )
      await movementRepo.updateMany(targets.map((row) => ({
        id: row.id,
        fields: { remarks: appendRemark(row.remarks, REMARK_EXCEEDED), updated_at: at }
      })))
      const ids = targets.map((row) => row.id)
      if (ids.length) await notify({ type: 'overdue', movementIds: ids })
      return ids
    },

    // Cron: everything still open that started before today's office close gets a remark.
    // time_in stays NULL; the admin resolves these from the review queue.
    async closeEndOfDay() {
      const settings = await settingsService.get()
      const at = now()
      const cutoff = istDateTimeUtc(istDate(at), settings.officeClose)
      const targets = (await movementRepo.listOpen(settings.timeLimitMin)).filter((row) =>
        row.time_out < cutoff && !hasRemark(row.remarks, REMARK_NOT_RECORDED)
      )
      await movementRepo.updateMany(targets.map((row) => ({
        id: row.id,
        fields: { remarks: appendRemark(row.remarks, REMARK_NOT_RECORDED), updated_at: at }
      })))
      const ids = targets.map((row) => row.id)
      if (ids.length) await notify({ type: 'time_in_not_recorded', movementIds: ids })
      return ids
    }
  }
}
