import { REVIEW_LABELS } from '../lib/format.js'

const TONES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-300',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-300',
  amber: 'bg-amber-50 text-amber-900 ring-amber-300',
  red: 'bg-rose-50 text-rose-800 ring-rose-300',
  blue: 'bg-sky-50 text-sky-800 ring-sky-300'
}

export function Badge({ tone = 'neutral', children, title }) {
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  )
}

const REVIEW_TONES = { pending: 'blue', confirmed: 'green', flagged: 'red' }

export function ReviewBadge({ review }) {
  return <Badge tone={REVIEW_TONES[review]}>{REVIEW_LABELS[review]}</Badge>
}

export function LimitBadge({ withinLimit }) {
  if (!withinLimit) return <Badge>—</Badge>
  return withinLimit === 'Y'
    ? <Badge tone="green" title="Within the time limit">Y</Badge>
    : <Badge tone="red" title="Over the time limit">N</Badge>
}

export function CountBadge({ count, tone = 'neutral', label }) {
  if (!count) return null
  return (
    <span aria-label={label} className={`ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${tone === 'red' ? 'bg-rose-600 text-white' : 'bg-teal-100 text-teal-900'}`}>
      {count}
    </span>
  )
}
