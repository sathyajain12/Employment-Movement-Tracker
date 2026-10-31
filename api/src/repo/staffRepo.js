import { paramList, setClause, runUnique } from './sql.js'

const COLUMNS = 'id, name, email, role, google_sub, active, created_at'
const UPDATABLE = ['name', 'email', 'role', 'google_sub', 'active']

export function createStaffRepo(db) {
  return {
    findById(id) {
      return db.prepare(`SELECT ${COLUMNS} FROM staff WHERE id = ?1`).bind(id).first()
    },

    findActiveById(id) {
      return db.prepare(`SELECT ${COLUMNS} FROM staff WHERE id = ?1 AND active = 1`).bind(id).first()
    },

    findByEmail(email) {
      return db.prepare(`SELECT ${COLUMNS} FROM staff WHERE email = ?1`).bind(email).first()
    },

    async list() {
      const { results } = await db.prepare(`SELECT ${COLUMNS} FROM staff ORDER BY name COLLATE NOCASE`).all()
      return results
    },

    async listActive() {
      const { results } = await db
        .prepare(`SELECT ${COLUMNS} FROM staff WHERE active = 1 ORDER BY name COLLATE NOCASE`)
        .all()
      return results
    },

    create({ name, email, role = 'staff', googleSub = null }) {
      return runUnique(() =>
        db.prepare(`INSERT INTO staff (name, email, role, google_sub) VALUES (?1, ?2, ?3, ?4) RETURNING ${COLUMNS}`)
          .bind(name, email, role, googleSub)
          .first()
      )
    },

    update(id, fields) {
      const params = paramList()
      const sets = setClause(fields, UPDATABLE, params)
      const idParam = params.add(id)
      return runUnique(() =>
        db.prepare(`UPDATE staff SET ${sets.join(', ')} WHERE id = ${idParam} RETURNING ${COLUMNS}`)
          .bind(...params.values)
          .first()
      )
    }
  }
}
