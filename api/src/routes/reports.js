import { Hono } from 'hono'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { schemas, validate } from '../lib/validate.js'

// Mounted at /api, so auth is applied per route rather than with use('*').
const reports = new Hono()
const adminOnly = [requireAuth, requireAdmin]

reports.get('/register', ...adminOnly, validate('query', schemas.range), async (c) => {
  const { from, to } = c.req.valid('query')
  return c.json(await c.get('services').reports.register(from, to))
})

reports.get('/reports/monthly', ...adminOnly, validate('query', schemas.month), async (c) => {
  const { month } = c.req.valid('query')
  return c.json(await c.get('services').reports.monthly(month))
})

reports.get('/admin/counts', ...adminOnly, async (c) => {
  return c.json(await c.get('services').movements.counts())
})

export default reports
