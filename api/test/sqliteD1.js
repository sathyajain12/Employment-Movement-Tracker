import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

// node:sqlite does not bind ?NNN positionally (D1 does), so expand them into plain ? in order.
function expand(sql, values) {
  const ordered = []
  const text = sql.replace(/\?(\d+)/g, (_, n) => {
    ordered.push(values[Number(n) - 1])
    return '?'
  })
  return { text, ordered }
}

// Just enough of the D1 API (prepare/bind/first/all/run/batch) to run the real
// repositories and migrations against an in-memory SQLite database.
export function createTestD1() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON') // D1 enforces foreign keys
  const dir = new URL('../migrations/', import.meta.url)
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(file, dir), 'utf8'))
  }

  const statement = (rawSql, rawValues = []) => {
    const { text, ordered } = expand(rawSql, rawValues)
    const prepared = () => sqlite.prepare(text)
    return {
      bind: (...next) => statement(rawSql, next),
      first: async () => prepared().get(...ordered) ?? null,
      all: async () => ({ results: prepared().all(...ordered) }),
      run: async () => ({ meta: { changes: Number(prepared().run(...ordered).changes) } }),
      exec: () => /^\s*(SELECT|WITH)|RETURNING/i.test(text)
        ? { results: prepared().all(...ordered) }
        : { results: [], meta: { changes: Number(prepared().run(...ordered).changes) } }
    }
  }

  return {
    sqlite,
    prepare: (sql) => statement(sql),
    async batch(statements) {
      sqlite.exec('BEGIN')
      try {
        const results = statements.map((s) => s.exec())
        sqlite.exec('COMMIT')
        return results
      } catch (err) {
        sqlite.exec('ROLLBACK')
        throw err
      }
    }
  }
}
