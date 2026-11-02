import { buildServices } from '../services/index.js'

// 12:00 UTC = 17:30 IST, Monday–Saturday. Must match wrangler.jsonc.
export const END_OF_DAY_CRON = '0 12 * * 1-6'

export async function runEndOfDay(env) {
  const services = buildServices(env)
  const ids = await services.movements.closeEndOfDay()
  const requestIds = await services.requests.cancelAllPending()
  console.log(`[cron] end of day: ${ids.length} movement(s) without Time In, ${requestIds.length} unanswered request(s) cancelled`)
  return ids
}
