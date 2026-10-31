import { useState } from 'react'
import { useBulkReview, useMovements } from '../../api/hooks.js'
import { Badge, LimitBadge } from '../../components/Badge.jsx'
import { EmptyState, ErrorMessage, Loading, PageHeader } from '../../components/Feedback.jsx'
import { MovementDrawer } from '../../components/MovementDrawer.jsx'
import { Pagination } from '../../components/Pagination.jsx'
import { ReviewControls } from '../../components/ReviewControls.jsx'
import { minutesLabel, purposeAndPlace } from '../../lib/format.js'
import { formatDate, formatTime } from '../../lib/time.js'

function QueueItem({ movement, selected, onToggle, onOpen }) {
  const checkboxId = `select-${movement.id}`
  return (
    <li className="card p-4">
      <div className="flex gap-3">
        <div className="pt-1">
          <input
            id={checkboxId}
            type="checkbox"
            className="h-5 w-5 accent-teal-700"
            checked={selected}
            disabled={!movement.timeIn}
            onChange={onToggle}
          />
          <label htmlFor={checkboxId} className="sr-only">Select {movement.staffName} on {formatDate(movement.timeOut)}</label>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{movement.staffName}</span>
            <span className="text-sm text-slate-500">{formatDate(movement.timeOut)}</span>
            {movement.closedAtEndOfDay && <Badge tone="amber">Open at close</Badge>}
            {!movement.timeIn && !movement.closedAtEndOfDay && <Badge tone="amber">No Time In</Badge>}
            {movement.withinLimit === 'N' && <Badge tone="red">Over limit</Badge>}
          </div>
          <p className="text-sm text-slate-700">{purposeAndPlace(movement)}</p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>{formatTime(movement.timeOut)} – {movement.timeIn ? formatTime(movement.timeIn) : '—'}</span>
            <span className="tabular-nums">{minutesLabel(movement.minutesAway)}</span>
            <LimitBadge withinLimit={movement.withinLimit} />
          </p>
          {movement.remarks && <p className="text-sm text-slate-600">Remarks: {movement.remarks}</p>}
          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-start">
            <div className="flex-1"><ReviewControls movement={movement} /></div>
            <button type="button" className="btn-secondary" onClick={onOpen}>Details / correct</button>
          </div>
        </div>
      </div>
    </li>
  )
}

export default function Review() {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(() => new Set())
  const [openId, setOpenId] = useState(null)
  const { data, isPending, error } = useMovements({ queue: 'true', page })
  const bulk = useBulkReview()

  const items = data?.items ?? []
  const confirmable = items.filter((m) => m.timeIn)
  const chosen = confirmable.filter((m) => selected.has(m.id))
  const allChosen = confirmable.length > 0 && chosen.length === confirmable.length
  const open = items.find((m) => m.id === openId)

  const toggle = (id) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(confirmable.map((m) => m.id)))
  const confirmSelected = () => {
    if (!window.confirm(`Confirm ${chosen.length} selected ${chosen.length === 1 ? 'entry' : 'entries'}?`)) return
    bulk.mutate({ ids: chosen.map((m) => m.id), review: 'confirmed' }, { onSuccess: () => setSelected(new Set()) })
  }

  return (
    <div>
      <PageHeader title="Review queue">
        {data && <span className="text-sm text-slate-500">{data.total} pending</span>}
      </PageHeader>

      {isPending ? (
        <Loading lines={5} />
      ) : error ? (
        <ErrorMessage error={error} />
      ) : items.length === 0 ? (
        <EmptyState title="All caught up">There are no entries waiting for review.</EmptyState>
      ) : (
        <>
          <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="h-5 w-5 accent-teal-700" checked={allChosen} onChange={toggleAll} disabled={confirmable.length === 0} />
              Select all with Time In on this page
            </label>
            <button type="button" className="btn-primary" disabled={chosen.length === 0 || bulk.isPending} onClick={confirmSelected}>
              {bulk.isPending ? 'Confirming…' : `Confirm selected (${chosen.length})`}
            </button>
          </div>
          <ErrorMessage error={bulk.error} className="mb-3" />
          <ul className="space-y-3">
            {items.map((m) => (
              <QueueItem
                key={m.id}
                movement={m}
                selected={selected.has(m.id)}
                onToggle={() => toggle(m.id)}
                onOpen={() => setOpenId(m.id)}
              />
            ))}
          </ul>
          <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
        </>
      )}

      {open && <MovementDrawer movement={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}
