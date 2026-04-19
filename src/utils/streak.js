import { getMondayOfWeek } from './dates'

/**
 * Compute a weekly streak: consecutive weeks where study hours >= weeklyMinHours.
 * The current (possibly incomplete) week counts if it already meets the threshold.
 * A "week" runs Monday–Sunday (European convention, matching the rest of the app).
 */
export function computeWeeklyStreak(sessions, weeklyMinHours = 5) {
  // Sum hours per week (keyed by Monday's toDateString)
  const weekMap = {}
  for (const s of sessions) {
    const k = getMondayOfWeek(new Date(s.date)).toDateString()
    weekMap[k] = (weekMap[k] || 0) + (s.hours || 0)
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const thisMonday = getMondayOfWeek(today)
  const thisMondayStr = thisMonday.toDateString()
  const currentWeekHours = weekMap[thisMondayStr] || 0

  // Count consecutive weeks backwards, including current week if already on target
  let current = currentWeekHours >= weeklyMinHours ? 1 : 0
  const cursor = new Date(thisMonday)
  cursor.setDate(cursor.getDate() - 7)
  while ((weekMap[cursor.toDateString()] || 0) >= weeklyMinHours) {
    current++
    cursor.setDate(cursor.getDate() - 7)
  }

  // Best-ever streak (across all weeks with sessions)
  const allMondayStrs = [...new Set(
    sessions.map(s => getMondayOfWeek(new Date(s.date)).toDateString()),
  )].sort((a, b) => new Date(a) - new Date(b))

  let best = 0, run = 0, prevDate = null
  for (const mStr of allMondayStrs) {
    const d = new Date(mStr)
    const consecutive = prevDate && Math.round((d - prevDate) / (7 * 86400000)) === 1
    run = (weekMap[mStr] || 0) >= weeklyMinHours ? (consecutive ? run + 1 : 1) : 0
    best = Math.max(best, run)
    prevDate = d
  }

  // Total completed weeks (past) where goal was met — "hit count"
  const weeksHit = allMondayStrs
    .filter(k => k !== thisMondayStr)
    .filter(k => (weekMap[k] || 0) >= weeklyMinHours).length

  return {
    current,
    best: Math.max(best, current),
    weeksHit,
    currentWeekHours,
    weeklyMinHours,
  }
}

/**
 * Derive a sensible weekly target (hours) from localStorage data.
 * Falls back to `fallback` if nothing is configured.
 */
export function loadWeeklyTarget(fallback = 10) {
  try {
    const settings = JSON.parse(localStorage.getItem('user-settings') || '{}')
    const targets  = JSON.parse(localStorage.getItem('subject-targets') || '{}')
    const subjects = settings.subjects || []
    const periodEnd = settings.periodEnd
      ? new Date(settings.periodEnd + 'T00:00:00')
      : new Date(Date.now() + 120 * 86400000)
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const weeksLeft = Math.max(1, (periodEnd - now) / (7 * 86400000))
    const defaultPerSubject = (settings.hoursGoal || 550) / Math.max(1, subjects.length)
    const semesterTotal = subjects.reduce((acc, s) => {
      const v = parseFloat(targets[s.key])
      return acc + (isNaN(v) || v <= 0 ? defaultPerSubject : v)
    }, 0)
    const weekly = semesterTotal / weeksLeft
    return Math.max(fallback, Math.round(weekly))
  } catch {
    return fallback
  }
}
