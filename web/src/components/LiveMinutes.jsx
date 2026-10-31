import { minutesTone } from '../lib/format.js'
import { minutesSince } from '../lib/time.js'
import { useNow } from '../lib/useNow.js'

const TONE_CLASSES = {
  ok: 'text-teal-800',
  amber: 'text-amber-700',
  red: 'text-rose-700'
}

// Counts up from Time Out: amber from 10 minutes before the limit, red once past it.
export function LiveMinutes({ since, limit, size = 'sm' }) {
  const now = useNow()
  const minutes = minutesSince(since, now)
  const tone = minutesTone(minutes, limit)
  const big = size === 'lg'

  return (
    <span className={`font-semibold tabular-nums ${TONE_CLASSES[tone]} ${big ? 'text-5xl' : 'text-base'}`}>
      {minutes}
      <span className={big ? 'ml-1 text-xl font-medium' : 'ml-0.5 text-sm font-medium'}> min</span>
      {tone === 'red' && <span className="sr-only"> (over the {limit}-minute limit)</span>}
    </span>
  )
}
