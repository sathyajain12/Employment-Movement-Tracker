import { HTTPException } from 'hono/http-exception'
import { AppError } from '../lib/errors.js'

export function errorHandler(err, c) {
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code }, err.status)
  }
  // e.g. malformed JSON bodies rejected by the validator
  if (err instanceof HTTPException && err.status < 500) {
    return c.json({ error: err.message || 'Bad request.', code: 'BAD_REQUEST' }, err.status)
  }
  console.error(err)
  return c.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' }, 500)
}

export function notFoundHandler(c) {
  return c.json({ error: 'Not found.', code: 'NOT_FOUND' }, 404)
}
