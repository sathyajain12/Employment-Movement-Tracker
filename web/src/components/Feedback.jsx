export function Skeleton({ lines = 3, className = '' }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 rounded bg-slate-200" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  )
}

export function Loading({ label = 'Loading…', lines = 3 }) {
  return (
    <div role="status" className="card">
      <span className="sr-only">{label}</span>
      <Skeleton lines={lines} />
    </div>
  )
}

export function ErrorMessage({ error, className = '' }) {
  if (!error) return null
  return (
    <p role="alert" className={`rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 ${className}`}>
      {error.message || String(error)}
    </p>
  )
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {children && <p className="mt-1 text-sm text-slate-500">{children}</p>}
    </div>
  )
}

export function PageHeader({ title, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}
