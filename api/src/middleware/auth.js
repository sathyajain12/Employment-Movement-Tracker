import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { forbidden, unauthorized } from '../lib/errors.js'

export const SESSION_COOKIE = 'session'

// Verifies the session JWT, then reloads the person on every request so deactivation
// and ADMIN_EMAILS changes apply immediately. The JWT only carries the staff id.
export async function requireAuth(c, next) {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) throw unauthorized()

  let payload
  try {
    payload = await verify(token, c.env.JWT_SECRET, 'HS256')
  } catch {
    throw unauthorized()
  }

  const user = await c.get('services').staff.currentUser(Number(payload.sub))
  if (!user) throw unauthorized()
  c.set('user', user)
  await next()
}

export async function requireAdmin(c, next) {
  if (!c.get('user')?.isAdmin) throw forbidden('Only an admin can do this.')
  await next()
}
