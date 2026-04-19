import { getMondayOfWeek } from './dates'

export function computeAchievements(sessions) {
  if (sessions.length === 0) return []
  const sorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date))
  const results = []

  const add = (icon, dateStr, desc) => {
    const d = new Date(dateStr)
    results.push({ icon, desc, date: d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }), _t: d.getTime() })
  }

  add('🎯', sorted[0].date, 'Primeira sessão de estudo registada')

  let cum = 0
  const hrsMilestones = [[10,'⏱️','10 horas de estudo registadas'],[50,'⏱️','50 horas de estudo registadas'],[100,'💯','100 horas de estudo registadas'],[250,'💯','250 horas de estudo registadas'],[500,'🏆','500 horas de estudo registadas']]
  let mi = 0
  for (const s of sorted) {
    cum += s.hours || 0
    while (mi < hrsMilestones.length && cum >= hrsMilestones[mi][0]) {
      add(hrsMilestones[mi][1], s.date, hrsMilestones[mi][2]); mi++
    }
  }

  const weekMap = {}
  for (const s of sorted) {
    const key = getMondayOfWeek(new Date(s.date)).toDateString()
    if (!weekMap[key]) weekMap[key] = { hours: 0, lastDate: s.date, _t: new Date(key).getTime() }
    weekMap[key].hours += s.hours || 0
    weekMap[key].lastDate = s.date
  }
  const weeksSorted = Object.values(weekMap).sort((a, b) => a._t - b._t)
  for (const [hrs, icon, desc] of [[10,'📅','Primeira semana com 10h de estudo'],[20,'📅','Primeira semana com 20h de estudo'],[30,'🔥','Primeira semana com 30h de estudo']]) {
    const w = weeksSorted.find(w => w.hours >= hrs)
    if (w) add(icon, w.lastDate, desc)
  }

  // Weekly streaks — more honest than daily (one missed Wednesday ≠ losing everything)
  const streakWeekMap = {}
  for (const s of sorted) {
    const k = getMondayOfWeek(new Date(s.date)).toDateString()
    streakWeekMap[k] = (streakWeekMap[k] || 0) + (s.hours || 0)
  }
  const weeklyMin = 5 // hours threshold for a "week that counts"
  const allMondayStrs = [...new Set(sorted.map(s => getMondayOfWeek(new Date(s.date)).toDateString()))]
    .sort((a, b) => new Date(a) - new Date(b))
  let weekRun = 0, prevMon = null, weekAchieved = new Set()
  for (const mStr of allMondayStrs) {
    const d = new Date(mStr)
    const consecutive = prevMon && Math.round((d - prevMon) / (7 * 86400000)) === 1
    weekRun = (streakWeekMap[mStr] || 0) >= weeklyMin ? (consecutive ? weekRun + 1 : 1) : 0
    prevMon = d
    const weekSessions = sorted.filter(s => getMondayOfWeek(new Date(s.date)).toDateString() === mStr)
    const weekLastDate = weekSessions[weekSessions.length - 1]?.date || mStr
    for (const [n, icon, desc] of [
      [2,  '🔥', '2 semanas seguidas de estudo'],
      [4,  '🔥', '4 semanas seguidas — um mês!'],
      [8,  '🔥', '8 semanas seguidas'],
      [12, '🔥', '12 semanas seguidas — comprometida!'],
    ]) {
      if (weekRun >= n && !weekAchieved.has(n)) { weekAchieved.add(n); add(icon, weekLastDate, desc) }
    }
  }

  const long = sorted.find(s => (s.hours || 0) >= 4)
  if (long) add('⚡', long.date, 'Sessão de estudo com 4h ou mais')

  const early = sorted.find(s => s.startTime && new Date(s.startTime).getHours() < 8)
  if (early) add('🌅', early.date, 'Sessão iniciada antes das 8h da manhã')

  const late = sorted.find(s => s.startTime && new Date(s.startTime).getHours() >= 22)
  if (late) add('🌙', late.date, 'Sessão iniciada depois das 22h')

  return results.sort((a, b) => a._t - b._t)
}
