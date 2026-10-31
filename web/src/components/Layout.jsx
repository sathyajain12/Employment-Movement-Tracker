import { NavLink, Outlet, useNavigate } from 'react-router'
import { useCounts, useLogout, useMe } from '../api/hooks.js'
import { CountBadge } from './Badge.jsx'

function NavItem({ to, end, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
          isActive ? 'bg-teal-700 text-white' : 'text-slate-700 hover:bg-slate-100'
        }`}
    >
      {children}
    </NavLink>
  )
}

function AdminNav() {
  const { data: counts } = useCounts(true)
  return (
    <>
      <NavItem to="/admin" end>
        Out now
        <CountBadge count={counts?.outNow} label={`${counts?.outNow} out now`} />
        <CountBadge count={counts?.overdueNow} tone="red" label={`${counts?.overdueNow} overdue`} />
      </NavItem>
      <NavItem to="/admin/review">
        Review
        <CountBadge count={counts?.pendingReview} label={`${counts?.pendingReview} pending review`} />
      </NavItem>
      <NavItem to="/admin/register">Register</NavItem>
      <NavItem to="/admin/monthly">Monthly</NavItem>
      <NavItem to="/admin/staff">Staff</NavItem>
      <NavItem to="/admin/settings">Settings</NavItem>
      <span className="mx-1 hidden w-px self-stretch bg-slate-200 sm:block" aria-hidden="true" />
    </>
  )
}

export function Layout() {
  const { data: me } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()

  const signOut = () => logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span className="font-semibold text-slate-900">Movement Register</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">{me.name}</span>
            <button type="button" className="btn-secondary px-3 py-1.5" onClick={signOut} disabled={logout.isPending}>
              Sign out
            </button>
          </div>
        </div>
        <nav aria-label="Main" className="mx-auto max-w-6xl overflow-x-auto px-4 pb-2">
          <div className="flex gap-1">
            {me.isAdmin && <AdminNav />}
            <NavItem to="/home">{me.isAdmin ? 'My movement' : 'Home'}</NavItem>
            <NavItem to="/history">My history</NavItem>
          </div>
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
