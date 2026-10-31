import { UniqueViolation, isUniqueViolation } from '../lib/errors.js'

// Collects bind values and hands out numbered placeholders (?1, ?2, ...),
// so optional filters can be added without string-building any values into SQL.
export function paramList() {
  const values = []
  const add = (value) => {
    values.push(value)
    return `?${values.length}`
  }
  return { values, add }
}

// Builds "col = ?n, ..." for whitelisted columns only.
export function setClause(fields, allowed, params) {
  return Object.entries(fields).map(([column, value]) => {
    if (!allowed.includes(column)) throw new Error(`Column not allowed: ${column}`)
    return `${column} = ${params.add(value)}`
  })
}

export async function runUnique(fn) {
  try {
    return await fn()
  } catch (err) {
    if (isUniqueViolation(err)) throw new UniqueViolation(err.message)
    throw err
  }
}
