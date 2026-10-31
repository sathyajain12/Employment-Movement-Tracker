// Everything is shown in IST (UTC+05:30, no daylight saving) regardless of the device's time zone.

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
const pad = (n) => String(n).padStart(2, '0')

function istParts(value) {
  const d = new Date(new Date(value).getTime() + IST_OFFSET_MS)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes()
  }
}

// 'DD-MM-YYYY'
export function formatDate(iso) {
  if (!iso) return ''
  const p = istParts(iso)
  return `${pad(p.day)}-${pad(p.month)}-${p.year}`
}

// 'hh:mm AM/PM'
export function formatTime(iso) {
  if (!iso) return ''
  const { hour, minute } = istParts(iso)
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${pad(h12)}:${pad(minute)} ${hour < 12 ? 'AM' : 'PM'}`
}

export function formatDateTime(iso) {
  return iso ? `${formatDate(iso)} ${formatTime(iso)}` : ''
}

// 'YYYY-MM-DD' -> 'DD-MM-YYYY'
export function formatDay(day) {
  const [y, m, d] = day.split('-')
  return `${d}-${m}-${y}`
}

export function todayIst(now = Date.now()) {
  const p = istParts(now)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

export function currentMonthIst(now = Date.now()) {
  return todayIst(now).slice(0, 7)
}

// 'YYYY-MM' -> first and last IST day of that month.
export function monthBounds(month) {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${pad(lastDay)}` }
}

export function minutesSince(iso, now) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
}

// ISO UTC -> value for <input type="datetime-local">, in IST.
export function toIstInput(iso) {
  if (!iso) return ''
  const p = istParts(iso)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

// <input type="datetime-local"> value, read as IST -> ISO UTC.
export function fromIstInput(value) {
  const [date, time] = value.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, h, min) - IST_OFFSET_MS).toISOString().replace(/\.\d{3}Z$/, 'Z')
}
