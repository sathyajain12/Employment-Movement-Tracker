import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { badRequest } from './errors.js'
import { toIso } from './time.js'

// Wraps zValidator so every validation failure uses the app's error shape.
export const validate = (target, schema) =>
  zValidator(target, schema, (result) => {
    if (result.success) return
    const issue = result.error.issues[0]
    const field = issue.path.join('.')
    throw badRequest('VALIDATION_ERROR', field ? `${field}: ${issue.message}` : issue.message)
  })

const requiredText = (label, max) =>
  z.string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`)

// Optional text where an empty string means "clear it" (null) and a missing key means "leave it".
const clearableText = (label, max) =>
  z.string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .transform((v) => v || null)
    .nullable()
    .optional()

const id = z.coerce.number().int().positive()

const isRealDay = (value) => {
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value)
}
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').refine(isRealDay, 'Not a real date.')
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM.')
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour).')
const timestamp = z.iso.datetime({ offset: true, error: 'Use an ISO 8601 date-time.' }).transform(toIso)
const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.').max(254))
const reviewDecision = z.enum(['confirmed', 'flagged'])
const page = z.coerce.number().int().min(1).max(10000).default(1)

const MAX_RANGE_DAYS = 366
const rangeOk = ({ from, to }) => !from || !to || from <= to
const rangeShortEnough = ({ from, to }) =>
  !from || !to || (Date.parse(to) - Date.parse(from)) / 86400000 < MAX_RANGE_DAYS

export const schemas = {
  idParam: z.object({ id }),

  page: z.object({ page }),

  timeOut: z.object({
    purpose: requiredText('Purpose', 200),
    place: clearableText('Place', 120),
    permissionBy: id
  }),

  details: z.object({
    purpose: requiredText('Purpose', 200),
    place: clearableText('Place', 120)
  }),

  review: z.object({
    review: reviewDecision,
    remark: clearableText('Remark', 300)
  }),

  bulkReview: z.object({
    ids: z.array(id).min(1, 'Select at least one entry.').max(200),
    review: reviewDecision
  }),

  correction: z.object({
    timeOut: timestamp.optional(),
    timeIn: timestamp.optional(),
    purpose: requiredText('Purpose', 200).optional(),
    place: clearableText('Place', 120),
    permissionBy: id.optional(),
    remarks: clearableText('Remarks', 300),
    reason: requiredText('Reason', 300)
  }),

  movementsQuery: z.object({
    from: day.optional(),
    to: day.optional(),
    staffId: id.optional(),
    review: z.enum(['pending', 'confirmed', 'flagged']).optional(),
    withinLimit: z.enum(['Y', 'N']).optional(),
    queue: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    page
  })
    .refine(rangeOk, '"from" must not be after "to".')
    .refine(rangeShortEnough, `Date range can be at most ${MAX_RANGE_DAYS} days.`),

  range: z.object({ from: day, to: day })
    .refine(rangeOk, '"from" must not be after "to".')
    .refine(rangeShortEnough, `Date range can be at most ${MAX_RANGE_DAYS} days.`),

  month: z.object({ month }),

  staffCreate: z.object({
    name: requiredText('Name', 100),
    email
  }),

  staffUpdate: z.object({
    name: requiredText('Name', 100).optional(),
    email: email.optional(),
    active: z.boolean().optional()
  }).refine((v) => Object.keys(v).length > 0, 'Nothing to update.'),

  settings: z.object({
    timeLimitMin: z.number().int().min(1).max(600),
    graceMin: z.number().int().min(0).max(240),
    officeClose: hhmm
  })
}
