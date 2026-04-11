// ─── Date utilities shared across the app ────────────────────────────────────

/**
 * Returns a local-time YYYY-MM-DD string, avoiding UTC offset issues.
 * Use this instead of d.toISOString().split('T')[0].
 */
export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Returns the Monday of the week containing `date` (local time, hours zeroed).
 */
export function getMondayOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
  d.setDate(d.getDate() + diff)
  return d
}

/**
 * Returns the number of days from today until `dateStr` (YYYY-MM-DD).
 * Negative means the date is in the past.
 */
export function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T12:00:00')
  return Math.round((target - today) / 86400000)
}

/**
 * Returns today's date as a local YYYY-MM-DD string.
 */
export function todayStr() {
  return toDateStr(new Date())
}
