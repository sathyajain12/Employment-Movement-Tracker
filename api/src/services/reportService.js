import { formatIstDate, formatIstTime, istMonthToUtc, istRangeToUtc } from '../lib/time.js'

// The paper book says "1-Hour"; keep that wording unless the limit has been changed.
export function limitHeading(limitMin) {
  return limitMin === 60 ? 'Within 1-Hour Limit (Y/N)' : `Within ${limitMin}-Minute Limit (Y/N)`
}

// The paper register's columns, in its exact order.
export function registerColumns(limitMin) {
  return [
    'Sl. No.',
    'Date',
    'Name of Staff Member',
    'Time Out',
    'Purpose / Place of Visit',
    'Permission Granted By',
    'Time In',
    'Total Time Away (in minutes)',
    limitHeading(limitMin),
    'Remarks'
  ]
}

export function toRegisterRow(row) {
  return [
    row.sl_no,
    formatIstDate(row.time_out),
    row.staff_name,
    formatIstTime(row.time_out),
    row.place ? `${row.purpose} / ${row.place}` : row.purpose,
    row.permission_by_name,
    row.time_in ? formatIstTime(row.time_in) : '',
    row.minutes_away ?? '',
    row.within_limit ?? '',
    row.remarks ?? ''
  ]
}

export function createReportService({ movementRepo, settingsService }) {
  return {
    async register(from, to) {
      const { timeLimitMin } = await settingsService.get()
      const rows = await movementRepo.register({ ...istRangeToUtc(from, to), limitMin: timeLimitMin })
      return { from, to, columns: registerColumns(timeLimitMin), rows: rows.map(toRegisterRow) }
    },

    async monthly(month) {
      const { timeLimitMin } = await settingsService.get()
      const rows = await movementRepo.monthlySummary({ ...istMonthToUtc(month), limitMin: timeLimitMin })
      return {
        month,
        timeLimitMin,
        items: rows.map((row) => ({
          staffId: row.staff_id,
          name: row.name,
          active: row.active === 1,
          outings: row.outings,
          totalMinutes: row.total_minutes,
          overLimit: row.over_limit,
          flagged: row.flagged,
          noTimeIn: row.no_time_in
        }))
      }
    }
  }
}
