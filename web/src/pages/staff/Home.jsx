import { useState } from 'react'
import { useAdmins, useEditDetails, useMe, useRecordReturn, useTimeOut } from '../../api/hooks.js'
import { ErrorMessage, Skeleton } from '../../components/Feedback.jsx'
import { LiveMinutes } from '../../components/LiveMinutes.jsx'
import { formatDate, formatTime } from '../../lib/time.js'

function PurposeFields({ purpose, place, onPurpose, onPlace, idPrefix }) {
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-purpose`} className="label">Purpose <span className="text-rose-700">*</span></label>
        <input
          id={`${idPrefix}-purpose`}
          className="input"
          required
          maxLength={200}
          value={purpose}
          onChange={(e) => onPurpose(e.target.value)}
          placeholder="e.g. Bank work"
          autoComplete="off"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-place`} className="label">Place of visit <span className="font-normal text-slate-500">(optional)</span></label>
        <input
          id={`${idPrefix}-place`}
          className="input"
          maxLength={120}
          value={place}
          onChange={(e) => onPlace(e.target.value)}
          placeholder="e.g. SBI, Main Road"
          autoComplete="off"
        />
      </div>
    </>
  )
}

function StepOutForm({ notice }) {
  const admins = useAdmins()
  const timeOut = useTimeOut()
  const [purpose, setPurpose] = useState('')
  const [place, setPlace] = useState('')
  const [permissionBy, setPermissionBy] = useState(null)

  const adminList = admins.data?.items ?? []
  // Pre-select the first admin in ADMIN_EMAILS until the user picks someone else.
  const approver = permissionBy ?? adminList[0]?.id ?? ''

  const submit = (e) => {
    e.preventDefault()
    timeOut.mutate({ purpose, place, permissionBy: Number(approver) })
  }

  return (
    <form onSubmit={submit} className="card space-y-4" aria-labelledby="step-out-heading">
      <h1 id="step-out-heading" className="text-xl font-semibold">Step out</h1>
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p>}

      <PurposeFields idPrefix="out" purpose={purpose} place={place} onPurpose={setPurpose} onPlace={setPlace} />

      <div>
        <label htmlFor="out-approver" className="label">Permission granted by</label>
        {admins.isPending ? (
          <Skeleton lines={1} />
        ) : adminList.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No admin is available yet. An admin needs to sign in once before anyone can record a movement.
          </p>
        ) : (
          <select id="out-approver" className="input" value={approver} onChange={(e) => setPermissionBy(e.target.value)}>
            {adminList.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}
          </select>
        )}
        <ErrorMessage error={admins.error} className="mt-2" />
      </div>

      <ErrorMessage error={timeOut.error} />
      <button type="submit" className="btn-primary btn-big" disabled={timeOut.isPending || !approver || !purpose.trim()}>
        {timeOut.isPending ? 'Recording…' : 'Record Time Out'}
      </button>
    </form>
  )
}

function EditDetails({ movement, onDone }) {
  const edit = useEditDetails()
  const [purpose, setPurpose] = useState(movement.purpose)
  const [place, setPlace] = useState(movement.place ?? '')

  const submit = (e) => {
    e.preventDefault()
    edit.mutate({ id: movement.id, purpose, place }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
      <PurposeFields idPrefix="edit" purpose={purpose} place={place} onPurpose={setPurpose} onPlace={setPlace} />
      <ErrorMessage error={edit.error} />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={edit.isPending || !purpose.trim()}>
          {edit.isPending ? 'Saving…' : 'Save details'}
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}

function OutCard({ movement, limit, onReturned }) {
  const recordReturn = useRecordReturn()
  const [editing, setEditing] = useState(false)

  const imBack = () => recordReturn.mutate(movement.id, { onSuccess: onReturned })

  return (
    <section className="card" aria-labelledby="out-heading">
      <div className="flex items-start justify-between gap-3">
        <h1 id="out-heading" className="text-xl font-semibold">You are out</h1>
        <span className="text-sm text-slate-500">{formatDate(movement.timeOut)}</span>
      </div>

      <div className="my-6 text-center">
        <LiveMinutes since={movement.timeOut} limit={limit} size="lg" />
        <p className="mt-1 text-sm text-slate-500">since {formatTime(movement.timeOut)} · limit {limit} min</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">Purpose</dt>
        <dd className="font-medium">{movement.purpose}</dd>
        <dt className="text-slate-500">Place</dt>
        <dd>{movement.place || '—'}</dd>
        <dt className="text-slate-500">Permission by</dt>
        <dd>{movement.permissionByName}</dd>
      </dl>

      {movement.canReturn ? (
        <>
          <ErrorMessage error={recordReturn.error} className="mt-4" />
          <button type="button" className="btn-primary btn-big mt-6" onClick={imBack} disabled={recordReturn.isPending}>
            {recordReturn.isPending ? 'Recording…' : "I'm back"}
          </button>
          {movement.review === 'pending' && !editing && (
            <button type="button" className="mt-3 w-full text-center text-sm text-teal-700 underline" onClick={() => setEditing(true)}>
              Edit details
            </button>
          )}
          {editing && <EditDetails movement={movement} onDone={() => setEditing(false)} />}
        </>
      ) : (
        <p role="status" className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This entry was closed at the end of the day without a Time In. Ask the office admin to correct it
          before you step out again.
        </p>
      )}
    </section>
  )
}

export default function StaffHome() {
  const { data: me } = useMe()
  const [notice, setNotice] = useState(null)

  const onReturned = (movement) =>
    setNotice(`Welcome back. You were away ${movement.minutesAway} min (${formatTime(movement.timeOut)} – ${formatTime(movement.timeIn)}).`)

  return (
    <div className="mx-auto max-w-lg">
      {me.openMovement
        ? <OutCard key={me.openMovement.id} movement={me.openMovement} limit={me.timeLimitMin} onReturned={onReturned} />
        : <StepOutForm notice={notice} />}
    </div>
  )
}
