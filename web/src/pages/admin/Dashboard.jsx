import { useActiveMovements } from '../../api/hooks.js'
import { Badge } from '../../components/Badge.jsx'
import { EmptyState, ErrorMessage, Loading, PageHeader } from '../../components/Feedback.jsx'
import { LiveMinutes } from '../../components/LiveMinutes.jsx'
import { minutesTone, purposeAndPlace } from '../../lib/format.js'
import { formatTime, minutesSince } from '../../lib/time.js'
import { useNow } from '../../lib/useNow.js'

const ROW_TONES = {
  ok: 'border-slate-200 bg-white',
  amber: 'border-amber-300 bg-amber-50',
  red: 'border-rose-300 bg-rose-50'
}

function OutRow({ movement, limit, now }) {
  const tone = minutesTone(minutesSince(movement.timeOut, now), limit)
  return (
    <li className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 shadow-sm ${ROW_TONES[tone]}`}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-semibold">
          {movement.staffName}
          {tone === 'red' && <Badge tone="red">Over limit</Badge>}
        </p>
        <p className="truncate text-sm text-slate-700">{purposeAndPlace(movement)}</p>
        <p className="text-xs text-slate-500">Out at {formatTime(movement.timeOut)} · permission by {movement.permissionByName}</p>
      </div>
      <LiveMinutes since={movement.timeOut} limit={limit} />
    </li>
  )
}

export default function Dashboard() {
  const { data, isPending, error, dataUpdatedAt } = useActiveMovements()
  const now = useNow()

  return (
    <div>
      <PageHeader title="Out right now">
        {data && <span className="text-sm text-slate-500">Updated {formatTime(new Date(dataUpdatedAt).toISOString())} · refreshes every 30 s</span>}
      </PageHeader>
      {isPending ? (
        <Loading lines={4} />
      ) : error ? (
        <ErrorMessage error={error} />
      ) : data.items.length === 0 ? (
        <EmptyState title="Everyone is in the office">No one has an open movement right now.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.items.map((m) => <OutRow key={m.id} movement={m} limit={data.timeLimitMin} now={now} />)}
        </ul>
      )}
    </div>
  )
}
