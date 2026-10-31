import { useEffect, useRef, useState } from 'react'
import { useAdmins, useAudit, useCorrect } from '../api/hooks.js'
import { AUDIT_FIELD_LABELS, minutesLabel } from '../lib/format.js'
import { formatDate, formatDateTime, formatTime, fromIstInput, toIstInput } from '../lib/time.js'
import { Badge, LimitBadge, ReviewBadge } from './Badge.jsx'
import { EmptyState, ErrorMessage, Skeleton } from './Feedback.jsx'
import { ReviewControls } from './ReviewControls.jsx'

function auditValue(field, value) {
  if (value === null || value === '') return '—'
  return field === 'time_out' || field === 'time_in' ? formatDateTime(value) : value
}

function AuditHistory({ movementId }) {
  const { data, isPending, error } = useAudit(movementId)
  if (isPending) return <Skeleton lines={2} />
  if (error) return <ErrorMessage error={error} />
  if (data.items.length === 0) return <EmptyState title="No corrections yet" />
  return (
    <ol className="space-y-3">
      {data.items.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-slate-200 p-3 text-sm">
          <p className="font-medium">{AUDIT_FIELD_LABELS[entry.field] ?? entry.field}</p>
          <p className="mt-1">
            <span className="text-slate-500 line-through">{auditValue(entry.field, entry.oldValue)}</span>
            {' → '}
            <span className="font-medium">{auditValue(entry.field, entry.newValue)}</span>
          </p>
          <p className="mt-1 text-slate-600">Reason: {entry.reason}</p>
          <p className="mt-1 text-xs text-slate-500">{entry.changedBy} · {formatDateTime(entry.changedAt)}</p>
        </li>
      ))}
    </ol>
  )
}

function CorrectionForm({ movement, onSaved }) {
  const correct = useCorrect()
  const admins = useAdmins()
  const initial = {
    timeOut: toIstInput(movement.timeOut),
    timeIn: toIstInput(movement.timeIn),
    purpose: movement.purpose,
    place: movement.place ?? '',
    permissionBy: String(movement.permissionBy),
    remarks: movement.remarks ?? ''
  }
  const [form, setForm] = useState(initial)
  const [reason, setReason] = useState('')
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  // Send only what changed so untouched timestamps keep their seconds.
  const changes = {}
  if (form.timeOut !== initial.timeOut) changes.timeOut = fromIstInput(form.timeOut)
  if (form.timeIn !== initial.timeIn && form.timeIn) changes.timeIn = fromIstInput(form.timeIn)
  if (form.purpose !== initial.purpose) changes.purpose = form.purpose
  if (form.place !== initial.place) changes.place = form.place
  if (form.permissionBy !== initial.permissionBy) changes.permissionBy = Number(form.permissionBy)
  if (form.remarks !== initial.remarks) changes.remarks = form.remarks
  const hasChanges = Object.keys(changes).length > 0

  const approverOptions = admins.data?.items ?? []
  const currentMissing = !approverOptions.some((a) => String(a.id) === initial.permissionBy)

  const submit = (e) => {
    e.preventDefault()
    correct.mutate({ id: movement.id, ...changes, reason }, { onSuccess: onSaved })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="c-out" className="label">Time Out (IST)</label>
          <input id="c-out" type="datetime-local" className="input" required value={form.timeOut} onChange={set('timeOut')} />
        </div>
        <div>
          <label htmlFor="c-in" className="label">Time In (IST)</label>
          <input id="c-in" type="datetime-local" className="input" value={form.timeIn} onChange={set('timeIn')} />
        </div>
      </div>
      <div>
        <label htmlFor="c-purpose" className="label">Purpose</label>
        <input id="c-purpose" className="input" required maxLength={200} value={form.purpose} onChange={set('purpose')} />
      </div>
      <div>
        <label htmlFor="c-place" className="label">Place</label>
        <input id="c-place" className="input" maxLength={120} value={form.place} onChange={set('place')} />
      </div>
      <div>
        <label htmlFor="c-approver" className="label">Permission granted by</label>
        <select id="c-approver" className="input" value={form.permissionBy} onChange={set('permissionBy')}>
          {currentMissing && <option value={initial.permissionBy}>{movement.permissionByName} (no longer admin)</option>}
          {approverOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="c-remarks" className="label">Remarks</label>
        <textarea id="c-remarks" className="input" rows={2} maxLength={300} value={form.remarks} onChange={set('remarks')} />
      </div>
      <div>
        <label htmlFor="c-reason" className="label">Reason for correction <span className="text-rose-700">*</span></label>
        <input id="c-reason" className="input" required maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <ErrorMessage error={correct.error} />
      <button type="submit" className="btn-primary" disabled={correct.isPending || !hasChanges || !reason.trim()}>
        {correct.isPending ? 'Saving…' : 'Save correction'}
      </button>
    </form>
  )
}

export function MovementDrawer({ movement, onClose }) {
  const dialogRef = useRef(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="drawer-title"
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-xl overflow-y-auto bg-white p-0 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
        <div>
          <h2 id="drawer-title" className="text-lg font-semibold">{movement.staffName}</h2>
          <p className="text-sm text-slate-500">{formatDate(movement.timeOut)}{movement.slNo ? ` · Sl. No. ${movement.slNo}` : ''}</p>
        </div>
        <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => dialogRef.current.close()}>
          Close
        </button>
      </div>

      <div className="space-y-6 px-5 py-5">
        <section aria-label="Entry details">
          <div className="mb-3 flex flex-wrap gap-2">
            <ReviewBadge review={movement.review} />
            <LimitBadge withinLimit={movement.withinLimit} />
            {movement.closedAtEndOfDay && <Badge tone="amber">Open at close</Badge>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">Time Out</dt><dd>{formatTime(movement.timeOut)}</dd>
            <dt className="text-slate-500">Time In</dt><dd>{movement.timeIn ? formatDateTime(movement.timeIn) : '—'}</dd>
            <dt className="text-slate-500">Time away</dt><dd>{minutesLabel(movement.minutesAway)}</dd>
            <dt className="text-slate-500">Purpose</dt><dd>{movement.purpose}</dd>
            <dt className="text-slate-500">Place</dt><dd>{movement.place || '—'}</dd>
            <dt className="text-slate-500">Permission by</dt><dd>{movement.permissionByName}</dd>
            <dt className="text-slate-500">Remarks</dt><dd>{movement.remarks || '—'}</dd>
          </dl>
        </section>

        <section aria-labelledby="review-heading">
          <h3 id="review-heading" className="mb-2 font-semibold">Review</h3>
          <ReviewControls movement={movement} />
        </section>

        <section aria-labelledby="correct-heading">
          <h3 id="correct-heading" className="mb-2 font-semibold">Correct entry</h3>
          {saved && (
            <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Correction saved. The entry is back in the review queue.
            </p>
          )}
          {/* Remount after each save so the form starts from the corrected values. */}
          <CorrectionForm key={movement.updatedAt ?? movement.id} movement={movement} onSaved={() => setSaved(true)} />
        </section>

        <section aria-labelledby="audit-heading">
          <h3 id="audit-heading" className="mb-2 font-semibold">Change history</h3>
          <AuditHistory movementId={movement.id} />
        </section>
      </div>
    </dialog>
  )
}
