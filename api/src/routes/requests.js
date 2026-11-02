import { Hono } from 'hono'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { schemas, validate } from '../lib/validate.js'

const requests = new Hono()
requests.use('*', requireAuth)

const ID = '/:id{[0-9]+}'

// --- Staff: own requests ---

requests.post('/', validate('json', schemas.permissionRequest), async (c) => {
  const request = await c.get('services').requests.create(c.get('user'), c.req.valid('json'))
  return c.json(request, 201)
})

requests.post(`${ID}/cancel`, validate('param', schemas.idParam), async (c) => {
  const { id } = c.req.valid('param')
  return c.json(await c.get('services').requests.cancel(c.get('user'), id))
})

// --- Admin ---

requests.get('/pending', requireAdmin, async (c) => {
  return c.json({ items: await c.get('services').requests.listPending() })
})

requests.post(`${ID}/approve`, requireAdmin, validate('param', schemas.idParam), async (c) => {
  const { id } = c.req.valid('param')
  return c.json(await c.get('services').requests.approve(c.get('user'), id))
})

requests.post(`${ID}/reject`, requireAdmin, validate('param', schemas.idParam), validate('json', schemas.rejectRequest), async (c) => {
  const { id } = c.req.valid('param')
  return c.json(await c.get('services').requests.reject(c.get('user'), id, c.req.valid('json')))
})

export default requests
