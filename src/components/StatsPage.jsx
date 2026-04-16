import { useState, useMemo } from 'react'
import { getMondayOfWeek } from '../utils/dates'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

function loadSessions() {
  try { return JSON.parse(localStorage.getItem('study-sessions')) || [] } catch { return [] }
}

function formatDate(d) {
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

export default function StatsPage({ settings }) {
  const [range, setRange] = useState('8w') // '8w' | '3m' | 'all'
  const [moodView, setMoodView] = useState('dist') // 'dist' | 'corr'
  const subjects = settings?.subjects || []
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

  // Streak
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
      color: '#6366f1', bg: '#eef2ff',
    })

    // Weekday vs weekend
    const wdH = [1,2,3,4,5].reduce((a,i) => a + dowH[i], 0)
    const wdDays = [1,2,3,4,5].filter(i => dowC[i] > 0).length
    const weH = [0,6].reduce((a,i) => a + dowH[i], 0)
    const weDays = [0,6].filter(i => dowC[i] > 0).length
    if (wdDays > 0 && weDays > 0) {
      const wdAvg = wdH / wdDays, weAvg = weH / weDays
      if (weAvg > wdAvg * 1.15) {
        insights.push({ emoji: '🏖️', title: 'Estudas mais ao fim de semana', sub: `Média ${weAvg.toFixed(1)}h/dia vs ${wdAvg.toFixed(1)}h nos dias úteis`, color: '#0891b2', bg: '#ecfeff' })
      } else if (wdAvg > weAvg * 1.15) {
        insights.push({ emoji: '💼', title: 'Mais produtiva durante a semana', sub: `Média ${wdAvg.toFixed(1)}h/dia vs ${weAvg.toFixed(1)}h ao fim de semana`, color: '#0891b2', bg: '#ecfeff' })
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
        color: '#d97706', bg: '#fffbeb',
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
          color: diff > 0 ? '#16a34a' : '#dc2626', bg: diff > 0 ? '#f0fdf4' : '#fef2f2',
        })
      }
    }

    // Neglected subject this week
    if (subjects.length > 1) {
      const thisWeekSubjs = new Set(sessions.filter(s => new Date(s.date) >= thisMonday).map(s => s.subject))
      const neglected = subjects.filter(s => !thisWeekSubjs.has(s.key) && sessions.some(x => x.subject === s.key))
      if (neglected.length > 0) {
        const w = neglected[0]
        insights.push({ emoji: w.emoji || '📚', title: `${w.name} sem sessões esta semana`, sub: 'Nenhuma sessão registada — pode estar a acumular atraso', color: '#9333ea', bg: '#faf5ff' })
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
      bg:    conPct >= 70 ? '#f0fdf4'  : conPct >= 40 ? '#fffbeb'  : '#fef2f2',
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
        color: '#ea580c', bg: '#fff7ed',
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
    const periodStart = settings?.periodStart ? new Date(settings.periodStart + 'T00:00:00') : null
    const periodEnd   = settings?.periodEnd   ? new Date(settings.periodEnd   + 'T23:59:59') : null
    if (!periodStart || !periodEnd) return null
    let targets = {}
    try { targets = JSON.parse(localStorage.getItem('daily-study-targets')) || {} } catch {}
    const now = new Date()
    const daysSinceStart = Math.max(1, (now - periodStart) / 86400000)
    const daysRemaining  = Math.max(0, (periodEnd - now) / 86400000)
    const subjectData = subjects.map(s => {
      const target = parseFloat(targets[s.key] || 0)
      if (!target) return null
      const done = parseFloat(sessions.filter(x => x.subject === s.key).reduce((a, b) => a + (b.hours || 0), 0).toFixed(1))
      const dailyPace = done / daysSinceStart
      const projected = parseFloat((done + dailyPace * daysRemaining).toFixed(0))
      const pct = Math.min(100, Math.round(done / target * 100))
      return { key: s.key, name: s.name, emoji: s.emoji, color: s.color, target, done, pct, projected, onTrack: projected >= target }
    }).filter(Boolean)
    if (subjectData.length === 0) return null
    return { subjectData, daysRemaining: Math.round(daysRemaining) }
  }, [sessions, settings, subjects])

  // ── Radar chart data (balance across subjects) ────────────────────────
  const radarData = useMemo(() => {
    if (subjects.length < 3) return null
    const totalH = subjects.reduce((a, s) => a + subjectTotals.find(x => x.key === s.key)?.all || 0, 0)
    if (totalH === 0) return null
    return subjects.map(s => {
      const st = subjectTotals.find(x => x.key === s.key)
      const val = Math.round(((st?.all || 0) / totalH) * 100)
      return { subject: s.name.length > 10 ? s.name.slice(0, 9) + '…' : s.name, val, fullMark: 100 }
    })
  }, [subjects, subjectTotals])

  // ── Intraday timeline (sessions with startTime) ───────────────────────
  const intradayData = useMemo(() => {
    const withTime = sessions.filter(s => s.startTime && s.hours > 0)
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
    const periodStart = settings?.periodStart ? new Date(settings.periodStart + 'T00:00:00') : null
    const periodEnd   = settings?.periodEnd   ? new Date(settings.periodEnd   + 'T23:59:59') : null
    if (!periodStart || !periodEnd) return null
    // Sum per-subject targets to get total semester goal
    let targets = {}
    try { targets = JSON.parse(localStorage.getItem('daily-study-targets')) || {} } catch {}
    const totalTarget = Object.values(targets).reduce((a, b) => a + parseFloat(b || 0), 0)
    if (totalTarget <= 0) return null
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
          <p className="subtitle">Gráficos e análise histórica</p>
        </div>
        <div className="empty-state">
          <p style={{ fontSize: '2rem', marginBottom: 8 }}>📭</p>
          <p style={{ fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>Ainda sem sessões registadas</p>
          <p style={{ fontSize: '0.83rem', color: 'var(--gray-400)' }}>Regista a tua primeira sessão de estudo na página Horas.</p>
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
          <div className="stat-label">Streak atual</div>
          <div className="stat-value">{streak}<span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-400)' }}>d</span></div>
          <div className="stat-sub">Melhor dia: {dowTotals.some(v => v > 0) ? DOW[bestDowIdx] : '–'}</div>
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
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', background: p.bg, borderRadius: 10, border: `1px solid ${p.color}22` }}>
                <span style={{ fontSize: '1.3rem', flexShrink: 0, lineHeight: 1.2 }}>{p.emoji}</span>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: p.color, margin: 0, marginBottom: 2 }}>{p.title}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', margin: 0 }}>{p.sub}</p>
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
                style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, padding: '0 8px 0 0' }}>
            {weeklyData.map((w, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--gray-500)', fontWeight: 600 }}>
                  {w.hours > 0 ? `${w.hours}h` : ''}
                </span>
                <div style={{
                  width: '100%', borderRadius: 4,
                  background: w.hours > 0 ? 'var(--rose-300)' : 'var(--gray-100)',
                  height: `${Math.max(4, (w.hours / maxWeekly) * 100)}px`,
                  transition: 'height 0.3s ease',
                }} />
                <span style={{ fontSize: '0.6rem', color: 'var(--gray-400)', textAlign: 'center', lineHeight: 1.2 }}>{w.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subject breakdown */}
      {subjectTotals.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Horas por cadeira</span>
          </div>
          <div className="card-body">
            {subjectTotals.map(s => (
              <div key={s.key} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--gray-800)' }}>
                    {s.emoji} {s.name}
                  </span>
                  <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 600 }}>
                    <span>Esta semana: <strong style={{ color: 'var(--gray-800)' }}>{s.week}h</strong></span>
                    <span>Total: <strong style={{ color: 'var(--gray-800)' }}>{s.all}h</strong></span>
                  </div>
                </div>
                <div className="progress-wrap" style={{ height: 8 }}>
                  <div className="progress-fill" style={{
                    width: `${(s.all / maxSubject) * 100}%`,
                    background: s.color || 'var(--rose-300)',
                    height: '100%',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>Menos</span>
            {[0, 0.2, 0.5, 0.8, 1].map((v, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: heatColor(v * maxHeat) }} />
            ))}
            <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>Mais</span>
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
                <button onClick={() => setMoodView('dist')} className={moodView === 'dist' ? 'btn btn-primary' : 'btn btn-secondary'} style={{ fontSize: '0.72rem', padding: '4px 10px' }}>Frequência</button>
                <button onClick={() => setMoodView('corr')} className={moodView === 'corr' ? 'btn btn-primary' : 'btn btn-secondary'} style={{ fontSize: '0.72rem', padding: '4px 10px' }}>Média de horas</button>
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
                      <span style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--gray-700)', width: 70 }}>{label}</span>
                      <div className="progress-wrap" style={{ flex: 1, height: 8 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, height: '100%', background: MOOD_COLORS[emoji] || 'var(--rose-300)' }} />
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)', fontWeight: 600, minWidth: 70, textAlign: 'right' }}>{count} sess. ({pct}%)</span>
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
                        <span style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--gray-700)', width: 70 }}>{label}</span>
                        <div className="progress-wrap" style={{ flex: 1, height: 8 }}>
                          <div className="progress-fill" style={{ width: `${pct}%`, height: '100%', background: MOOD_COLORS[emoji] || 'var(--rose-300)', opacity: avg === 0 ? 0.2 : 1 }} />
                        </div>
                        <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)', fontWeight: 600, minWidth: 70, textAlign: 'right' }}>
                          {avg > 0 ? `${avg.toFixed(1)}h/sess.` : '—'}
                        </span>
                      </div>
                    )
                  })}
                  <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 4 }}>
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
                  <span style={{ fontSize: '0.65rem', color: 'var(--gray-500)', fontWeight: 600 }}>
                    {h > 0 ? `${h.toFixed(0)}h` : ''}
                  </span>
                  <div style={{
                    width: '100%', borderRadius: 4,
                    background: i === bestDowIdx && h > 0 ? 'var(--rose-400)' : h > 0 ? 'var(--rose-200)' : 'var(--gray-100)',
                    height: `${Math.max(4, (h / max) * 80)}px`,
                  }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--gray-500)', fontWeight: 600 }}>{d}</span>
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
            <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 500 }}>⏳ {goalProjection.daysRemaining} dias restantes</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {goalProjection.subjectData.map(s => (
              <div key={s.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--gray-800)' }}>{s.emoji} {s.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{s.done}h <span style={{ color: 'var(--gray-300)' }}>/</span> {s.target}h</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: s.onTrack ? '#16a34a' : '#dc2626' }}>
                      {s.pct}% {s.onTrack ? '✅' : '⚠️'}
                    </span>
                  </div>
                </div>
                <div className="progress-wrap" style={{ height: 8 }}>
                  <div className="progress-fill" style={{ width: `${s.pct}%`, height: '100%', background: s.onTrack ? '#16a34a' : (s.color || 'var(--rose-400)') }} />
                </div>
                <p style={{ fontSize: '0.68rem', color: 'var(--gray-400)', marginTop: 4 }}>
                  {s.onTrack
                    ? `Projeção: ${s.projected}h — no bom caminho`
                    : `Projeção: ${s.projected}h — faltam ainda ${(s.target - s.done).toFixed(1)}h para atingir a meta`}
                </p>
              </div>
            ))}
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
                    <span style={{ fontSize: '0.6rem', color: 'var(--gray-500)', fontWeight: 600 }}>{w.hours > 0 ? `${w.hours}h` : ''}</span>
                    <div style={{ position: 'relative', width: '100%', height: 90, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: targetH, borderTop: '2px dashed var(--gray-300)', pointerEvents: 'none' }} />
                      <div style={{ width: '100%', borderRadius: 4, height: barH, background: w.current ? 'var(--rose-300)' : w.hit ? '#16a34a' : w.hours > 0 ? '#f97316' : 'var(--gray-100)' }} />
                    </div>
                    <span style={{ fontSize: '0.58rem', color: 'var(--gray-400)', textAlign: 'center', lineHeight: 1.2 }}>{w.label}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: '0.7rem', color: 'var(--gray-400)' }}>
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
                <Radar name="% do total" dataKey="val" stroke="var(--rose-400)" fill="var(--rose-400)" fillOpacity={0.25} />
                <Tooltip formatter={(v) => [`${v}%`, '% do total']} contentStyle={{ fontSize: '0.78rem', borderRadius: 8, border: '1px solid var(--gray-200)' }} />
              </RadarChart>
            </ResponsiveContainer>
            <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', textAlign: 'center', marginTop: 4 }}>
              Percentagem do tempo total dedicada a cada cadeira
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
                    {i % 4 === 0 && <span style={{ fontSize: '0.58rem', color: 'var(--gray-400)' }}>{i}h</span>}
                  </div>
                )
              })}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 8 }}>
              Baseado em sessões com hora de início registada ({sessions.filter(s => s.startTime).length} sessões)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
