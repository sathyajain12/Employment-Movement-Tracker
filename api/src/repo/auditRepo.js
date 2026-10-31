export function createAuditRepo(db) {
  return {
    // Returned unexecuted so movementRepo can batch it with the change it describes.
    insertStatement({ movementId, field, oldValue, newValue, reason, changedBy, changedAt }) {
      return db
        .prepare(`INSERT INTO movement_audit (movement_id, field, old_value, new_value, reason, changed_by, changed_at)
                  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
        .bind(movementId, field, oldValue, newValue, reason, changedBy, changedAt)
    },

    async listForMovement(movementId) {
      const { results } = await db
        .prepare(`SELECT a.id, a.field, a.old_value, a.new_value, a.reason, a.changed_at,
                         a.changed_by, s.name AS changed_by_name
                  FROM movement_audit a JOIN staff s ON s.id = a.changed_by
                  WHERE a.movement_id = ?1
                  ORDER BY a.changed_at DESC, a.id DESC`)
        .bind(movementId)
        .all()
      return results
    }
  }
}
