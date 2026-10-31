import { useState } from 'react'
import { useMonthly } from '../../api/hooks.js'
import { EmptyState, ErrorMessage, Loading, PageHeader } from '../../components/Feedback.jsx'
import { currentMonthIst } from '../../lib/time.js'

const COLUMNS = [
  ['outings', 'Outings'],
  ['totalMinutes', 'Total minutes'],
  ['overLimit', 'Over limit'],
  ['flagged', 'Flagged'],
  ['noTimeIn', 'No Time In']
]

export default function Monthly() {
  const [month, setMonth] = useState(currentMonthIst())
  const { data, isPending, error } = useMonthly(month)

  const totals = Object.fromEntries(COLUMNS.map(([key]) => [key, (data?.items ?? []).reduce((sum, row) => sum + row[key], 0)]))

  return (
    <div>
      <PageHeader title="Monthly summary">
        <div>
          <label htmlFor="month" className="sr-only">Month</label>
          <input id="month" type="month" className="input" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </div>
      </PageHeader>

      {isPending ? (
        <Loading lines={5} />
      ) : error ? (
        <ErrorMessage error={error} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No staff yet">Add staff members to see their monthly summary.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="table-base">
            <caption className="px-3 py-2 text-left text-sm text-slate-500">Over limit means more than {data.timeLimitMin} minutes away.</caption>
            <thead>
              <tr>
                <th scope="col">Staff member</th>
                {COLUMNS.map(([key, label]) => <th key={key} scope="col" className="text-right">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.staffId}>
                  <th scope="row" className="font-medium">
                    {row.name}{!row.active && <span className="ml-2 text-xs text-slate-500">(inactive)</span>}
                  </th>
                  {COLUMNS.map(([key]) => (
                    <td key={key} className={`text-right tabular-nums ${key === 'overLimit' && row[key] ? 'font-semibold text-rose-700' : ''}`}>
                      {row[key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <th scope="row" className="px-3 py-2">Total</th>
                {COLUMNS.map(([key]) => <td key={key} className="px-3 py-2 text-right tabular-nums">{totals[key]}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
