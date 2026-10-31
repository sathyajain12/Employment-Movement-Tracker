import { formatIstDate, formatIstTime, istMonthToUtc, istRangeToUtc } from '../lib/time.js'

// The paper register's columns, in its exact order.
export const REGISTER_COLUMNS = [
  'Sl. No.',
  'Date',
  'Name of Staff Member',
  'Time Out',
  'Purpose / Place of Visit',
  'Permission Granted By',
  'Time In',
  'Total Time Away (in minutes)',
  'Within 1-Hour Limit (Y/N)',
  'Remarks'
]

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
      return { from, to, columns: REGISTER_COLUMNS, rows: rows.map(toRegisterRow) }
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
