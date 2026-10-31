// ADMIN_EMAILS is the only source of truth for admin access.

export function adminEmails(env) {
  return (env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(env, email) {
  if (!email) return false
  return adminEmails(env).includes(email.trim().toLowerCase())
}
