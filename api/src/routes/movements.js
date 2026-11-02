import { Hono } from 'hono'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { schemas, validate } from '../lib/validate.js'

const movements = new Hono()
movements.use('*', requireAuth)

const ID = '/:id{[0-9]+}'

// --- Own movements (admins only) ---

// Staff only send requests (/requests); the admin's approval records their Time Out and the
// admin records their Time In ("Mark returned"). These routes are for an admin's own entries.
movements.post('/', requireAdmin, validate('json', schemas.timeOut), async (c) => {
  const movement = await c.get('services').movements.timeOut(c.get('user'), c.req.valid('json'))
  return c.json(movement, 201)
})

movements.patch(`${ID}/return`, requireAdmin, validate('param', schemas.idParam), async (c) => {
  const { id } = c.req.valid('param')
  return c.json(await c.get('services').movements.recordReturn(c.get('user'), id))
})

movements.patch(`${ID}/details`, requireAdmin, validate('param', schemas.idParam), validate('json', schemas.details), async (c) => {
  const { id } = c.req.valid('param')
  return c.json(await c.get('services').movements.editDetails(c.get('user'), id, c.req.valid('json')))
})

// An admin's own entry within a few minutes of Time Out, or any entry with a reason (the service decides).
movements.patch(`${ID}/void`, requireAdmin, validate('param', schemas.idParam), validate('json', schemas.voidMovement), async (c) => {
  const { id } = c.req.valid('param')
  return c.json(await c.get('services').movements.void(c.get('user'), id, c.req.valid('json')))
})

movements.get('/mine', validate('query', schemas.page), async (c) => {
  const { page } = c.req.valid('query')
  return c.json(await c.get('services').movements.listMine(c.get('user'), page))
})

// --- Admin ---

movements.get('/active', requireAdmin, async (c) => {
  return c.json(await c.get('services').movements.listActive())
})

movements.get('/today', requireAdmin, async (c) => {
  return c.json(await c.get('services').movements.today())
})

movements.get('/cancelled-today', requireAdmin, async (c) => {
  return c.json({ items: await c.get('services').movements.cancelledToday() })
})

movements.patch(`${ID}/admin-return`, requireAdmin, validate('param', schemas.idParam), async (c) => {
  const { id } = c.req.valid('param')
  return c.json(await c.get('services').movements.adminReturn(c.get('user'), id))
})

movements.get('/', requireAdmin, validate('query', schemas.movementsQuery), async (c) => {
  return c.json(await c.get('services').movements.search(c.req.valid('query')))
})

movements.post('/review/bulk', requireAdmin, validate('json', schemas.bulkReview), async (c) => {
  const { ids, review } = c.req.valid('json')
  return c.json(await c.get('services').movements.bulkReview(c.get('user'), ids, review))
})

movements.patch(`${ID}/review`, requireAdmin, validate('param', schemas.idParam), validate('json', schemas.review), async (c) => {
  const { id } = c.req.valid('param')
  return c.json(await c.get('services').movements.review(c.get('user'), id, c.req.valid('json')))
})

movements.patch(ID, requireAdmin, validate('param', schemas.idParam), validate('json', schemas.correction), async (c) => {
  const { id } = c.req.valid('param')
  return c.json(await c.get('services').movements.correct(c.get('user'), id, c.req.valid('json')))
})

movements.get(`${ID}/audit`, requireAdmin, validate('param', schemas.idParam), async (c) => {
  const { id } = c.req.valid('param')
  return c.json({ items: await c.get('services').movements.audit(id) })
})

export default movements
