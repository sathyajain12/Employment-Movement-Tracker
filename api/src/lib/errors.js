export class AppError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

// Thrown by repositories when a UNIQUE constraint or index rejects a write.
export class UniqueViolation extends Error {}

export function isUniqueViolation(err) {
  return /UNIQUE constraint failed/i.test(err?.message || '')
}

export const badRequest = (code, message) => new AppError(400, code, message)
export const forbidden = (message = 'You do not have access to this.') => new AppError(403, 'FORBIDDEN', message)
export const notFound = (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message)
export const conflict = (code, message) => new AppError(409, code, message)
export const unprocessable = (code, message) => new AppError(422, code, message)
