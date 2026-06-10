import { getMondayOfWeek } from './dates'

export function computeSubjectAchievements(sessions, exams, topics, diaryEntries, subjectKey, subjectName) {
  const subSessions = [...(sessions || [])]
    .filter(s => s.subject === subjectKey)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  if (subSessions.length === 0) return []

  const results = []
  const todayStr = new Date().toDateString()

  const add = (icon, dateStr, desc) => {
    const d = new Date(dateStr)
    results.push({
      icon, desc,
      date: d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }),
      _t: d.getTime(),
    })
  }

  add('🎯', subSessions[0].date, 'Primeira sessão desta cadeira')

  // Hours milestones
  let cum = 0
  const hrsMilestones = [
    [5,   '⏱️', '5 horas nesta cadeira'],
    [10,  '⏱️', '10 horas nesta cadeira'],
    [25,  '⚡', '25 horas nesta cadeira'],
    [50,  '💯', '50 horas nesta cadeira'],
    [100, '🏆', '100 horas nesta cadeira'],
    [200, '💎', '200 horas nesta cadeira'],
  ]
  let mi = 0
  for (const s of subSessions) {
    cum += s.hours || 0
    while (mi < hrsMilestones.length && cum >= hrsMilestones[mi][0]) {
      add(hrsMilestones[mi][1], s.date, hrsMilestones[mi][2]); mi++
    }
  }

  // Session count milestones
  for (const [n, icon, desc] of [
    [5,  '📅', '5 sessões nesta cadeira'],
    [20, '📅', '20 sessões nesta cadeira'],
    [50, '🏅', '50 sessões nesta cadeira'],
  ]) {
    if (subSessions.length >= n) add(icon, subSessions[n - 1].date, desc)
  }

  // Weekly records
  const weekMap = {}
  for (const s of subSessions) {
    const key = getMondayOfWeek(new Date(s.date)).toDateString()
    if (!weekMap[key]) weekMap[key] = { hours: 0, lastDate: s.date }
    weekMap[key].hours += s.hours || 0
    weekMap[key].lastDate = s.date
  }
  for (const [hrs, icon, desc] of [
    [5,  '📅', 'Semana com 5h nesta cadeira'],
    [10, '📅', 'Semana com 10h nesta cadeira'],
    [15, '🔥', 'Semana com 15h nesta cadeira'],
  ]) {
    const w = Object.values(weekMap).find(w => w.hours >= hrs)
    if (w) add(icon, w.lastDate, desc)
  }

  // Weekly streaks for this subject (≥2h/week threshold)
  const subWeekMap = {}
  for (const s of subSessions) {
    const k = getMondayOfWeek(new Date(s.date)).toDateString()
    subWeekMap[k] = (subWeekMap[k] || 0) + (s.hours || 0)
  }
  const subMondayStrs = [...new Set(subSessions.map(s => getMondayOfWeek(new Date(s.date)).toDateString()))]
    .sort((a, b) => new Date(a) - new Date(b))
  let subWeekRun = 0, prevSubMon = null
  const subWeekAchieved = new Set()
  for (const mStr of subMondayStrs) {
    const d = new Date(mStr)
    const consecutive = prevSubMon && Math.round((d - prevSubMon) / (7 * 86400000)) === 1
    subWeekRun = (subWeekMap[mStr] || 0) >= 2 ? (consecutive ? subWeekRun + 1 : 1) : 0
    prevSubMon = d
    const weekSessions = subSessions.filter(s => getMondayOfWeek(new Date(s.date)).toDateString() === mStr)
    const weekLastDate = weekSessions[weekSessions.length - 1]?.date || mStr
    for (const [n, icon, desc] of [
      [2, '🔥', '2 semanas seguidas nesta cadeira'],
      [4, '🔥', '4 semanas seguidas nesta cadeira'],
      [8, '🔥', '8 semanas seguidas nesta cadeira'],
    ]) {
      if (subWeekRun >= n && !subWeekAchieved.has(n)) { subWeekAchieved.add(n); add(icon, weekLastDate, desc) }
    }
  }

  // Session quality
  const long4 = subSessions.find(s => (s.hours || 0) >= 4)
  if (long4) add('⚡', long4.date, 'Sessão de 4h ou mais nesta cadeira')
  const long6 = subSessions.find(s => (s.hours || 0) >= 6)
  if (long6) add('⚡', long6.date, 'Sessão épica de 6h ou mais!')

  const early = subSessions.find(s => s.startTime && new Date(s.startTime).getHours() < 8)
  if (early) add('🌅', early.date, 'Sessão antes das 8h da manhã')
  const late = subSessions.find(s => s.startTime && new Date(s.startTime).getHours() >= 22)
  if (late) add('🌙', late.date, 'Sessão depois das 22h')

  // Exams
  const subExams = (exams || []).filter(e =>
    e.subject && (e.subject.toLowerCase() === subjectName?.toLowerCase() || e.subject === subjectKey)
  )
  if (subExams.length > 0) {
    const sortedExams = [...subExams].sort((a, b) => new Date(a.date) - new Date(b.date))
    add('🎓', sortedExams[0].date || todayStr, 'Primeiro exame registado nesta cadeira')
    const passed = subExams.find(e => e.actualGrade != null && e.actualGrade >= 10)
    if (passed) add('⭐', passed.date || todayStr, 'Nota positiva no exame')
    const above16 = subExams.find(e => e.actualGrade != null && e.actualGrade >= 16)
    if (above16) add('🏆', above16.date || todayStr, 'Nota acima de 16')
    const above18 = subExams.find(e => e.actualGrade != null && e.actualGrade >= 18)
    if (above18) add('💎', above18.date || todayStr, 'Nota acima de 18 — excelente!')
  }

  // Diary entries
  const subDiary = [...(diaryEntries || [])]
    .filter(e => e.subject === subjectKey)
    .sort((a, b) => a.id - b.id)
  if (subDiary.length >= 1)  add('📝', new Date(subDiary[0].id).toDateString(), 'Primeira entrada no diário desta cadeira')
  if (subDiary.length >= 5)  add('📚', new Date(subDiary[4].id).toDateString(), '5 entradas no diário desta cadeira')
  if (subDiary.length >= 10) add('📚', new Date(subDiary[9].id).toDateString(), '10 entradas no diário desta cadeira')

  // Topics (no real date — anchor to today so they sort last)
  const subTopics = (topics || {})[subjectKey] || (topics || {})[subjectName] || []
  if (subTopics.length >= 1) add('📖', todayStr, 'Primeiro tópico adicionado')
  const goodTopics = subTopics.filter(t => t.confidence === 'good' || t.confidence === 'great')
  if (goodTopics.length >= 5) add('🟢', todayStr, '5 tópicos com boa confiança')
  const greatTopics = subTopics.filter(t => t.confidence === 'great')
  if (greatTopics.length >= 3) add('🌟', todayStr, '3 tópicos completamente dominados')
  if (subTopics.length > 0 && subTopics.every(t => t.confidence === 'good' || t.confidence === 'great')) {
    add('✅', todayStr, 'Todos os tópicos com boa confiança!')
  }

  return results.sort((a, b) => a._t - b._t)
}
