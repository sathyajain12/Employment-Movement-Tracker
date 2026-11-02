import { conflict, forbidden, notFound, UniqueViolation } from '../lib/errors.js'

// Carries one of the login-page error codes (not_registered, inactive, ...).
export class SignInError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

// Active admins in ADMIN_EMAILS order, so the first configured admin is the default approver.
export async function activeAdminsInOrder(staffRepo, admins) {
  const rows = (await staffRepo.listActive()).filter((row) => admins.isAdmin(row.email))
  const rank = (row) => admins.emails.indexOf(row.email.toLowerCase())
  return rows.sort((a, b) => rank(a) - rank(b))
}

export function createStaffService({ staffRepo, admins }) {
  const toDto = (row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    active: row.active === 1,
    isAdmin: admins.isAdmin(row.email),
    hasSignedIn: Boolean(row.google_sub),
    createdAt: row.created_at
  })

  async function withUniqueEmail(fn) {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof UniqueViolation) throw conflict('EMAIL_TAKEN', 'Someone with this email is already registered.')
      throw err
    }
  }

  return {
    // Everyone in the staff table, plus configured admins who haven't signed in yet (their
    // row is only created on first sign-in), so the Staff page shows every admin.
    async list() {
      const rows = (await staffRepo.list()).map(toDto)
      const known = new Set(rows.map((row) => row.email))
      const notYet = admins.emails
        .filter((email) => !known.has(email))
        .map((email) => ({ id: null, name: email, email, active: true, isAdmin: true, hasSignedIn: false, createdAt: null }))
      return [...rows, ...notYet]
    },

    async listAdmins() {
      return (await activeAdminsInOrder(staffRepo, admins)).map((row) => ({ id: row.id, name: row.name }))
    },

    async create({ name, email }) {
      const row = await withUniqueEmail(() => staffRepo.create({ name, email: email.toLowerCase(), role: 'staff' }))
      return toDto(row)
    },

    async update(id, { name, email, active }) {
      const current = await staffRepo.findById(id)
      if (!current) throw notFound('Staff member not found.')
      if (admins.isAdmin(current.email)) {
        throw forbidden('Admin accounts are managed in configuration (ADMIN_EMAILS), not here.')
      }

      const fields = {}
      if (name !== undefined) fields.name = name
      if (active !== undefined) fields.active = active ? 1 : 0
      if (email !== undefined && email.toLowerCase() !== current.email) {
        fields.email = email.toLowerCase()
        // A new address means a different Google account; let it bind on next sign-in.
        fields.google_sub = null
      }
      if (Object.keys(fields).length === 0) return toDto(current)

      return toDto(await withUniqueEmail(() => staffRepo.update(id, fields)))
    },

    // Decides who may sign in. Admins come from config and are created on first sign-in;
    // everyone else must have been added by an admin. `sub` is null for the local dev login,
    // which never binds or checks a Google account.
    async signIn({ email, sub, name }) {
      const normalized = email.trim().toLowerCase()
      const isAdmin = admins.isAdmin(normalized)
      const existing = await staffRepo.findByEmail(normalized)

      if (!existing) {
        if (!isAdmin) throw new SignInError('not_registered')
        return staffRepo.create({ name: name || normalized, email: normalized, role: 'admin', googleSub: sub })
      }

      if (sub && existing.google_sub && existing.google_sub !== sub) throw new SignInError('account_mismatch')
      if (!existing.active && !isAdmin) throw new SignInError('inactive')

      const fields = {}
      if (sub && !existing.google_sub) fields.google_sub = sub
      if (isAdmin && existing.role !== 'admin') fields.role = 'admin'
      if (!isAdmin && existing.role === 'admin') fields.role = 'staff'
      if (isAdmin && !existing.active) fields.active = 1

      if (Object.keys(fields).length === 0) return existing
      return staffRepo.update(existing.id, fields)
    },

    // Used on every request: deactivation and ADMIN_EMAILS changes apply immediately.
    async currentUser(id) {
      const row = await staffRepo.findActiveById(id)
      if (!row) return null
      return { id: row.id, name: row.name, email: row.email, isAdmin: admins.isAdmin(row.email) }
    }
  }
}
