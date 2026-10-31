import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'

// Mounted at /api, so auth is applied per route rather than with use('*').
const me = new Hono()

me.get('/me', requireAuth, async (c) => {
  const { movements, settings } = c.get('services')
  const user = c.get('user')
  const [openMovement, { timeLimitMin }] = await Promise.all([movements.openFor(user), settings.get()])
  return c.json({ ...user, openMovement, timeLimitMin })
})

me.get('/admins', requireAuth, async (c) => {
  return c.json({ items: await c.get('services').staff.listAdmins() })
})

export default me
