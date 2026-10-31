import { Navigate, useSearchParams } from 'react-router'
import { useMe } from '../api/hooks.js'
import { LOGIN_ERRORS } from '../lib/format.js'

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export default function Login() {
  const [params] = useSearchParams()
  const { data: me } = useMe()
  const errorCode = params.get('error')
  const message = errorCode && (LOGIN_ERRORS[errorCode] ?? 'Sign-in failed. Please try again.')

  if (me) return <Navigate to="/" replace />

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="card w-full max-w-sm text-center">
        <img src="/favicon.svg" alt="" className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Movement Register</h1>
        <p className="mt-1 text-sm text-slate-600">Record when you step out of the office and when you are back.</p>

        {message && (
          <p role="alert" className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900">
            {message}
          </p>
        )}

        {/* A full-page navigation, not fetch: the API redirects the browser to Google. */}
        <a href="/api/auth/google" className="btn-secondary btn-big mt-6 text-base">
          <GoogleMark />
          Sign in with Google
        </a>
      </div>
    </main>
  )
}
