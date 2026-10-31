export const LOGIN_ERRORS = {
  cancelled: 'Sign-in was cancelled. Try again when you are ready.',
  invalid_state: 'Your sign-in session expired. Please try again.',
  google_error: 'Google could not complete the sign-in. Please try again.',
  invalid_token: 'Google returned an unexpected response. Please try again.',
  email_not_verified: 'Your Google email address is not verified.',
  wrong_domain: 'Please sign in with your office Google account.',
  not_registered: "Your account isn't registered yet. Ask the office admin to add you.",
  account_mismatch: 'This email is linked to a different Google account. Ask the office admin for help.',
  inactive: 'Your account has been deactivated. Ask the office admin if this is a mistake.',
  not_configured: 'Google sign-in is not set up on the server yet. Ask the administrator.'
}

export const REVIEW_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  flagged: 'Flagged'
}

export const AUDIT_FIELD_LABELS = {
  time_out: 'Time Out',
  time_in: 'Time In',
  purpose: 'Purpose',
  place: 'Place',
  permission_by: 'Permission granted by',
  remarks: 'Remarks'
}

export function purposeAndPlace(movement) {
  return movement.place ? `${movement.purpose} / ${movement.place}` : movement.purpose
}

const WARNING_BEFORE_LIMIT_MIN = 10

// 'ok' | 'amber' (from 10 minutes before the limit) | 'red' (past the limit)
export function minutesTone(minutes, limit) {
  if (minutes > limit) return 'red'
  if (minutes >= limit - WARNING_BEFORE_LIMIT_MIN) return 'amber'
  return 'ok'
}

export function minutesLabel(minutes) {
  if (minutes === null || minutes === undefined) return '—'
  return `${minutes} min`
}
