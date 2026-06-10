import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { getMondayOfWeek } from '../utils/dates'
import { computeAchievements } from '../utils/achievements'
import { computeWeeklyStreak, loadWeeklyTarget } from '../utils/streak'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

function loadSessions() {
  try { return JSON.parse(localStorage.getItem('study-sessions')) || [] } catch { return [] }
}

function formatDate(d) {
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

export default function StatsPage({ settings, onOpenCadeira }) {
  const [range, setRange] = useState('8w') // '8w' | '3m' | 'all'
  const [moodView, setMoodView] = useState('dist') // 'dist' | 'corr'
  const [showAch, setShowAch] = useState(false)
  const subjects = (settings?.subjects || []).filter(s => !s.closed)
  const [sessions] = useState(loadSessions)

  // ── Weekly bar chart data ──────────────────────────────────────────────
  const weeklyData = useMemo(() => {
    const numWeeks = range === '8w' ? 8 : range === '3m' ? 12 : 24
    const weeks = []
    const now = getMondayOfWeek(new Date())
    for (let i = numWeeks - 1; i >= 0; i--) {
      const monday = new Date(now)
      monday.setDate(now.getDate() - i * 7)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 7)
      const hours = sessions
        .filter(s => {
          const d = new Date(s.date)
          return d >= monday && d < sunday
        })
        .reduce((a, b) => a + (b.hours || 0), 0)
      weeks.push({ label: formatDate(monday), hours: parseFloat(hours.toFixed(1)) })
    }
    return weeks
  }, [sessions, range])

  const maxWeekly = Math.max(...weeklyData.map(w => w.hours), 1)

  // ── Subject totals ─────────────────────────────────────────────────────
  const subjectTotals = useMemo(() => {
    const monday = getMondayOfWeek(new Date())
    return subjects.map(s => {
      const all   = sessions.filter(x => x.subject === s.key).reduce((a, b) => a + (b.hours || 0), 0)
      const week  = sessions.filter(x => x.subject === s.key && new Date(x.date) >= monday).reduce((a, b) => a + (b.hours || 0), 0)
      return { ...s, all: parseFloat(all.toFixed(1)), week: parseFloat(week.toFixed(1)) }
    }).sort((a, b) => b.all - a.all)
  }, [sessions, subjects])

  const maxSubject = Math.max(...subjectTotals.map(s => s.all), 1)

  // ── Heatmap (last 91 days = 13 weeks) ────────────────────────────────
  const heatmapData = useMemo(() => {
    const days = []
    const today = new Date(); today.setHours(0, 0, 0, 0)
    // Start from Monday 13 weeks ago
    const start = getMondayOfWeek(new Date(today.getTime() - 12 * 7 * 86400000))
    const sessionMap = {}
    sessions.forEach(s => {
      const key = new Date(s.date).toDateString()
      sessionMap[key] = (sessionMap[key] || 0) + s.hours
    })
    const d = new Date(start)
    while (d <= today) {
      days.push({ date: new Date(d), hours: sessionMap[d.toDateString()] || 0 })
      d.setDate(d.getDate() + 1)
    }
    return days
  }, [sessions])

  const maxHeat = Math.max(...heatmapData.map(d => d.hours), 0.1)

  function heatColor(hours) {
    if (hours === 0) return 'var(--gray-100)'
    const pct = hours / maxHeat
    if (pct < 0.25) return '#bbf7d0'
    if (pct < 0.5)  return '#4ade80'
    if (pct < 0.75) return '#16a34a'
    return '#14532d'
  }

  // ── Summary stats ─────────────────────────────────────────────────────
  const totalHours   = sessions.reduce((a, b) => a + (b.hours || 0), 0)
  const totalSessions = sessions.length
  const avgPerSession = totalSessions > 0 ? totalHours / totalSessions : 0
  const monday = getMondayOfWeek(new Date())
  const weekHours = sessions.filter(s => new Date(s.date) >= monday).reduce((a, b) => a + (b.hours || 0), 0)

  // Weekly streak
  const weeklyMin    = useMemo(() => loadWeeklyTarget(10), [])
  const weeklyStreak = useMemo(() => computeWeeklyStreak(sessions, weeklyMin), [sessions, weeklyMin])

  // Daily streak
  const streak = useMemo(() => {
    const days = new Set(sessions.map(s => new Date(s.date).toDateString()))
    let count = 0
    const d = new Date(); d.setHours(0, 0, 0, 0)
    if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1)
    while (days.has(d.toDateString())) { count++; d.setDate(d.getDate() - 1) }
    return count
  }, [sessions])

  // Best day of week
  const dowTotals = useMemo(() => {
    const t = Array(7).fill(0)
    sessions.forEach(s => { t[new Date(s.date).getDay()] += s.hours })
    return t
  }, [sessions])
  const DOW     = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const DOW_PT  = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
  const bestDowIdx = dowTotals.indexOf(Math.max(...dowTotals))

  // ── Pattern insights ───────────────────────────────────────────────────
  const patterns = useMemo(() => {
    if (sessions.length < 5) return []
    const insights = []
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const thisMonday = getMondayOfWeek(new Date())

    // Best day of week
    const dowH = Array(7).fill(0), dowC = Array(7).fill(0)
    sessions.forEach(s => {
      const d = new Date(s.date).getDay()
      dowH[d] += s.hours; dowC[d]++
    })
    const bestDow = dowH.indexOf(Math.max(...dowH))
    insights.push({
      emoji: '📅',
      title: `Rendes mais às ${DOW_PT[bestDow]}s`,
      sub: `${dowH[bestDow].toFixed(1)}h acumuladas — o teu melhor dia da semana`,
      color: '#6366f1', bg: 'var(--indigo-50)',
    })

    // Weekday vs weekend
    const wdH = [1,2,3,4,5].reduce((a,i) => a + dowH[i], 0)
    const wdDays = [1,2,3,4,5].filter(i => dowC[i] > 0).length
    const weH = [0,6].reduce((a,i) => a + dowH[i], 0)
    const weDays = [0,6].filter(i => dowC[i] > 0).length
    if (wdDays > 0 && weDays > 0) {
      const wdAvg = wdH / wdDays, weAvg = weH / weDays
      if (weAvg > wdAvg * 1.15) {
        insights.push({ emoji: '🏖️', title: 'Estudas mais ao fim de semana', sub: `Média ${weAvg.toFixed(1)}h/dia vs ${wdAvg.toFixed(1)}h nos dias úteis`, color: '#0891b2', bg: 'var(--cyan-50)' })
      } else if (wdAvg > weAvg * 1.15) {
        insights.push({ emoji: '💼', title: 'Mais produtiva durante a semana', sub: `Média ${wdAvg.toFixed(1)}h/dia vs ${weAvg.toFixed(1)}h ao fim de semana`, color: '#0891b2', bg: 'var(--cyan-50)' })
      }
    }

    // Mood vs hours
    const moodSessions = sessions.filter(s => s.mood)
    if (moodSessions.length >= 5) {
      const mH = {}, mC = {}
      moodSessions.forEach(s => { mH[s.mood] = (mH[s.mood]||0) + s.hours; mC[s.mood] = (mC[s.mood]||0) + 1 })
      const best = Object.entries(mH).map(([m, h]) => ({ mood: m, avg: h / mC[m] })).sort((a,b) => b.avg - a.avg)[0]
      const MOOD_NAMES = { '😴': 'Cansada', '😐': 'Normal', '😊': 'Bem', '🔥': 'Flow' }
      insights.push({
        emoji: best.mood,
        title: `Estudas mais com humor "${MOOD_NAMES[best.mood] || best.mood}"`,
        sub: `Média de ${best.avg.toFixed(1)}h por sessão nesse estado`,
        color: '#d97706', bg: 'var(--amber-50)',
      })
    }

    // Trend: this week vs 4-week average
    const thisWeekH = sessions.filter(s => new Date(s.date) >= thisMonday).reduce((a,b) => a + b.hours, 0)
    let prev4H = 0
    for (let i = 1; i <= 4; i++) {
      const wS = new Date(thisMonday); wS.setDate(thisMonday.getDate() - i * 7)
      const wE = new Date(thisMonday); wE.setDate(thisMonday.getDate() - (i-1) * 7)
      prev4H += sessions.filter(s => { const d = new Date(s.date); return d >= wS && d < wE }).reduce((a,b) => a + b.hours, 0)
    }
    const avg4 = prev4H / 4
    if (avg4 > 0.5) {
      const diff = thisWeekH - avg4
      const pct  = Math.abs(Math.round(diff / avg4 * 100))
      if (Math.abs(diff) > 0.5) {
        insights.push({
          emoji: diff > 0 ? '📈' : '📉',
          title: diff > 0 ? `Semana acima da média (+${pct}%)` : `Semana abaixo da média (−${pct}%)`,
          sub: `Média últimas 4 semanas: ${avg4.toFixed(1)}h · Esta semana: ${thisWeekH.toFixed(1)}h`,
          color: diff > 0 ? '#16a34a' : '#dc2626', bg: diff > 0 ? 'var(--green-50)' : 'var(--red-50)',
        })
      }
    }

    // Neglected subject this week
    if (subjects.length > 1) {
      const thisWeekSubjs = new Set(sessions.filter(s => new Date(s.date) >= thisMonday).map(s => s.subject))
      const neglected = subjects.filter(s => !thisWeekSubjs.has(s.key) && sessions.some(x => x.subject === s.key))
      if (neglected.length > 0) {
        const w = neglected[0]
        insights.push({ emoji: w.emoji || '📚', title: `${w.name} sem sessões esta semana`, sub: 'Nenhuma sessão registada — pode estar a acumular atraso', color: '#9333ea', bg: 'var(--purple-50)' })
      }
    }

    // Consistency last 28 days
    let studyDays = 0
    for (let i = 0; i < 28; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i)
      if (sessions.some(s => new Date(s.date).toDateString() === d.toDateString())) studyDays++
    }
    const conPct = Math.round(studyDays / 28 * 100)
    insights.push({
      emoji: conPct >= 70 ? '🏆' : conPct >= 40 ? '📊' : '⚠️',
      title: `${conPct}% de consistência — últimos 28 dias`,
      sub: `${studyDays} de 28 dias com pelo menos uma sessão`,
      color: conPct >= 70 ? '#16a34a' : conPct >= 40 ? '#d97706' : '#dc2626',
      bg:    conPct >= 70 ? 'var(--green-50)' : conPct >= 40 ? 'var(--amber-50)' : 'var(--red-50)',
    })

    // Longest streak ever
    const allDates = new Set(sessions.map(s => new Date(s.date).toDateString()))
    let maxStr = 0, cur = 0
    const iter = new Date(today); iter.setDate(iter.getDate() - 365)
    while (iter <= today) {
      if (allDates.has(iter.toDateString())) { cur++; maxStr = Math.max(maxStr, cur) } else cur = 0
      iter.setDate(iter.getDate() + 1)
    }
    if (maxStr >= 3) {
      insights.push({
        emoji: '🔥',
        title: `Maior streak: ${maxStr} dias seguidos`,
        sub: maxStr === streak ? '🎉 O teu streak atual é o teu recorde!' : `Streak atual: ${streak} dias — bate o recorde!`,
        color: '#ea580c', bg: 'var(--orange-50)',
      })
    }

    return insights
  }, [sessions, subjects, streak])

  // Heatmap weeks grid
  const heatWeeks = []
  for (let i = 0; i < heatmapData.length; i += 7) {
    heatWeeks.push(heatmapData.slice(i, i + 7))
  }

  // ── Personal records ──────────────────────────────────────────────────
  const records = useMemo(() => {
    if (sessions.length === 0) return null
    const bestSession = Math.max(...sessions.map(s => s.hours))
    const dayMap = {}
    sessions.forEach(s => { dayMap[s.date] = (dayMap[s.date] || 0) + s.hours })
    const bestDay = Math.max(...Object.values(dayMap), 0)
    const weekMap = {}
    sessions.forEach(s => {
      const monday = getMondayOfWeek(new Date(s.date)).toDateString()
      weekMap[monday] = (weekMap[monday] || 0) + s.hours
    })
    const bestWeek = Math.max(...Object.values(weekMap), 0)
    const allDates = new Set(sessions.map(s => new Date(s.date).toDateString()))
    let maxStreak = 0, cur = 0
    const iter = new Date(); iter.setHours(0,0,0,0); iter.setDate(iter.getDate() - 365)
    const today = new Date(); today.setHours(0,0,0,0)
    while (iter <= today) {
      if (allDates.has(iter.toDateString())) { cur++; maxStreak = Math.max(maxStreak, cur) } else cur = 0
      iter.setDate(iter.getDate() + 1)
    }
    return { bestSession: parseFloat(bestSession.toFixed(1)), bestDay: parseFloat(bestDay.toFixed(1)), bestWeek: parseFloat(bestWeek.toFixed(1)), maxStreak }
  }, [sessions])

  // ── Goal projection (per subject) ────────────────────────────────────
  const goalProjection = useMemo(() => {
    if (subjects.length === 0 || sessions.length === 0) return null
    let subjectTargets = {}
    try { subjectTargets = JSON.parse(localStorage.getItem('subject-targets')) || {} } catch {}
    let exams = []
    try { exams = JSON.parse(localStorage.getItem('exams')) || [] } catch {}
    const defaultPerSubject = (settings?.hoursGoal || 550) / Math.max(1, subjects.length)
    const now = new Date()
    const periodStart = settings?.periodStart
      ? new Date(settings.periodStart + 'T00:00:00')
      : new Date(Math.min(...sessions.map(s => new Date(s.date).getTime())))
    const periodEnd = settings?.periodEnd
      ? new Date(settings.periodEnd + 'T23:59:59')
      : new Date(now.getTime() + 60 * 86400000)
    const daysSinceStart = Math.max(1, (now - periodStart) / 86400000)
    // Projection deadline per subject = the day of its furthest upcoming exam.
    // Falls back to the semester end when no exam is marked for that subject.
    const examDeadline = (s) => {
      const upcoming = exams
        .filter(e => e.date && (e.subject === s.name || e.subject === s.key))
        .map(e => new Date(e.date + 'T23:59:59'))
        .filter(d => d >= now)
        .sort((a, b) => b - a)
      return upcoming[0] || null
    }
    const subjectData = subjects.map(s => {
      const t = parseFloat(subjectTargets[s.key])
      const target = t > 0 ? t : parseFloat(defaultPerSubject.toFixed(0))
      const done = parseFloat(sessions.filter(x => x.subject === s.key).reduce((a, b) => a + (b.hours || 0), 0).toFixed(1))
      const deadline = examDeadline(s) || periodEnd
      const hasExam = !!examDeadline(s)
      const daysRemaining = Math.max(0, (deadline - now) / 86400000)
      const dailyPace = done / daysSinceStart
      const projected = parseFloat((done + dailyPace * daysRemaining).toFixed(0))
      const pct = Math.min(100, Math.round(done / target * 100))
      return { key: s.key, name: s.name, emoji: s.emoji, color: s.color, target, done, pct, projected, onTrack: projected >= target, daysRemaining: Math.round(daysRemaining), deadline, hasExam }
    })
    return { subjectData }
  }, [sessions, settings, subjects])

  // ── Radar chart data (% of semester goal achieved per subject) ───────
  const radarData = useMemo(() => {
    if (subjects.length < 3) return null
    let subjectTargets = {}
    try { subjectTargets = JSON.parse(localStorage.getItem('subject-targets')) || {} } catch {}
    const defaultPerSubject = (settings?.hoursGoal || 550) / Math.max(1, subjects.length)
    const now = new Date()
    const periodStart = settings?.periodStart
      ? new Date(settings.periodStart + 'T00:00:00')
      : sessions.length > 0 ? new Date(Math.min(...sessions.map(s => new Date(s.date).getTime()))) : null
    const periodEnd = settings?.periodEnd
      ? new Date(settings.periodEnd + 'T23:59:59')
      : new Date(now.getTime() + 60 * 86400000)
    if (!periodStart) return null
    const totalDays = Math.max(1, (periodEnd - periodStart) / 86400000)
    const elapsed   = Math.min(1, (now - periodStart) / (periodEnd - periodStart))
    return subjects.map(s => {
      const t = parseFloat(subjectTargets[s.key])
      const target = t > 0 ? t : defaultPerSubject
      const expectedNow = target * elapsed
      const done = subjectTotals.find(x => x.key === s.key)?.all || 0
      const val = expectedNow > 0 ? Math.min(150, Math.round((done / expectedNow) * 100)) : 0
      return { subject: s.name.length > 10 ? s.name.slice(0, 9) + '…' : s.name, val, fullMark: 100 }
    })
  }, [subjects, subjectTotals, sessions, settings])

  // ── Confidence distribution per subject ──────────────────────────────
  const confidenceData = useMemo(() => {
    if (subjects.length === 0) return null
    try {
      const topicsMap = JSON.parse(localStorage.getItem('topics') || '{}')
      const result = subjects.map(s => {
        const subTopics = topicsMap[s.key] || topicsMap[s.name] || []
        if (subTopics.length === 0) return null
        const counts = { unknown: 0, little: 0, good: 0, great: 0 }
        subTopics.forEach(t => { counts[t.confidence || 'unknown']++ })
        return { key: s.key, name: s.name, emoji: s.emoji, color: s.color, total: subTopics.length, counts }
      }).filter(Boolean)
      return result.length > 0 ? result : null
    } catch { return null }
  }, [subjects])

  // ── Semester burndown (expected vs actual per subject) ───────────────
  const semesterBurndown = useMemo(() => {
    if (subjects.length === 0 || sessions.length === 0) return null
    let subjectTargets = {}
    try { subjectTargets = JSON.parse(localStorage.getItem('subject-targets')) || {} } catch {}
    const defaultPerSubject = (settings?.hoursGoal || 550) / Math.max(1, subjects.length)
    const now = new Date()
    const periodStart = settings?.periodStart
      ? new Date(settings.periodStart + 'T00:00:00')
      : new Date(Math.min(...sessions.map(s => new Date(s.date).getTime())))
    const periodEnd = settings?.periodEnd
      ? new Date(settings.periodEnd + 'T23:59:59')
      : new Date(now.getTime() + 60 * 86400000)
    const totalDays = Math.max(1, (periodEnd - periodStart) / 86400000)
    const elapsed = Math.min(1, Math.max(0, (now - periodStart) / (totalDays * 86400000)))
    return subjects.map(s => {
      const t = parseFloat(subjectTargets[s.key])
      const target = t > 0 ? t : parseFloat(defaultPerSubject.toFixed(0))
      const done = parseFloat(sessions.filter(x => x.subject === s.key).reduce((a, b) => a + (b.hours || 0), 0).toFixed(1))
      const expectedNow = parseFloat((target * elapsed).toFixed(1))
      const delta = parseFloat((done - expectedNow).toFixed(1))
      return { key: s.key, name: s.name, emoji: s.emoji, color: s.color, target, done, expectedNow, delta, pct: Math.min(100, Math.round(done / target * 100)), pctExpected: Math.min(100, Math.round(expectedNow / target * 100)) }
    })
  }, [subjects, sessions, settings])

  // ── Archived semesters comparison ────────────────────────────────────
  const archivedSemesters = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('archived-semesters') || '[]') } catch { return [] }
  }, [])

  // ── Intraday timeline (last 25 sessions with startTime) ─────────────
  const intradayData = useMemo(() => {
    const withTime = sessions
      .filter(s => s.startTime && s.hours > 0)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 25)
    if (withTime.length < 3) return null
    const slots = Array(24).fill(0)
    withTime.forEach(s => {
      const startH = new Date(s.startTime).getHours()
      const endH = Math.min(23, startH + Math.ceil(s.hours))
      for (let h = startH; h <= endH; h++) slots[h] += s.hours / Math.max(1, endH - startH + 1)
    })
    return slots.map((h, i) => ({ hour: i, hours: parseFloat(h.toFixed(2)) }))
  }, [sessions])

  // ── Weekly goals history (last 8 weeks) ──────────────────────────────
  const weeklyGoalHistory = useMemo(() => {
    if (sessions.length === 0) return null
    let subjectTargets = {}
    try { subjectTargets = JSON.parse(localStorage.getItem('subject-targets')) || {} } catch {}
    const defaultPerSubject = (settings?.hoursGoal || 550) / Math.max(1, subjects.length)
    const totalTarget = subjects.reduce((a, s) => {
      const t = parseFloat(subjectTargets[s.key])
      return a + (t > 0 ? t : defaultPerSubject)
    }, 0)
    if (totalTarget <= 0) return null
    const periodStart = settings?.periodStart
      ? new Date(settings.periodStart + 'T00:00:00')
      : new Date(Math.min(...sessions.map(s => new Date(s.date).getTime())))
    const periodEnd = settings?.periodEnd
      ? new Date(settings.periodEnd + 'T23:59:59')
      : new Date(Date.now() + 60 * 86400000)
    const totalWeeks = Math.max(1, (periodEnd - periodStart) / (7 * 86400000))
    const weeklyTarget = parseFloat((totalTarget / totalWeeks).toFixed(1))
    const result = []
    const now = getMondayOfWeek(new Date())
    for (let i = 7; i >= 0; i--) {
      const monday = new Date(now); monday.setDate(now.getDate() - i * 7)
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 7)
      const h = parseFloat(sessions.filter(s => { const d = new Date(s.date); return d >= monday && d < sunday }).reduce((a, b) => a + (b.hours || 0), 0).toFixed(1))
      result.push({
        label: monday.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }),
        hours: h,
        target: weeklyTarget,
        hit: h >= weeklyTarget,
        current: i === 0,
      })
    }
    return result
  }, [sessions, settings])

  if (sessions.length === 0) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h1>📊 Estatísticas</h1>
          <p className="subtitle">Os teus padrões de estudo, em gráficos</p>
        </div>
        <div style={{
          padding: '40px 28px', textAlign: 'center',
          background: 'var(--white)', borderRadius: 'var(--r)',
          border: '1.5px dashed var(--gray-200)',
        }}>
          <p style={{ fontSize: '2.5rem', marginBottom: 12 }}>📊</p>
          <p style={{ fontWeight: 800, color: 'var(--gray-800)', marginBottom: 6, fontSize: 'var(--t-body)' }}>
            Ainda sem dados para mostrar
          </p>
          <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-400)', lineHeight: 1.6, maxWidth: 320, margin: '0 auto 20px' }}>
            Regista sessões de estudo em <strong>Horas &amp; Metas</strong> e os teus padrões aparecem aqui automaticamente — heatmap, streaks, e muito mais.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>📊 Estatísticas</h1>
        <p className="subtitle">Gráficos e análise histórica — para registar sessões e metas vai a Horas ⏱️</p>
      </div>

      {/* Summary cards */}
      <div className="dashboard-grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Total de horas</div>
          <div className="stat-value">{totalHours.toFixed(0)}<span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-400)' }}>h</span></div>
          <div className="stat-sub">{totalSessions} sessões registadas</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Esta semana</div>
          <div className="stat-value">{weekHours.toFixed(1)}<span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-400)' }}>h</span></div>
          <div className="stat-sub">Média de {avgPerSession.toFixed(1)}h por sessão</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Streak semanal</div>
          <div className="stat-value">{weeklyStreak.current}<span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-400)' }}>sem</span></div>
          <div className="stat-sub">
            {weeklyStreak.weeksHit} semana{weeklyStreak.weeksHit !== 1 ? 's' : ''} com ≥{weeklyMin}h · recorde {weeklyStreak.best}
          </div>
        </div>
      </div>

      {/* Pattern insights */}
      {patterns.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">🔍 Padrões detetados</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {patterns.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', background: p.bg, borderRadius: 'var(--r)', border: `1px solid ${p.color}22` }}>
                <span style={{ fontSize: '1.3rem', flexShrink: 0, lineHeight: 1.2 }}>{p.emoji}</span>
                <div>
                  <p style={{ fontSize: 'var(--t-body)', fontWeight: 700, color: p.color, margin: 0, marginBottom: 2 }}>{p.title}</p>
                  <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-500)', margin: 0 }}>{p.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Horas por semana</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['8w','8 sem'],['3m','3 meses'],['all','Tudo']].map(([v, l]) => (
              <button key={v} onClick={() => setRange(v)}
                className={range === v ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontSize: 'var(--t-caption)', padding: '4px 10px' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body">
          {/* Bars + trend line overlay */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, padding: '0 8px 0 0' }}>
              {weeklyData.map((w, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-500)', fontWeight: 600 }}>
                    {w.hours > 0 ? `${w.hours}h` : ''}
                  </span>
                  <div style={{
                    width: '100%', borderRadius: 4,
                    background: w.hours > 0 ? 'var(--rose-300)' : 'var(--gray-100)',
                    height: `${Math.max(4, (w.hours / maxWeekly) * 100)}px`,
                    transition: 'height 0.3s ease',
                  }} />
                  <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', textAlign: 'center', lineHeight: 1.2 }}>{w.label}</span>
                </div>
              ))}
            </div>
            {/* 3-week moving average trend line */}
            {weeklyData.length >= 4 && (() => {
              const barAreaH = 100 // px — the bar area height (excluding label rows)
              const n = weeklyData.length
              // moving average: window of 3
              const avg = weeklyData.map((_, i) => {
                const slice = weeklyData.slice(Math.max(0, i - 1), i + 2)
                return slice.reduce((a, b) => a + b.hours, 0) / slice.length
              })
              // x: evenly spaced across 100% width; each bar is flex:1 with gap:6px
              // Approximate: bar midpoint at (i + 0.5) / n * 100%
              const points = avg.map((h, i) => {
                const x = ((i + 0.5) / n) * 100
                const y = barAreaH - Math.max(4, (h / maxWeekly) * barAreaH) + 20 // 20px label offset at top
                return `${x},${y}`
              }).join(' ')
              return (
                <svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 24, width: '100%', height: 124, pointerEvents: 'none' }}>
                  <polyline
                    points={points}
                    fill="none"
                    stroke="var(--rose-400)"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                    strokeOpacity="0.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {avg.map((h, i) => {
                    const x = ((i + 0.5) / n) * 100 + '%'
                    const y = barAreaH - Math.max(4, (h / maxWeekly) * barAreaH) + 20
                    return <circle key={i} cx={x} cy={y} r="3" fill="var(--rose-400)" fillOpacity="0.7" />
                  })}
                </svg>
              )
            })()}
          </div>
        </div>
      </div>


      {/* Heatmap */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Atividade (últimas 13 semanas)</span>
        </div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 3, minWidth: 'fit-content' }}>
            {heatWeeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {week.map((day, di) => (
                  <div key={di}
                    title={`${day.date.toLocaleDateString('pt-PT')} · ${day.hours.toFixed(1)}h`}
                    style={{
                      width: 14, height: 14, borderRadius: 3,
                      background: heatColor(day.hours),
                      cursor: 'default',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>Menos</span>
            {[0, 0.2, 0.5, 0.8, 1].map((v, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: heatColor(v * maxHeat) }} />
            ))}
            <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>Mais</span>
          </div>
        </div>
      </div>

      {/* Mood breakdown + correlation */}
      {(() => {
        const MOOD_LABELS = { '😴': 'Cansada', '😐': 'Normal', '😊': 'Bem', '🔥': 'Flow' }
        const MOOD_COLORS = { '😴': '#94a3b8', '😐': '#f59e0b', '😊': '#34d399', '🔥': '#f97316' }
        const moodSessions = sessions.filter(s => s.mood)
        if (moodSessions.length === 0) return null
        const counts = {}, hours = {}
        moodSessions.forEach(s => {
          counts[s.mood] = (counts[s.mood] || 0) + 1
          hours[s.mood] = (hours[s.mood] || 0) + (s.hours || 0)
        })
        const total = moodSessions.length
        const avgHours = Object.fromEntries(Object.keys(counts).map(m => [m, hours[m] / counts[m]]))
        const maxAvg = Math.max(...Object.values(avgHours), 0.1)
        return (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">Humor nas sessões</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setMoodView('dist')} className={moodView === 'dist' ? 'btn btn-primary' : 'btn btn-secondary'} style={{ fontSize: 'var(--t-caption)', padding: '4px 10px' }}>Frequência</button>
                <button onClick={() => setMoodView('corr')} className={moodView === 'corr' ? 'btn btn-primary' : 'btn btn-secondary'} style={{ fontSize: 'var(--t-caption)', padding: '4px 10px' }}>Média de horas</button>
              </div>
            </div>
            <div className="card-body">
              {moodView === 'dist' ? (
                Object.entries(MOOD_LABELS).map(([emoji, label]) => {
                  const count = counts[emoji] || 0
                  const pct = Math.round(count / total * 100)
                  return (
                    <div key={emoji} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: '1.2rem', width: 28 }}>{emoji}</span>
                      <span style={{ fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--gray-700)', width: 70 }}>{label}</span>
                      <div className="progress-wrap" style={{ flex: 1, height: 8 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, height: '100%', background: MOOD_COLORS[emoji] || 'var(--rose-300)' }} />
                      </div>
                      <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-500)', fontWeight: 600, minWidth: 70, textAlign: 'right' }}>{count} sess. ({pct}%)</span>
                    </div>
                  )
                })
              ) : moodView === 'corr' ? (
                <>
                  {Object.entries(MOOD_LABELS).map(([emoji, label]) => {
                    const avg = avgHours[emoji] || 0
                    const pct = avg / maxAvg * 100
                    return (
                      <div key={emoji} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: '1.2rem', width: 28 }}>{emoji}</span>
                        <span style={{ fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--gray-700)', width: 70 }}>{label}</span>
                        <div className="progress-wrap" style={{ flex: 1, height: 8 }}>
                          <div className="progress-fill" style={{ width: `${pct}%`, height: '100%', background: MOOD_COLORS[emoji] || 'var(--rose-300)', opacity: avg === 0 ? 0.2 : 1 }} />
                        </div>
                        <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-500)', fontWeight: 600, minWidth: 70, textAlign: 'right' }}>
                          {avg > 0 ? `${avg.toFixed(1)}h/sess.` : '—'}
                        </span>
                      </div>
                    )
                  })}
                  <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', marginTop: 4 }}>
                    Média de horas estudadas por sessão em cada estado de humor
                  </p>
                </>
              ) : null}
            </div>
          </div>
        )
      })()}

      {/* Day of week breakdown */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Horas por dia da semana</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
            {DOW.map((d, i) => {
              const h = dowTotals[i]
              const max = Math.max(...dowTotals, 1)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-500)', fontWeight: 600 }}>
                    {h > 0 ? `${h.toFixed(0)}h` : ''}
                  </span>
                  <div style={{
                    width: '100%', borderRadius: 4,
                    background: i === bestDowIdx && h > 0 ? 'var(--rose-400)' : h > 0 ? 'var(--rose-200)' : 'var(--gray-100)',
                    height: `${Math.max(4, (h / max) * 80)}px`,
                  }} />
                  <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-500)', fontWeight: 600 }}>{d}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Personal records */}
      {records && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">🏆 Recordes pessoais</span></div>
          <div className="card-body">
            <div className="dashboard-grid-3" style={{ margin: 0 }}>
              {[
                { label: 'Melhor sessão',   value: `${records.bestSession}h`, sub: 'numa única sessão' },
                { label: 'Melhor dia',      value: `${records.bestDay}h`,     sub: 'num único dia' },
                { label: 'Melhor semana',   value: `${records.bestWeek}h`,    sub: 'numa única semana' },
                { label: 'Maior streak',    value: `${records.maxStreak}d`,   sub: `streak atual: ${streak}d${streak === records.maxStreak && records.maxStreak > 0 ? ' 🎉' : ''}` },
              ].map(r => (
                <div key={r.label} className="stat-card" style={{ textAlign: 'center' }}>
                  <div className="stat-label">{r.label}</div>
                  <div className="stat-value" style={{ fontSize: '1.6rem' }}>{r.value}</div>
                  <div className="stat-sub">{r.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Goal projection — per subject */}
      {goalProjection && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">🎯 Projeção da meta</span>
            <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 500 }}>até ao dia do exame</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {goalProjection.subjectData.map(s => (
              <div key={s.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 'var(--t-body)', fontWeight: 700, color: 'var(--gray-800)' }}>{s.emoji} {s.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-500)' }}>{s.done}h <span style={{ color: 'var(--gray-300)' }}>/</span> {s.target}h</span>
                    <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: s.onTrack ? '#16a34a' : '#dc2626' }}>
                      {s.pct}% {s.onTrack ? '✅' : '⚠️'}
                    </span>
                  </div>
                </div>
                <div className="progress-wrap" style={{ height: 8 }}>
                  <div className="progress-fill" style={{ width: `${s.pct}%`, height: '100%', background: s.onTrack ? '#16a34a' : (s.color || 'var(--rose-400)') }} />
                </div>
                <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', marginTop: 4 }}>
                  {s.hasExam
                    ? `📅 Exame ${s.deadline.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} · ${s.daysRemaining}d`
                    : `⏳ Fim do semestre · ${s.daysRemaining}d`}
                  {' — '}
                  {s.onTrack
                    ? `projeção ${s.projected}h, no bom caminho`
                    : `projeção ${s.projected}h, faltam ${(s.target - s.done).toFixed(1)}h para a meta`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Semester burndown — expected vs actual pace */}
      {semesterBurndown && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">📉 Ritmo do semestre</span>
            <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>esperado até hoje vs feito</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {semesterBurndown.map(s => (
              <div key={s.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 'var(--t-body)', fontWeight: 700, color: 'var(--gray-800)' }}>{s.emoji} {s.name}</span>
                  <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: s.delta >= 0 ? '#16a34a' : '#dc2626' }}>
                    {s.delta >= 0 ? `+${s.delta}h adiantada` : `${s.delta}h em atraso`}
                  </span>
                </div>
                <div style={{ position: 'relative', height: 10, borderRadius: 99, background: 'var(--gray-100)', overflow: 'visible' }}>
                  {/* Actual done bar */}
                  <div style={{ height: '100%', borderRadius: 99, background: s.delta >= 0 ? '#16a34a' : (s.color || 'var(--rose-400)'), width: `${s.pct}%`, transition: 'width 0.3s' }} />
                  {/* Expected now marker */}
                  {s.pctExpected > 0 && s.pctExpected <= 100 && (
                    <div style={{ position: 'absolute', top: -2, left: `${s.pctExpected}%`, width: 2, height: 14, background: 'var(--gray-400)', borderRadius: 99, transform: 'translateX(-50%)' }} title={`Esperado: ${s.expectedNow}h`} />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>{s.done}h feitas</span>
                  <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>esperado: {s.expectedNow}h · meta: {s.target}h</span>
                </div>
              </div>
            ))}
            <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', marginTop: 2 }}>
              A linha vertical indica o ritmo esperado a esta altura do semestre
            </p>
          </div>
        </div>
      )}

      {/* Weekly goals history */}
      {weeklyGoalHistory && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">📋 Histórico de metas semanais</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
              {weeklyGoalHistory.map((w, i) => {
                const maxH = Math.max(...weeklyGoalHistory.map(x => Math.max(x.hours, x.target)), 1)
                const barH = Math.max(4, (w.hours / maxH) * 90)
                const targetH = Math.max(1, (w.target / maxH) * 90)
                return (
                  <div key={i} title={`${w.label}: ${w.hours}h / ${w.target}h`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-500)', fontWeight: 600 }}>{w.hours > 0 ? `${w.hours}h` : ''}</span>
                    <div style={{ position: 'relative', width: '100%', height: 90, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: targetH, borderTop: '2px dashed var(--gray-300)', pointerEvents: 'none' }} />
                      <div style={{ width: '100%', borderRadius: 4, height: barH, background: w.current ? 'var(--rose-300)' : w.hit ? '#16a34a' : w.hours > 0 ? '#f97316' : 'var(--gray-100)' }} />
                    </div>
                    <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', textAlign: 'center', lineHeight: 1.2 }}>{w.label}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#16a34a', display: 'inline-block' }} /> Meta atingida</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#f97316', display: 'inline-block' }} /> Abaixo da meta</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--rose-300)', display: 'inline-block' }} /> Semana atual</span>
            </div>
          </div>
        </div>
      )}

      {/* Radar chart */}
      {radarData && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">🕸️ Equilíbrio entre cadeiras</span></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--gray-200)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'var(--gray-600)', fontWeight: 600 }} />
                <Radar name="% da meta" dataKey="val" stroke="var(--rose-400)" fill="var(--rose-400)" fillOpacity={0.25} />
                <Tooltip formatter={(v) => [`${v}%`, '% da meta esperada']} contentStyle={{ fontSize: 'var(--t-caption)', borderRadius: 'var(--r)', border: '1px solid var(--gray-200)' }} />
              </RadarChart>
            </ResponsiveContainer>
            <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', textAlign: 'center', marginTop: 4 }}>
              100% = no ritmo certo para atingir a meta · acima de 100% = adiantada · abaixo = em atraso
            </p>
          </div>
        </div>
      )}

      {/* Intraday timeline */}
      {intradayData && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">🕐 Quando costumas estudar</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70 }}>
              {intradayData.map((slot, i) => {
                const max = Math.max(...intradayData.map(x => x.hours), 0.1)
                return (
                  <div key={i} title={`${i}h: ${slot.hours.toFixed(1)}h de estudo`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ width: '100%', borderRadius: 2, height: Math.max(2, (slot.hours / max) * 55), background: slot.hours > 0 ? 'var(--rose-300)' : 'var(--gray-100)' }} />
                    {i % 4 === 0 && <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>{i}h</span>}
                  </div>
                )
              })}
            </div>
            <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', marginTop: 8 }}>
              Baseado nas últimas {sessions.filter(s => s.startTime && s.hours > 0).slice(-25).length} sessões com hora de início registada
            </p>
          </div>
        </div>
      )}

      {/* Confidence distribution per subject */}
      {confidenceData && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">📚 Confiança nos tópicos</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {confidenceData.map(s => (
              <div key={s.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 'var(--t-body)', fontWeight: 700, color: 'var(--gray-800)' }}>{s.emoji} {s.name}</span>
                  <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>{s.total} tópico{s.total !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', background: 'var(--gray-100)' }}>
                  {[
                    { id: 'great',   color: '#15803d' },
                    { id: 'good',    color: '#1d4ed8' },
                    { id: 'little',  color: '#b45309' },
                    { id: 'unknown', color: '#b91c1c' },
                  ].map(l => {
                    const pct = s.total > 0 ? (s.counts[l.id] / s.total) * 100 : 0
                    if (pct === 0) return null
                    return <div key={l.id} title={`${l.id}: ${s.counts[l.id]}`} style={{ width: `${pct}%`, background: l.color }} />
                  })}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
              {[{id:'great',label:'Sei muito bem',color:'#15803d'},{id:'good',label:'Sei bem',color:'#1d4ed8'},{id:'little',label:'Sei pouco',color:'#b45309'},{id:'unknown',label:'Não sei',color:'#b91c1c'}].map(l => (
                <span key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--t-caption)', color: 'var(--gray-500)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color, display: 'inline-block', flexShrink: 0 }} /> {l.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Semester comparison */}
      {archivedSemesters.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">📅 Comparação entre semestres</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-500)', letterSpacing: '0.07em', marginBottom: 6 }}>SEMESTRE ATUAL</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--gray-900)' }}>{totalHours.toFixed(0)}h</span>
                <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>{totalSessions} sessões</span>
              </div>
            </div>
            {archivedSemesters.slice(0, 4).map(sem => (
              <div key={sem.id} style={{ padding: '10px 12px', background: 'var(--gray-50)', borderRadius: 'var(--r)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 'var(--t-body)', fontWeight: 700, color: 'var(--gray-700)' }}>{sem.name}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontWeight: 800, color: 'var(--gray-900)' }}>{sem.totalHours}h</span>
                    <span style={{ fontSize: 'var(--t-caption)', color: sem.totalHours >= totalHours ? '#16a34a' : '#dc2626' }}>
                      {sem.totalHours >= totalHours ? '▲' : '▼'} vs atual
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {Object.entries(sem.bySubject).sort((a,b) => b[1]-a[1]).slice(0,5).map(([subj, h]) => (
                    <span key={subj} style={{ fontSize: 'var(--t-caption)', background: 'var(--white)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--gray-200)', color: 'var(--gray-600)' }}>
                      {subj}: {h}h
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements — collapsed by default */}
      {(() => {
        const achs = computeAchievements(sessions)
        if (achs.length === 0) return null
        return (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" onClick={() => setShowAch(v => !v)} style={{ cursor: 'pointer', userSelect: 'none' }}>
              <span className="card-title">Conquistas</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 500 }}>{achs.length} desbloqueadas</span>
                <ChevronDown size={16} color="var(--gray-400)" style={{ transform: showAch ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </div>
            </div>
            {showAch && (
              <div className="card-body" style={{ padding: '4px 20px' }}>
                {achs.map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '9px 0',
                    borderBottom: i < achs.length - 1 ? '1px solid var(--gray-50)' : 'none',
                  }}>
                    <span style={{ fontSize: '1.1rem', width: 24, textAlign: 'center', flexShrink: 0 }}>{a.icon}</span>
                    <span style={{ flex: 1, fontSize: 'var(--t-body)', color: 'var(--gray-700)' }}>{a.desc}</span>
                    <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 500, flexShrink: 0 }}>{a.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
