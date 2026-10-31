import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useExportRegister, useMovements, useStaffList } from '../../api/hooks.js'
import { EmptyState, ErrorMessage, Loading, PageHeader } from '../../components/Feedback.jsx'
import { MovementDrawer } from '../../components/MovementDrawer.jsx'
import { Pagination } from '../../components/Pagination.jsx'
import { purposeAndPlace, REVIEW_LABELS } from '../../lib/format.js'
import { currentMonthIst, formatDate, formatDay, formatTime, monthBounds } from '../../lib/time.js'

// The paper register's columns, in its exact order.
const REGISTER_HEADINGS = [
  'Sl. No.',
  'Date',
  'Name of Staff Member',
  'Time Out',
  'Purpose / Place of Visit',
  'Permission Granted By',
  'Time In',
  'Total Time Away (in minutes)',
  'Within 1-Hour Limit (Y/N)',
  'Remarks'
]

const REVIEW_ROW_TONES = { flagged: 'bg-rose-50/60', confirmed: '', pending: '' }

function useRegisterFilters() {
  const [params, setParams] = useSearchParams()
  const defaults = monthBounds(currentMonthIst())
  const filters = {
    from: params.get('from') || defaults.from,
    to: params.get('to') || defaults.to,
    staffId: params.get('staffId') || '',
    withinLimit: params.get('withinLimit') || '',
    review: params.get('review') || '',
    page: Number(params.get('page')) || 1
  }
  const update = (changes) => {
    const next = { ...filters, page: 1, ...changes }
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '' && v !== null)), { replace: true })
  }
  return [filters, update]
}

function Filters({ filters, onChange }) {
  const staff = useStaffList()
  return (
    <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => e.preventDefault()} aria-label="Register filters">
      <div>
        <label htmlFor="f-from" className="label">From</label>
        <input id="f-from" type="date" className="input" value={filters.from} max={filters.to}
          onChange={(e) => e.target.value && onChange({ from: e.target.value })} />
      </div>
      <div>
        <label htmlFor="f-to" className="label">To</label>
        <input id="f-to" type="date" className="input" value={filters.to} min={filters.from}
          onChange={(e) => e.target.value && onChange({ to: e.target.value })} />
      </div>
      <div>
        <label htmlFor="f-staff" className="label">Staff</label>
        <select id="f-staff" className="input" value={filters.staffId} onChange={(e) => onChange({ staffId: e.target.value })}>
          <option value="">Everyone</option>
          {(staff.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-limit" className="label">Within limit</label>
        <select id="f-limit" className="input" value={filters.withinLimit} onChange={(e) => onChange({ withinLimit: e.target.value })}>
          <option value="">Y and N</option>
          <option value="Y">Y only</option>
          <option value="N">N only</option>
        </select>
      </div>
      <div>
        <label htmlFor="f-review" className="label">Review status</label>
        <select id="f-review" className="input" value={filters.review} onChange={(e) => onChange({ review: e.target.value })}>
          <option value="">All</option>
          {Object.entries(REVIEW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
    </form>
  )
}

function RegisterTable({ items, onOpen }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="table-base">
        <thead>
          <tr>{REGISTER_HEADINGS.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id} onClick={() => onOpen(m.id)} className={`cursor-pointer hover:bg-teal-50 ${REVIEW_ROW_TONES[m.review]}`}>
              <td>
                <button type="button" className="font-semibold text-teal-800 underline" onClick={(e) => { e.stopPropagation(); onOpen(m.id) }}
                  aria-label={`Open entry ${m.slNo}: ${m.staffName}, ${REVIEW_LABELS[m.review]}`}>
                  {m.slNo}
                </button>
              </td>
              <td className="whitespace-nowrap">{formatDate(m.timeOut)}</td>
              <td className="whitespace-nowrap">{m.staffName}</td>
              <td className="whitespace-nowrap">{formatTime(m.timeOut)}</td>
              <td className="min-w-48">{purposeAndPlace(m)}</td>
              <td className="whitespace-nowrap">{m.permissionByName}</td>
              <td className="whitespace-nowrap">{m.timeIn ? formatTime(m.timeIn) : ''}</td>
              <td className="text-right tabular-nums">{m.minutesAway ?? ''}</td>
              <td className={`text-center font-semibold ${m.withinLimit === 'N' ? 'text-rose-700' : ''}`}>{m.withinLimit ?? ''}</td>
              <td className="min-w-40">{m.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Register() {
  const [filters, setFilters] = useRegisterFilters()
  const [openId, setOpenId] = useState(null)
  const exporter = useExportRegister()
  const { data, isPending, error, isFetching } = useMovements({
    from: filters.from,
    to: filters.to,
    staffId: filters.staffId,
    withinLimit: filters.withinLimit,
    review: filters.review,
    page: filters.page
  })
  const open = data?.items.find((m) => m.id === openId)

  return (
    <div>
      <PageHeader title="Register">
        {isFetching && !isPending && <span className="self-center text-sm text-slate-500" role="status">Updating…</span>}
        <button type="button" className="btn-secondary" disabled={exporter.isPending}
          onClick={() => exporter.mutate({ from: filters.from, to: filters.to })}>
          {exporter.isPending ? 'Exporting…' : 'Export to Excel'}
        </button>
        <a className="btn-secondary" href={`/admin/register/print?from=${filters.from}&to=${filters.to}`} target="_blank" rel="noopener">
          Print
        </a>
      </PageHeader>
      <ErrorMessage error={exporter.error} className="mb-3" />
      <p className="mb-3 text-sm text-slate-600">Export and print include every entry from {formatDay(filters.from)} to {formatDay(filters.to)}.</p>
      <Filters filters={filters} onChange={setFilters} />

      {isPending ? (
        <Loading lines={6} />
      ) : error ? (
        <ErrorMessage error={error} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No entries">Nothing matches these filters.</EmptyState>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-600">{data.total} {data.total === 1 ? 'entry' : 'entries'} · flagged rows are tinted · select a row for details and corrections</p>
          <RegisterTable items={data.items} onOpen={setOpenId} />
          <Pagination page={filters.page} pageSize={data.pageSize} total={data.total} onChange={(page) => setFilters({ page })} />
        </>
      )}

      {open && <MovementDrawer movement={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}
