import { useState } from 'react'
import { useMyMovements } from '../../api/hooks.js'
import { LimitBadge, ReviewBadge } from '../../components/Badge.jsx'
import { EmptyState, ErrorMessage, Loading, PageHeader } from '../../components/Feedback.jsx'
import { Pagination } from '../../components/Pagination.jsx'
import { minutesLabel, purposeAndPlace } from '../../lib/format.js'
import { formatDate, formatTime } from '../../lib/time.js'

function HistoryItem({ movement }) {
  return (
    <li className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{formatDate(movement.timeOut)}</span>
        <ReviewBadge review={movement.review} />
      </div>
      <p className="mt-1 text-sm text-slate-700">{purposeAndPlace(movement)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span><span className="text-slate-500">Out</span> {formatTime(movement.timeOut)}</span>
        <span><span className="text-slate-500">In</span> {movement.timeIn ? formatTime(movement.timeIn) : '—'}</span>
        <span className="tabular-nums">{minutesLabel(movement.minutesAway)}</span>
        <LimitBadge withinLimit={movement.withinLimit} />
      </div>
      {movement.remarks && <p className="mt-2 text-sm text-slate-600"><span className="text-slate-500">Remarks:</span> {movement.remarks}</p>}
    </li>
  )
}

export default function History() {
  const [page, setPage] = useState(1)
  const { data, isPending, error } = useMyMovements(page)

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="My history" />
      {isPending ? (
        <Loading lines={5} />
      ) : error ? (
        <ErrorMessage error={error} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No movements yet">Your outings will appear here after you record a Time Out.</EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((m) => <HistoryItem key={m.id} movement={m} />)}
          </ul>
          <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
        </>
      )}
    </div>
  )
}
