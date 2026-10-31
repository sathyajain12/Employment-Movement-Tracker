import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('/api/*',cors({origin:'http://localhost:5173',credentials:true}))

app.get('/api/health', (c) => c.json({ ok: true, time: new Date().toISOString() }))

export default {
  fetch: app.fetch,
  async scheduled(event , env, ctx){}
}