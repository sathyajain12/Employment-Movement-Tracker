import { describe, expect, it } from 'vitest'
import {
  formatIstDate, formatIstTime, istDate, istDateTimeUtc, istDayStartUtc, istMonthToUtc, istRangeToUtc, minutesBetween, toIso
} from '../src/lib/time.js'

describe('IST <-> UTC day boundaries', () => {
  it('starts an IST day at 18:30 UTC the previous day', () => {
    expect(istDayStartUtc('2026-10-31')).toBe('2026-10-30T18:30:00Z')
  })

  it('places instants either side of IST midnight on the right day', () => {
    expect(istDate('2026-10-30T18:29:59Z')).toBe('2026-10-30')
    expect(istDate('2026-10-30T18:30:00Z')).toBe('2026-10-31')
  })

  it('converts an inclusive IST date range to a half-open UTC range', () => {
    expect(istRangeToUtc('2026-10-01', '2026-10-31')).toEqual({
      start: '2026-09-30T18:30:00Z',
      end: '2026-10-31T18:30:00Z'
    })
  })

  it('handles month and year rollover', () => {
    expect(istMonthToUtc('2026-12')).toEqual({ start: '2026-11-30T18:30:00Z', end: '2026-12-31T18:30:00Z' })
    expect(istMonthToUtc('2027-02')).toEqual({ start: '2027-01-31T18:30:00Z', end: '2027-02-28T18:30:00Z' })
  })

  it('converts an IST wall-clock time to UTC', () => {
    expect(istDateTimeUtc('2026-10-31', '17:30')).toBe('2026-10-31T12:00:00Z')
  })
})

describe('formatting and arithmetic', () => {
  it('formats IST date and 12-hour time', () => {
    expect(formatIstDate('2026-10-30T18:30:00Z')).toBe('31-10-2026')
    expect(formatIstTime('2026-10-31T07:13:57Z')).toBe('12:43 PM')
    expect(formatIstTime('2026-10-30T18:35:00Z')).toBe('12:05 AM')
    expect(formatIstTime('2026-10-31T03:30:00Z')).toBe('09:00 AM')
  })

  it('drops milliseconds from stored timestamps', () => {
    expect(toIso('2026-10-31T07:13:57.372Z')).toBe('2026-10-31T07:13:57Z')
  })

  it('counts whole minutes', () => {
    expect(minutesBetween('2026-10-31T05:00:00Z', '2026-10-31T06:00:59Z')).toBe(60)
  })
})
