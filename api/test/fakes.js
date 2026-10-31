import { UniqueViolation } from '../src/lib/errors.js'
import { minutesBetween } from '../src/lib/time.js'
import { createMovementService } from '../src/services/movementService.js'
import { createStaffService } from '../src/services/staffService.js'

export const ADMIN_EMAILS = ['boss@example.com', 'deputy@example.com']

export const fakeAdmins = {
  emails: ADMIN_EMAILS,
  isAdmin: (email) => ADMIN_EMAILS.includes(email.trim().toLowerCase())
}

export function fakeStaffRepo(seed = []) {
  const rows = seed.map((row) => ({ active: 1, role: 'staff', google_sub: null, created_at: '2026-10-01T00:00:00Z', ...row }))
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1
  return {
    rows,
    findById: async (id) => rows.find((r) => r.id === id) ?? null,
    findActiveById: async (id) => rows.find((r) => r.id === id && r.active === 1) ?? null,
    findByEmail: async (email) => rows.find((r) => r.email === email) ?? null,
    list: async () => [...rows],
    listActive: async () => rows.filter((r) => r.active === 1),
    async create({ name, email, role = 'staff', googleSub = null }) {
      if (rows.some((r) => r.email === email)) throw new UniqueViolation('UNIQUE constraint failed: staff.email')
      const row = { id: nextId++, name, email, role, google_sub: googleSub, active: 1, created_at: '2026-10-01T00:00:00Z' }
      rows.push(row)
      return row
    },
    async update(id, fields) {
      const row = rows.find((r) => r.id === id)
      Object.assign(row, fields)
      return row
    }
  }
}

// Mirrors movementRepo's derived columns: whole minutes, and Y when minutes <= limit.
export function fakeMovementRepo(staffRepo) {
  const rows = []
  const audit = []
  let nextId = 1

  const derive = (row, limitMin) => {
    const minutes = row.time_in ? minutesBetween(row.time_out, row.time_in) : null
    const staff = staffRepo.rows.find((s) => s.id === row.staff_id)
    const approver = staffRepo.rows.find((s) => s.id === row.permission_by)
    return {
      ...row,
      staff_name: staff?.name,
      permission_by_name: approver?.name,
      minutes_away: minutes,
      within_limit: minutes === null ? null : minutes <= limitMin ? 'Y' : 'N'
    }
  }
  const apply = (id, fields) => Object.assign(rows.find((r) => r.id === id), fields)

  return {
    rows,
    audit,
    findById: async (id, limitMin) => {
      const row = rows.find((r) => r.id === id)
      return row ? derive(row, limitMin) : null
    },
    findOpenByStaff: async (staffId, limitMin) => {
      const row = rows.find((r) => r.staff_id === staffId && !r.time_in)
      return row ? derive(row, limitMin) : null
    },
    async create({ staffId, timeOut, purpose, place, permissionBy }, limitMin) {
      if (rows.some((r) => r.staff_id === staffId && !r.time_in)) {
        throw new UniqueViolation('UNIQUE constraint failed: movements.staff_id')
      }
      const row = {
        id: nextId++, staff_id: staffId, time_out: timeOut, purpose, place, permission_by: permissionBy,
        time_in: null, review: 'pending', reviewed_at: null, remarks: null, updated_at: null
      }
      rows.push(row)
      return derive(row, limitMin)
    },
    async setTimeIn(id, timeIn) {
      const row = rows.find((r) => r.id === id && !r.time_in)
      if (!row) return 0
      row.time_in = timeIn
      return 1
    },
    async updateDetailsWhileOpen(id, { purpose, place }, updatedAt) {
      const row = rows.find((r) => r.id === id && !r.time_in && r.review === 'pending')
      if (!row) return 0
      Object.assign(row, { purpose, place, updated_at: updatedAt })
      return 1
    },
    update: async (id, fields) => { apply(id, fields) },
    updateMany: async (changes) => { changes.forEach(({ id, fields }) => apply(id, fields)) },
    async updateWithAudit(id, fields, auditRows) {
      apply(id, fields)
      audit.push(...auditRows)
    },
    async listByStaff(staffId, { limitMin }) {
      const mine = rows.filter((r) => r.staff_id === staffId).map((r) => derive(r, limitMin))
      return { rows: mine.reverse(), total: mine.length }
    },
    listOpen: async (limitMin) => rows.filter((r) => !r.time_in).map((r) => derive(r, limitMin))
  }
}

export const fakeSettings = (overrides = {}) => ({
  get: async () => ({ timeLimitMin: 60, graceMin: 10, officeClose: '17:30', ...overrides })
})

// A controllable server clock.
export function fakeClock(start) {
  let current = Date.parse(start)
  const clock = () => new Date(current).toISOString().replace(/\.\d{3}Z$/, 'Z')
  clock.advanceMinutes = (m) => { current += m * 60000 }
  clock.set = (iso) => { current = Date.parse(iso) }
  return clock
}

export function setup({ now = '2026-10-31T04:30:00Z', settings } = {}) {
  const staffRepo = fakeStaffRepo([
    { id: 1, name: 'Boss', email: 'boss@example.com', role: 'admin' },
    { id: 2, name: 'Asha', email: 'asha@example.com' },
    { id: 3, name: 'Ravi', email: 'ravi@example.com' },
    { id: 4, name: 'Old Admin', email: 'former@example.com', role: 'admin' }
  ])
  const movementRepo = fakeMovementRepo(staffRepo)
  const auditRepo = { listForMovement: async (id) => movementRepo.audit.filter((a) => a.movementId === id) }
  const clock = fakeClock(now)
  const notifications = []
  const service = createMovementService({
    movementRepo,
    staffRepo,
    auditRepo,
    settingsService: fakeSettings(settings),
    admins: fakeAdmins,
    now: clock,
    notify: async (event) => { notifications.push(event) }
  })
  const staffService = createStaffService({ staffRepo, admins: fakeAdmins })
  return { service, staffService, staffRepo, movementRepo, clock, notifications }
}

export const boss = { id: 1, name: 'Boss', email: 'boss@example.com', isAdmin: true }
export const asha = { id: 2, name: 'Asha', email: 'asha@example.com', isAdmin: false }
export const ravi = { id: 3, name: 'Ravi', email: 'ravi@example.com', isAdmin: false }
