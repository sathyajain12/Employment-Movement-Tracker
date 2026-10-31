import { Hono } from 'hono'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { schemas, validate } from '../lib/validate.js'

const settings = new Hono()
settings.use('*', requireAuth, requireAdmin)

settings.get('/', async (c) => c.json(await c.get('services').settings.get()))

settings.put('/', validate('json', schemas.settings), async (c) => {
  return c.json(await c.get('services').settings.update(c.req.valid('json')))
})

export default settings
