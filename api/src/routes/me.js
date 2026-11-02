import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { homeState } from '../services/requestService.js'

// Mounted at /api, so auth is applied per route rather than with use('*').
const me = new Hono()

// Who is signed in, plus everything the home screen needs to pick its state:
// IDLE, PENDING, OUT, RETURNED or REJECTED.
me.get('/me', requireAuth, async (c) => {
  const { movements, requests, settings } = c.get('services')
  const user = c.get('user')
  const [openMovement, request, recentReturn, lastStatusChangeAt, { timeLimitMin }] = await Promise.all([
    movements.openFor(user),
    requests.currentFor(user),
    movements.recentReturnFor(user),
    requests.lastStatusChange(user),
    settings.get()
  ])
  const state = homeState({ openMovement, request, recentReturn })
  return c.json({ ...user, state, openMovement, request, recentReturn, lastStatusChangeAt, timeLimitMin })
})

me.get('/me/today', requireAuth, async (c) => {
  return c.json(await c.get('services').requests.myDay(c.get('user')))
})

me.get('/me/places', requireAuth, async (c) => {
  return c.json({ items: await c.get('services').movements.recentPlaces(c.get('user')) })
})

me.get('/admins', requireAuth, async (c) => {
  return c.json({ items: await c.get('services').staff.listAdmins() })
})

export default me
