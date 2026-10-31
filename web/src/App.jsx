import { Navigate, Outlet, useRouteError } from 'react-router'
import { useMe } from './api/hooks.js'
import { ErrorMessage, Skeleton } from './components/Feedback.jsx'

function FullPageLoading() {
  return (
    <div role="status" className="mx-auto max-w-md px-4 py-16">
      <span className="sr-only">Loading…</span>
      <Skeleton lines={4} />
    </div>
  )
}

// Loads /api/me once; signed-out visitors go to /login.
export function AuthGate() {
  const { data: me, isPending, error, refetch } = useMe()
  if (isPending) return <FullPageLoading />
  if (error) {
    return (
      <div className="mx-auto max-w-md space-y-3 px-4 py-16">
        <ErrorMessage error={error} />
        <button type="button" className="btn-secondary" onClick={() => refetch()}>Try again</button>
      </div>
    )
  }
  if (!me) return <Navigate to="/login" replace />
  return <Outlet />
}

export function AdminOnly({ children }) {
  const { data: me } = useMe()
  if (!me?.isAdmin) return <Navigate to="/home" replace />
  return children ?? <Outlet />
}

export function HomeRedirect() {
  const { data: me } = useMe()
  return <Navigate to={me.isAdmin ? '/admin' : '/home'} replace />
}

export function NotFound() {
  return (
    <div className="card text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <a className="mt-3 inline-block text-teal-700 underline" href="/">Go to the start page</a>
    </div>
  )
}

export function RouteError() {
  const error = useRouteError()
  return (
    <div className="mx-auto max-w-md space-y-3 px-4 py-16">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <ErrorMessage error={error} />
      <a className="text-teal-700 underline" href="/">Reload the app</a>
    </div>
  )
}
