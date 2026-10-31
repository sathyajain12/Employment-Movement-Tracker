import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { schemas, validate } from '../lib/validate.js'

const movements = new Hono()
movements.use('*', requireAuth)

const ID = '/:id{[0-9]+}'

// --- Staff: own movements ---

movements.post('/', validate('json', schemas.timeOut), async (c) => {
  const movement = await c.get('services').movements.timeOut(c.get('user'), c.req.valid('json'))
  return c.json(movement, 201)
})

movements.patch(`${ID}/return`, validate('param', schemas.idParam), async (c) => {
  const { id } = c.req.valid('param')
  return c.json(await c.get('services').movements.recordReturn(c.get('user'), id))
})

movements.patch(`${ID}/details`, validate('param', schemas.idParam), validate('json', schemas.details), async (c) => {
  const { id } = c.req.valid('param')
  return c.json(await c.get('services').movements.editDetails(c.get('user'), id, c.req.valid('json')))
})

movements.get('/mine', validate('query', schemas.page), async (c) => {
  const { page } = c.req.valid('query')
  return c.json(await c.get('services').movements.listMine(c.get('user'), page))
})

export default movements
