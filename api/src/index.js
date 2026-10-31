import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { END_OF_DAY_CRON, runEndOfDay } from './jobs/endOfDay.js'
import { OVERDUE_CRON, runOverdueCheck } from './jobs/overdueCheck.js'
import { errorHandler, notFoundHandler } from './middleware/errors.js'
import { rateLimit } from './middleware/rateLimit.js'
import auth from './routes/auth.js'
import me from './routes/me.js'
import movements from './routes/movements.js'
import reports from './routes/reports.js'
import settings from './routes/settings.js'
import staff from './routes/staff.js'
import { buildServices } from './services/index.js'

const DEV_ORIGIN = 'http://localhost:5173'

const app = new Hono()

app.onError(errorHandler)
app.notFound(notFoundHandler)

// In production the app and API share an origin, so CORS is only needed for local dev.
const devCors = cors({ origin: DEV_ORIGIN, credentials: true })
app.use('/api/*', (c, next) => (c.env.APP_URL?.startsWith('https://') ? next() : devCors(c, next)))

app.use('/api/*', async (c, next) => {
  c.set('services', buildServices(c.env))
  await next()
})

app.get('/api/health', (c) => c.json({ ok: true, time: new Date().toISOString() }))

app.get('/api/health/db', async (c) => {
  const { timeLimitMin } = await c.get('services').settings.get()
  return c.json({ ok: true, timeLimitMin })
})

app.use('/api/auth/*', rateLimit({ limit: 60, windowMs: 60_000 }))
app.route('/api/auth', auth)
app.route('/api', me)
app.route('/api/movements', movements)
app.route('/api', reports)
app.route('/api/staff', staff)
app.route('/api/settings', settings)

const JOBS = {
  [OVERDUE_CRON]: runOverdueCheck,
  [END_OF_DAY_CRON]: runEndOfDay
}

export default {
  fetch: app.fetch,

  async scheduled(event, env, ctx) {
    const job = JOBS[event.cron]
    if (!job) {
      console.warn(`[cron] no job for schedule "${event.cron}"`)
      return
    }
    ctx.waitUntil(job(env))
  }
}
