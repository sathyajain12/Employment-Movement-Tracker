import { paramList, setClause, runUnique } from './sql.js'

// Derived columns are never stored. unixepoch() integer arithmetic is used instead of
// julianday() so an exact 60:00 never rounds down to 59 through floating-point error.
const MINUTES = '((unixepoch(m.time_in) - unixepoch(m.time_out)) / 60)'

const columns = (limitParam) => `
  m.id, m.staff_id, s.name AS staff_name, s.email AS staff_email,
  m.time_out, m.purpose, m.place, m.permission_by, p.name AS permission_by_name,
  m.time_in, m.review, m.reviewed_at, m.remarks, m.created_at, m.updated_at,
  CASE WHEN m.time_in IS NULL THEN NULL ELSE ${MINUTES} END AS minutes_away,
  CASE WHEN m.time_in IS NULL THEN NULL
       WHEN ${MINUTES} <= ${limitParam} THEN 'Y'
       ELSE 'N' END AS within_limit`

const FROM = `FROM movements m
  JOIN staff s ON s.id = m.staff_id
  JOIN staff p ON p.id = m.permission_by`

const UPDATABLE = ['time_out', 'time_in', 'purpose', 'place', 'permission_by', 'remarks', 'review', 'reviewed_at', 'updated_at']

const where = (conditions) => (conditions.length ? `WHERE ${conditions.join(' AND ')}` : '')

// Open, started today (IST) and not yet closed by the end-of-day job.
function currentlyOutSql(params, prefix, { todayStart, closedRemark }) {
  return `(${prefix}time_in IS NULL
    AND ${prefix}time_out >= ${params.add(todayStart)}
    AND instr(COALESCE(${prefix}remarks, ''), ${params.add(closedRemark)}) = 0)`
}

export function createMovementRepo(db, auditRepo) {
  async function all(sql, values) {
    const { results } = await db.prepare(sql).bind(...values).all()
    return results
  }

  function updateStatement(id, fields) {
    const params = paramList()
    const sets = setClause(fields, UPDATABLE, params)
    return db.prepare(`UPDATE movements SET ${sets.join(', ')} WHERE id = ${params.add(id)}`).bind(...params.values)
  }

  const repo = {
    findById(id, limitMin) {
      const p = paramList()
      const sql = `SELECT ${columns(p.add(limitMin))} ${FROM} WHERE m.id = ${p.add(id)}`
      return db.prepare(sql).bind(...p.values).first()
    },

    findOpenByStaff(staffId, limitMin) {
      const p = paramList()
      const sql = `SELECT ${columns(p.add(limitMin))} ${FROM} WHERE m.staff_id = ${p.add(staffId)} AND m.time_in IS NULL`
      return db.prepare(sql).bind(...p.values).first()
    },

    async create({ staffId, timeOut, purpose, place, permissionBy }, limitMin) {
      const row = await runUnique(() =>
        db.prepare(`INSERT INTO movements (staff_id, time_out, purpose, place, permission_by)
                    VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id`)
          .bind(staffId, timeOut, purpose, place, permissionBy)
          .first()
      )
      return repo.findById(row.id, limitMin)
    },

    // Only touches the row while it is still open, so two "I'm back" taps can't both win.
    async setTimeIn(id, timeIn) {
      const result = await db.prepare('UPDATE movements SET time_in = ?1, updated_at = ?1 WHERE id = ?2 AND time_in IS NULL')
        .bind(timeIn, id)
        .run()
      return result.meta.changes
    },

    async updateDetailsWhileOpen(id, { purpose, place }, updatedAt) {
      const result = await db.prepare(`UPDATE movements SET purpose = ?1, place = ?2, updated_at = ?3
                                       WHERE id = ?4 AND time_in IS NULL AND review = 'pending'`)
        .bind(purpose, place, updatedAt, id)
        .run()
      return result.meta.changes
    },

    async update(id, fields) {
      await runUnique(() => updateStatement(id, fields).run())
    },

    async updateMany(changes) {
      if (changes.length === 0) return
      await db.batch(changes.map(({ id, fields }) => updateStatement(id, fields)))
    },

    // The change and its audit rows succeed or fail together.
    async updateWithAudit(id, fields, auditRows) {
      await runUnique(() => db.batch([
        updateStatement(id, fields),
        ...auditRows.map((row) => auditRepo.insertStatement(row))
      ]))
    },

    async listByStaff(staffId, { limitMin, limit, offset }) {
      const p = paramList()
      const lim = p.add(limitMin)
      const staff = p.add(staffId)
      const [count, rows] = await db.batch([
        db.prepare('SELECT COUNT(*) AS total FROM movements WHERE staff_id = ?1').bind(staffId),
        db.prepare(`SELECT ${columns(lim)} ${FROM} WHERE m.staff_id = ${staff}
                    ORDER BY m.time_out DESC, m.id DESC LIMIT ${p.add(limit)} OFFSET ${p.add(offset)}`)
          .bind(...p.values)
      ])
      return { total: count.results[0].total, rows: rows.results }
    },

    listOpen(limitMin) {
      const p = paramList()
      const sql = `SELECT ${columns(p.add(limitMin))} ${FROM} WHERE m.time_in IS NULL ORDER BY m.time_out`
      return all(sql, p.values)
    },

    listCurrentlyOut({ limitMin, todayStart, closedRemark }) {
      const p = paramList()
      const cols = columns(p.add(limitMin))
      const sql = `SELECT ${cols} ${FROM}
                   WHERE ${currentlyOutSql(p, 'm.', { todayStart, closedRemark })}
                   ORDER BY m.time_out`
      return all(sql, p.values)
    },

    // Register-style search. Sl. No. is numbered over the date range before the other filters apply.
    async search(filters, { limitMin, limit, offset, todayStart, closedRemark }) {
      const p = paramList()
      const cols = columns(p.add(limitMin))

      const range = []
      if (filters.start) range.push(`m.time_out >= ${p.add(filters.start)}`)
      if (filters.end) range.push(`m.time_out < ${p.add(filters.end)}`)

      const conditions = []
      if (filters.staffId) conditions.push(`staff_id = ${p.add(filters.staffId)}`)
      if (filters.review) conditions.push(`review = ${p.add(filters.review)}`)
      if (filters.withinLimit) conditions.push(`within_limit = ${p.add(filters.withinLimit)}`)
      if (filters.queue) {
        conditions.push(`review = 'pending' AND NOT ${currentlyOutSql(p, '', { todayStart, closedRemark })}`)
      }

      const cte = `WITH reg AS (
        SELECT ROW_NUMBER() OVER (ORDER BY m.time_out, m.id) AS sl_no, ${cols}
        ${FROM} ${where(range)})`
      const filterValues = [...p.values]
      const rowsSql = `${cte} SELECT * FROM reg ${where(conditions)}
                       ORDER BY time_out, id LIMIT ${p.add(limit)} OFFSET ${p.add(offset)}`

      const [count, rows] = await db.batch([
        db.prepare(`${cte} SELECT COUNT(*) AS total FROM reg ${where(conditions)}`).bind(...filterValues),
        db.prepare(rowsSql).bind(...p.values)
      ])
      return { total: count.results[0].total, rows: rows.results }
    },

    register({ start, end, limitMin }) {
      const p = paramList()
      const cols = columns(p.add(limitMin))
      const sql = `SELECT ROW_NUMBER() OVER (ORDER BY m.time_out, m.id) AS sl_no, ${cols} ${FROM}
                   WHERE m.time_out >= ${p.add(start)} AND m.time_out < ${p.add(end)}
                   ORDER BY m.time_out, m.id`
      return all(sql, p.values)
    },

    monthlySummary({ start, end, limitMin }) {
      return all(`
        SELECT s.id AS staff_id, s.name, s.active,
          COUNT(m.id) AS outings,
          COALESCE(SUM(CASE WHEN m.time_in IS NOT NULL THEN ${MINUTES} END), 0) AS total_minutes,
          COALESCE(SUM(CASE WHEN m.time_in IS NOT NULL AND ${MINUTES} > ?1 THEN 1 ELSE 0 END), 0) AS over_limit,
          COALESCE(SUM(CASE WHEN m.review = 'flagged' THEN 1 ELSE 0 END), 0) AS flagged,
          COALESCE(SUM(CASE WHEN m.id IS NOT NULL AND m.time_in IS NULL THEN 1 ELSE 0 END), 0) AS no_time_in
        FROM staff s
        LEFT JOIN movements m ON m.staff_id = s.id AND m.time_out >= ?2 AND m.time_out < ?3
        GROUP BY s.id
        HAVING s.active = 1 OR COUNT(m.id) > 0
        ORDER BY s.name COLLATE NOCASE`, [limitMin, start, end])
    },

    counts({ now, todayStart, closedRemark, overdueAfterMin }) {
      const p = paramList()
      const outNow = currentlyOutSql(p, '', { todayStart, closedRemark })
      const sql = `SELECT
        (SELECT COUNT(*) FROM movements WHERE review = 'pending' AND NOT ${outNow}) AS pending_review,
        (SELECT COUNT(*) FROM movements WHERE ${outNow}) AS out_now,
        (SELECT COUNT(*) FROM movements WHERE ${outNow}
           AND (unixepoch(${p.add(now)}) - unixepoch(time_out)) / 60 > ${p.add(overdueAfterMin)}) AS overdue_now`
      return db.prepare(sql).bind(...p.values).first()
    }
  }

  return repo
}
