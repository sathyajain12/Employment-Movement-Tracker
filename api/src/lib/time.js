// All timestamps are stored as ISO 8601 UTC without milliseconds, e.g. 2026-10-31T07:13:57Z.
// The office runs on IST (UTC+05:30), which has no daylight saving, so a fixed offset is exact.

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function toIso(date) {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export function nowIso() {
  return toIso(Date.now())
}

export function minutesBetween(fromIso, toIsoValue) {
  return Math.floor((Date.parse(toIsoValue) - Date.parse(fromIso)) / 60000)
}

// Shift a UTC instant so its UTC fields read as IST wall-clock fields.
function istFields(iso) {
  const d = new Date(Date.parse(iso) + IST_OFFSET_MS)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes()
  }
}

const pad = (n) => String(n).padStart(2, '0')

// 'YYYY-MM-DD' of the IST calendar day containing the instant.
export function istDate(iso) {
  const f = istFields(iso)
  return `${f.year}-${pad(f.month)}-${pad(f.day)}`
}

// 'HH:MM' (24-hour) IST wall-clock time of the instant.
export function istTime(iso) {
  const f = istFields(iso)
  return `${pad(f.hour)}:${pad(f.minute)}`
}

// UTC instant at which the given IST calendar day ('YYYY-MM-DD') starts.
export function istDayStartUtc(day) {
  const [y, m, d] = day.split('-').map(Number)
  return toIso(Date.UTC(y, m - 1, d) - IST_OFFSET_MS)
}

// UTC instant of an IST wall-clock time ('HH:MM') on an IST day ('YYYY-MM-DD').
export function istDateTimeUtc(day, hhmm) {
  const [h, min] = hhmm.split(':').map(Number)
  return toIso(Date.parse(istDayStartUtc(day)) + (h * 60 + min) * 60000)
}

// Inclusive IST day range -> half-open UTC range [start, end).
export function istRangeToUtc(fromDay, toDay) {
  return {
    start: istDayStartUtc(fromDay),
    end: toIso(Date.parse(istDayStartUtc(toDay)) + DAY_MS)
  }
}

// IST month 'YYYY-MM' -> half-open UTC range [start, end).
export function istMonthToUtc(month) {
  const [y, m] = month.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`
  return {
    start: istDayStartUtc(`${month}-01`),
    end: istDayStartUtc(`${next}-01`)
  }
}

export function formatIstDate(iso) {
  const [y, m, d] = istDate(iso).split('-')
  return `${d}-${m}-${y}`
}

export function formatIstTime(iso) {
  const { hour, minute } = istFields(iso)
  const suffix = hour < 12 ? 'AM' : 'PM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${pad(h12)}:${pad(minute)} ${suffix}`
}
