import { AppError } from '../lib/errors.js'

// Lightweight fixed-window counter per client IP. It lives in isolate memory, so it is
// best-effort (each Worker isolate counts separately) — enough to blunt sign-in hammering.
export function rateLimit({ limit, windowMs }) {
  const hits = new Map()

  return async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'local'
    const now = Date.now()
    const entry = hits.get(ip)

    if (!entry || now - entry.start >= windowMs) {
      hits.set(ip, { start: now, count: 1 })
    } else if (++entry.count > limit) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many sign-in attempts. Please wait a minute and try again.')
    }

    if (hits.size > 10000) {
      for (const [key, value] of hits) if (now - value.start >= windowMs) hits.delete(key)
    }
    await next()
  }
}
