import { runUnique } from './sql.js'

const SELECT = `SELECT r.id, r.staff_id, s.name AS staff_name, r.purpose, r.place,
    r.requested_from, a.name AS requested_from_name, r.status,
    r.decided_by, d.name AS decided_by_name, r.decided_at, r.decision_note,
    r.movement_id, r.created_at, r.category, r.category_other, r.expected_return_at, r.expected_minutes
  FROM permission_requests r
  JOIN staff s ON s.id = r.staff_id
  JOIN staff a ON a.id = r.requested_from
  LEFT JOIN staff d ON d.id = r.decided_by`

export function createRequestRepo(db) {
  const repo = {
    findById(id) {
      return db.prepare(`${SELECT} WHERE r.id = ?1`).bind(id).first()
    },

    findLatestByStaff(staffId) {
      return db.prepare(`${SELECT} WHERE r.staff_id = ?1 ORDER BY r.id DESC LIMIT 1`).bind(staffId).first()
    },

    async listPending() {
      const { results } = await db.prepare(`${SELECT} WHERE r.status = 'pending' ORDER BY r.created_at, r.id`).all()
      return results
    },

    async listByStaffSince(staffId, since) {
      const { results } = await db.prepare(`${SELECT} WHERE r.staff_id = ?1 AND r.created_at >= ?2 ORDER BY r.created_at DESC`)
        .bind(staffId, since)
        .all()
      return results
    },

    // When an admin last changed something about this person's requests or entries
    // (approved, rejected, reviewed), for the "new on My history" dot.
    async lastStatusChange(staffId) {
      const row = await db.prepare(`SELECT MAX(changed) AS at FROM (
            SELECT MAX(decided_at) AS changed FROM permission_requests
              WHERE staff_id = ?1 AND status IN ('approved', 'rejected')
            UNION ALL
            SELECT MAX(reviewed_at) FROM movements WHERE staff_id = ?1)`)
        .bind(staffId)
        .first()
      return row?.at ?? null
    },

    async create({
      staffId, purpose, place, requestedFrom, createdAt,
      category = null, categoryOther = null, expectedReturnAt = null, expectedMinutes = null
    }) {
      const row = await runUnique(() =>
        db.prepare(`INSERT INTO permission_requests
                      (staff_id, purpose, place, requested_from, created_at, category, category_other, expected_return_at, expected_minutes)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) RETURNING id`)
          .bind(staffId, purpose, place, requestedFrom, createdAt, category, categoryOther, expectedReturnAt, expectedMinutes)
          .first()
      )
      return repo.findById(row.id)
    },

    // Approving creates the movement in the same batch. The status guard means only one admin
    // can win; a second approval changes nothing and creates nothing. Returns rows changed.
    async approve(id, { decidedBy, at, expectedReturnAt }) {
      const [decided] = await runUnique(() => db.batch([
        db.prepare(`UPDATE permission_requests SET status = 'approved', decided_by = ?2, decided_at = ?3
                    WHERE id = ?1 AND status = 'pending'`).bind(id, decidedBy, at),
        db.prepare(`INSERT INTO movements (staff_id, time_out, purpose, place, permission_by, category, category_other, expected_return_at)
                    SELECT staff_id, ?2, purpose, place, ?3, category, category_other, ?4 FROM permission_requests
                    WHERE id = ?1 AND status = 'approved' AND movement_id IS NULL`).bind(id, at, decidedBy, expectedReturnAt),
        db.prepare(`UPDATE permission_requests SET movement_id = (
                      SELECT m.id FROM movements m
                      WHERE m.staff_id = permission_requests.staff_id AND m.time_in IS NULL AND m.voided_at IS NULL)
                    WHERE id = ?1 AND status = 'approved' AND movement_id IS NULL`).bind(id)
      ]))
      return decided.meta.changes
    },

    // Reject or cancel; only while still pending. Returns rows changed.
    async close(id, { status, decidedBy, at, note }) {
      const result = await db.prepare(`UPDATE permission_requests
          SET status = ?2, decided_by = ?3, decided_at = ?4, decision_note = ?5
          WHERE id = ?1 AND status = 'pending'`)
        .bind(id, status, decidedBy, at, note)
        .run()
      return result.meta.changes
    },

    // End of day: nobody should come back tomorrow to a request from today.
    async cancelAllPending(at) {
      const { results } = await db.prepare(`UPDATE permission_requests
          SET status = 'cancelled', decided_at = ?1, decision_note = 'Not answered before the office closed'
          WHERE status = 'pending' RETURNING id`)
        .bind(at)
        .all()
      return results.map((row) => row.id)
    }
  }
  return repo
}
