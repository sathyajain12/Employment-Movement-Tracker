import { Link, useSearchParams } from 'react-router'
import { useRegister } from '../../api/hooks.js'
import { EmptyState, ErrorMessage, Loading } from '../../components/Feedback.jsx'
import { formatDateTime, formatDay } from '../../lib/time.js'

const OFFICE_NAME = import.meta.env.VITE_OFFICE_NAME || 'Office'
const RIGHT_ALIGNED = new Set([0, 7])
const CENTERED = new Set([8])

// Plain, print-first table. Page size, orientation and page numbers come from the
// @media print rules in index.css.
export default function PrintRegister() {
  const [params] = useSearchParams()
  const from = params.get('from')
  const to = params.get('to')
  const { data, isPending, error } = useRegister(from, to)

  return (
    <div className="mx-auto max-w-[1400px] bg-white p-4 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" className="btn-primary" onClick={() => window.print()} disabled={!data}>Print</button>
        <Link to={`/admin/register?from=${from}&to=${to}`} className="btn-secondary">Back to register</Link>
        <span className="text-sm text-slate-500">Prints on A4 landscape with page numbers.</span>
      </div>

      <header className="mb-3 text-center">
        <p className="text-base font-semibold">{OFFICE_NAME} — Staff Movement Register</p>
        {from && to && <p className="text-sm">Period: {formatDay(from)} to {formatDay(to)}</p>}
      </header>

      {!from || !to ? (
        <ErrorMessage error={{ message: 'Choose a date range on the Register page first.' }} />
      ) : isPending ? (
        <Loading lines={6} />
      ) : error ? (
        <ErrorMessage error={error} />
      ) : data.rows.length === 0 ? (
        <EmptyState title="No entries in this period" />
      ) : (
        <>
          <table className="print-table w-full border-collapse text-[11px] leading-snug">
            <thead>
              <tr>
                {data.columns.map((heading) => (
                  <th key={heading} scope="col" className="border border-slate-700 bg-slate-100 px-1.5 py-1 text-left align-bottom font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => (
                    <td
                      key={data.columns[i]}
                      className={`border border-slate-500 px-1.5 py-1 align-top ${RIGHT_ALIGNED.has(i) ? 'text-right tabular-nums' : ''} ${CENTERED.has(i) ? 'text-center' : ''}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-slate-600">
            {data.rows.length} entries · times in IST · printed {formatDateTime(new Date().toISOString())}
          </p>
        </>
      )}
    </div>
  )
}
