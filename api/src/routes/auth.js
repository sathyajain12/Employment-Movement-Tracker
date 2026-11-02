import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { decode, sign } from 'hono/jwt'
import { SESSION_COOKIE } from '../middleware/auth.js'
import { SignInError } from '../services/staffService.js'

const auth = new Hono()

const SESSION_SECONDS = 12 * 60 * 60
const STATE_COOKIE = 'oauth_state'
// Which sign-in page the person started from, so a failed sign-in goes back to it.
const PORTAL_COOKIE = 'login_portal'
const loginPage = (portal) => (portal === 'admin' ? '/admin/login' : '/login')
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

const isHttps = (c) => c.env.APP_URL.startsWith('https://')
// Built from APP_URL, never the request URL: in dev the request arrives via the Vite proxy.
const redirectUri = (c) => `${c.env.APP_URL}/api/auth/google/callback`
const isConfigured = (c) => Boolean(c.env.APP_URL && c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET && c.env.JWT_SECRET)

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function exchangeCode(c, code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(c),
      grant_type: 'authorization_code'
    })
  })
  if (!res.ok) return null
  const body = await res.json()
  return body.id_token ?? null
}

// The id_token came straight from Google over TLS, so decoding without verifying the
// signature is acceptable; the claims are still checked.
function readIdToken(c, idToken) {
  let claims
  try {
    claims = decode(idToken).payload
  } catch {
    return { error: 'invalid_token' }
  }
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (!GOOGLE_ISSUERS.includes(claims.iss) || claims.aud !== c.env.GOOGLE_CLIENT_ID || !claims.email || !claims.sub) {
    return { error: 'invalid_token' }
  }
  if (claims.exp && claims.exp < nowSeconds) return { error: 'invalid_token' }
  if (claims.email_verified !== true && claims.email_verified !== 'true') return { error: 'email_not_verified' }
  if (c.env.ALLOWED_DOMAIN && claims.hd !== c.env.ALLOWED_DOMAIN) return { error: 'wrong_domain' }
  return { claims }
}

auth.get('/google', (c) => {
  const portal = c.req.query('portal') === 'admin' ? 'admin' : 'staff'
  if (!isConfigured(c)) {
    console.error('Google sign-in is not configured: set APP_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET')
    return c.redirect(`${c.env.APP_URL || ''}${loginPage(portal)}?error=not_configured`)
  }

  const state = randomState()
  const cookie = { httpOnly: true, secure: isHttps(c), sameSite: 'Lax', path: '/api/auth', maxAge: 600 }
  setCookie(c, STATE_COOKIE, state, cookie)
  setCookie(c, PORTAL_COOKIE, portal, cookie)

  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(c),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  })
  if (c.env.ALLOWED_DOMAIN) params.set('hd', c.env.ALLOWED_DOMAIN)

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

auth.get('/google/callback', async (c) => {
  const { code, state, error } = c.req.query()
  const savedState = getCookie(c, STATE_COOKIE)
  const portal = getCookie(c, PORTAL_COOKIE)
  deleteCookie(c, STATE_COOKIE, { path: '/api/auth', secure: isHttps(c) })
  deleteCookie(c, PORTAL_COOKIE, { path: '/api/auth', secure: isHttps(c) })

  const fail = (reason) => c.redirect(`${c.env.APP_URL}${loginPage(portal)}?error=${reason}`)

  if (error) return fail('cancelled')
  if (!code || !state || !savedState || state !== savedState) return fail('invalid_state')

  let idToken
  try {
    idToken = await exchangeCode(c, code)
  } catch (err) {
    console.error('Google token exchange failed', err)
  }
  if (!idToken) return fail('google_error')

  const { claims, error: tokenError } = readIdToken(c, idToken)
  if (tokenError) return fail(tokenError)

  return startSession(c, { email: claims.email, sub: claims.sub, name: claims.name }, portal)
})

// Local development only: sign in by email without Google. Enabled by DEV_LOGIN=true in
// .dev.vars; never set it in production.
auth.get('/dev-login', (c) => {
  if (c.env.DEV_LOGIN !== 'true') return c.notFound()
  const email = c.req.query('email')?.trim()
  const portal = c.req.query('portal')
  if (!email) return c.redirect(`${c.env.APP_URL}${loginPage(portal)}`)
  return startSession(c, { email, sub: null }, portal)
})

async function startSession(c, identity, portal) {
  let staff
  try {
    staff = await c.get('services').staff.signIn(identity)
  } catch (err) {
    if (err instanceof SignInError) return c.redirect(`${c.env.APP_URL}${loginPage(portal)}?error=${err.code}`)
    throw err
  }

  const token = await sign(
    { sub: staff.id, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS },
    c.env.JWT_SECRET,
    'HS256'
  )
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true, secure: isHttps(c), sameSite: 'Lax', path: '/', maxAge: SESSION_SECONDS
  })
  return c.redirect(`${c.env.APP_URL}/`)
}

auth.post('/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: isHttps(c) })
  return c.json({ ok: true })
})

export default auth
