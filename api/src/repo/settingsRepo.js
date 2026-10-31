export function createSettingsRepo(db) {
  return {
    async all() {
      const { results } = await db.prepare('SELECT key, value FROM settings').all()
      return Object.fromEntries(results.map((row) => [row.key, row.value]))
    },

    async setMany(entries) {
      const upsert = db.prepare(
        'INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      await db.batch(Object.entries(entries).map(([key, value]) => upsert.bind(key, String(value))))
    }
  }
}
