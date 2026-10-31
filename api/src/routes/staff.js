import { Hono } from 'hono'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { schemas, validate } from '../lib/validate.js'

const staff = new Hono()
staff.use('*', requireAuth, requireAdmin)

staff.get('/', async (c) => {
  return c.json({ items: await c.get('services').staff.list() })
})

// Role is always 'staff' here; admins come from ADMIN_EMAILS.
staff.post('/', validate('json', schemas.staffCreate), async (c) => {
  return c.json(await c.get('services').staff.create(c.req.valid('json')), 201)
})

staff.patch('/:id{[0-9]+}', validate('param', schemas.idParam), validate('json', schemas.staffUpdate), async (c) => {
  const { id } = c.req.valid('param')
  return c.json(await c.get('services').staff.update(id, c.req.valid('json')))
})

export default staff
