import { buildServices } from '../services/index.js'

// Every 10 minutes, 03:00–12:50 UTC (08:30–18:20 IST), Monday–Saturday. Must match wrangler.jsonc.
export const OVERDUE_CRON = '*/10 3-12 * * 1-6'

export async function runOverdueCheck(env) {
  const ids = await buildServices(env).movements.markOverdue()
  console.log(`[cron] overdue check: marked ${ids.length} movement(s)`)
  return ids
}
