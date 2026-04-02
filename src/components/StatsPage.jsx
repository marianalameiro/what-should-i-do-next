import { useState, useMemo } from 'react'

function loadSessions() {
  try { return JSON.parse(localStorage.getItem('study-sessions')) || [] } catch { return [] }
}

function getMondayOf(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
  d.setDate(d.getDate() + diff)
  return d
}

function formatDate(d) {
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

export default function StatsPage({ settings }) {
  const [range, setRange] = useState('8w') // '8w' | '3m' | 'all'
  const subjects = settings?.subjects || []
  const [sessions] = useState(loadSessions)

  // ── Weekly bar chart data ──────────────────────────────────────────────
  const weeklyData = useMemo(() => {
    const numWeeks = range === '8w' ? 8 : range === '3m' ? 12 : 24
    const weeks = []
    const now = getMondayOf(new Date())
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
        .reduce((a, b) => a + b.hours, 0)
      weeks.push({ label: formatDate(monday), hours: parseFloat(hours.toFixed(1)) })
    }
    return weeks
  }, [sessions, range])

  const maxWeekly = Math.max(...weeklyData.map(w => w.hours), 1)

  // ── Subject totals ─────────────────────────────────────────────────────
  const subjectTotals = useMemo(() => {
    const monday = getMondayOf(new Date())
    return subjects.map(s => {
      const all   = sessions.filter(x => x.subject === s.key).reduce((a, b) => a + b.hours, 0)
      const week  = sessions.filter(x => x.subject === s.key && new Date(x.date) >= monday).reduce((a, b) => a + b.hours, 0)
      return { ...s, all: parseFloat(all.toFixed(1)), week: parseFloat(week.toFixed(1)) }
    }).sort((a, b) => b.all - a.all)
  }, [sessions, subjects])

  const maxSubject = Math.max(...subjectTotals.map(s => s.all), 1)

  // ── Heatmap (last 91 days = 13 weeks) ────────────────────────────────
  const heatmapData = useMemo(() => {
    const days = []
    const today = new Date(); today.setHours(0, 0, 0, 0)
    // Start from Monday 13 weeks ago
    const start = getMondayOf(new Date(today.getTime() - 12 * 7 * 86400000))
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
  const totalHours   = sessions.reduce((a, b) => a + b.hours, 0)
  const totalSessions = sessions.length
  const avgPerSession = totalSessions > 0 ? totalHours / totalSessions : 0
  const monday = getMondayOf(new Date())
  const weekHours = sessions.filter(s => new Date(s.date) >= monday).reduce((a, b) => a + b.hours, 0)

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
    const thisMonday = getMondayOf(new Date())

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

  if (sessions.length === 0) {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h1>📊 Estatísticas</h1>
          <p className="subtitle">Visão geral do teu progresso de estudo</p>
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
        <p className="subtitle">Visão geral do teu progresso de estudo</p>
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

      {/* Mood breakdown */}
      {(() => {
        const MOOD_LABELS = { '😴': 'Cansada', '😐': 'Normal', '😊': 'Bem', '🔥': 'Flow' }
        const moodSessions = sessions.filter(s => s.mood)
        if (moodSessions.length === 0) return null
        const counts = {}
        moodSessions.forEach(s => { counts[s.mood] = (counts[s.mood] || 0) + 1 })
        const total = moodSessions.length
        return (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">Humor nas sessões</span>
            </div>
            <div className="card-body">
              {Object.entries(MOOD_LABELS).map(([emoji, label]) => {
                const count = counts[emoji] || 0
                const pct = Math.round(count / total * 100)
                return (
                  <div key={emoji} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: '1.2rem', width: 28 }}>{emoji}</span>
                    <span style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--gray-700)', width: 70 }}>{label}</span>
                    <div className="progress-wrap" style={{ flex: 1, height: 8 }}>
                      <div className="progress-fill" style={{ width: `${pct}%`, height: '100%', background: 'var(--rose-300)' }} />
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)', fontWeight: 600, minWidth: 60, textAlign: 'right' }}>{count} ({pct}%)</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Day of week breakdown */}
      <div className="card">
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
    </div>
  )
}
