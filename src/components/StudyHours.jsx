import { useState, useEffect } from 'react'
import { Plus, X, TrendingUp, TrendingDown, Minus, Clock, Flame, Star, SlidersHorizontal, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react'
import { PomodoroTimer } from './PomodoroTimer'

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

const DOW_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function weekDayNum() {
  const dow = TODAY.getDay()
  return dow === 0 ? 7 : dow
}

function shouldShowBehind() { return weekDayNum() > 1 }

function getMondayOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
  d.setDate(d.getDate() + diff)
  return d
}

function loadSessions() {
  try { return JSON.parse(localStorage.getItem('study-sessions')) || [] }
  catch { return [] }
}
function saveSessions(s) { localStorage.setItem('study-sessions', JSON.stringify(s)) }

function loadTargets() {
  try { return JSON.parse(localStorage.getItem('subject-targets')) || {} }
  catch { return {} }
}
function saveTargets(t) { localStorage.setItem('subject-targets', JSON.stringify(t)) }

function getTargetForKey(targets, key, fallback = 110) {
  const val = targets[key]
  const num = parseFloat(val)
  if (val !== undefined && val !== '' && !isNaN(num) && num > 0) return num
  return fallback
}

function hoursForSubject(sessions, key) {
  return sessions.filter(s => s.subject === key).reduce((a, b) => a + b.hours, 0)
}

function hoursForSubjectThisWeek(sessions, key) {
  const monday = getMondayOfWeek(TODAY)
  return sessions
    .filter(s => s.subject === key && new Date(s.date) >= monday)
    .reduce((a, b) => a + b.hours, 0)
}

function hoursThisWeek(sessions) {
  const monday = getMondayOfWeek(TODAY)
  return sessions.filter(s => new Date(s.date) >= monday).reduce((a, b) => a + b.hours, 0)
}

function currentStreak(sessions) {
  const days = new Set(sessions.map(s => s.date))
  let streak = 0
  const d = new Date(TODAY)
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1)
  while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1) }
  return streak
}

function last7Days(sessions) {
  const result = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(TODAY)
    d.setDate(TODAY.getDate() - i)
    const key = d.toDateString()
    const hours = sessions.filter(s => s.date === key).reduce((a, b) => a + b.hours, 0)
    result.push({ label: d.toLocaleDateString('pt-PT', { weekday: 'short' }), hours, date: key })
  }
  return result
}

function getStudySuggestions(subject, deficit, daysLeftInWeek, sessions) {
  const suggestions = []

  // How long since last studied this subject
  const subjectSessions = sessions.filter(s => s.subject === subject.key)
  const lastSession = subjectSessions.sort((a, b) => new Date(b.date) - new Date(a.date))[0]
  const daysSinceLast = lastSession
    ? Math.max(0, Math.round((TODAY - new Date(lastSession.date)) / 86400000))
    : null

  // Recovery session recommendation
  if (deficit > 0 && daysLeftInWeek > 0) {
    const hoursToday = Math.ceil((deficit / daysLeftInWeek) * 2) / 2  // round up to nearest 0.5h
    suggestions.push({
      emoji: '⏱️',
      text: daysLeftInWeek === 1
        ? `Faz uma sessão de ${hoursToday}h ainda hoje para fechar a semana`
        : `${hoursToday}h/dia nos próximos ${daysLeftInWeek} dias compensa o atraso`,
    })
  }

  // Last studied warning
  if (daysSinceLast !== null && daysSinceLast >= 4) {
    suggestions.push({
      emoji: '⚠️',
      text: `Não estudas ${subject.name} há ${daysSinceLast} dias — começa por rever os últimos apontamentos`,
    })
  } else if (daysSinceLast !== null && daysSinceLast >= 2) {
    suggestions.push({
      emoji: '🔁',
      text: `Última sessão há ${daysSinceLast} dias — revisita o que fizeste antes de avançar`,
    })
  }

  // Study methods for this subject
  const methods = subject.methods || []
  if (methods.length > 0) {
    suggestions.push({
      emoji: '📋',
      text: `Métodos configurados para esta cadeira:`,
      methods,
    })
  } else {
    suggestions.push({
      emoji: '💡',
      text: 'Experimenta: resumo dos apontamentos, prática de exercícios ou flashcards',
    })
  }

  // Pomodoro tip if very behind
  if (deficit > 2) {
    suggestions.push({
      emoji: '🍅',
      text: 'Usa o Pomodoro (25+5 min) — ajuda a arrancar quando a motivação está baixa',
    })
  }

  return suggestions
}

function statusColor(done, target) {
  if (!shouldShowBehind() || target < 0.1) return '#16a34a'
  const pct = done / target * 100
  if (pct >= 80) return '#16a34a'
  if (pct >= 50) return '#b45309'
  return '#dc2626'
}

function statusLabel(done, target) {
  if (!shouldShowBehind() || target < 0.1) return 'No bom caminho'
  const pct = done / target * 100
  if (pct >= 80) return 'No bom caminho'
  if (pct >= 50) return 'Atencao'
  return 'Atrasada'
}

function statusIcon(done, target) {
  if (!shouldShowBehind() || target < 0.1) return <TrendingUp size={13} />
  const pct = done / target * 100
  if (pct >= 80) return <TrendingUp size={13} />
  if (pct >= 50) return <Minus size={13} />
  return <TrendingDown size={13} />
}

export default function StudyHours({ settings }) {
  const subjects = settings?.subjects || []

  const periodEnd     = settings?.periodEnd ? new Date(settings.periodEnd) : new Date(Date.now() + 120 * 86400000)
  const DAYS_REMAINING  = Math.max(0, Math.round((periodEnd - TODAY) / 86400000))
  const WEEKS_REMAINING = Math.max(1, DAYS_REMAINING / 7)
  const defaultTarget   = Math.round((settings?.hoursGoal || 550) / Math.max(1, subjects.length))

  const [sessions, setSessions]       = useState(loadSessions)
  const [targets, setTargets]         = useState(loadTargets)
  const [showForm, setShowForm]       = useState(false)
  const [showTargets, setShowTargets] = useState(false)
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [expandedSuggestions, setExpandedSuggestions] = useState({})
  const [form, setForm] = useState({
    subject: subjects[0]?.key || '',
    hours: '',
    notes: '',
    mood: '😊',
    date: TODAY.toISOString().split('T')[0],
  })

  useEffect(() => { saveSessions(sessions) }, [sessions])
  useEffect(() => { saveTargets(targets) }, [targets])

  const getTarget = (key) => getTargetForKey(targets, key, defaultTarget)

  const addSession = () => {
    if (!form.hours || parseFloat(form.hours) <= 0) return
    setSessions(prev => [{
      id: Date.now(),
      subject: form.subject,
      hours: parseFloat(form.hours),
      notes: form.notes,
      mood: form.mood,
      date: new Date(form.date).toDateString(),
    }, ...prev])
    setForm(p => ({ ...p, hours: '', notes: '', mood: '😊' }))
    setShowForm(false)
  }

  const removeSession = (id) => setSessions(prev => prev.filter(s => s.id !== id))

  const updateTarget = (key, val) => {
    const num = parseFloat(val)
    setTargets(prev => {
      const updated = { ...prev, [key]: isNaN(num) ? val : num }
      saveTargets(updated)
      return updated
    })
  }

  const resetTargets = () => {
    const defaults = {}
    subjects.forEach(s => { defaults[s.key] = defaultTarget })
    setTargets(defaults)
    saveTargets(defaults)
  }

  const totalTarget     = subjects.reduce((a, s) => a + getTarget(s.key), 0)
  const totalHours      = sessions.reduce((a, b) => a + b.hours, 0)
  const totalPct        = Math.min(100, totalTarget === 0 ? 100 : Math.round(totalHours / totalTarget * 100))

  const avgWeeklyTarget = subjects.reduce((a, s) => a + getTarget(s.key) / WEEKS_REMAINING, 0)
  const weekHours       = hoursThisWeek(sessions)
  const weekTarget      = avgWeeklyTarget
  const weekPct         = Math.min(100, shouldShowBehind() ? Math.round(weekHours / weekTarget * 100) : 100)
  const weekTargetNow   = weekTarget * (weekDayNum() / 7)

  const streak    = currentStreak(sessions)
  const chartData = last7Days(sessions)
  const maxChart  = Math.max(...chartData.map(d => d.hours), 1)
  const dowLabel  = DOW_LABELS[TODAY.getDay()]

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1>⏱️ Horas de Estudo</h1>
          <p className="subtitle">
            {DAYS_REMAINING} dias restantes · {WEEKS_REMAINING.toFixed(1)} semanas · Hoje é {dowLabel}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={showPomodoro ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setShowPomodoro(v => !v)}>
            🍅 Pomodoro
          </button>
          <button className="btn btn-secondary" onClick={() => setShowTargets(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SlidersHorizontal size={14} />
            {showTargets ? 'Fechar' : 'Definir metas'}
          </button>
        </div>
      </div>

      {showPomodoro && (
        <div style={{ marginBottom: 24 }}>
          <PomodoroTimer subjects={subjects} />
        </div>
      )}

      {/* Target editor */}
      {showTargets && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <span className="card-title">Meta de horas por cadeira (semestre total)</span>
          </div>
          <div style={{ padding: '12px 20px' }}>
            {subjects.map(s => (
              <div key={s.key} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0', borderBottom: '1px solid var(--gray-50)',
              }}>
                <span style={{ fontSize: '1.1rem', width: 28 }}>{s.emoji}</span>
                <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-700)' }}>
                  {s.name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    step="5"
                    value={targets[s.key] !== undefined ? targets[s.key] : s.defaultTarget}
                    onChange={e => updateTarget(s.key, e.target.value)}
                    style={{
                      width: 76, fontFamily: 'inherit', fontSize: '0.9rem',
                      border: '1.5px solid var(--gray-200)', borderRadius: 8,
                      padding: '6px 8px', outline: 'none',
                      background: 'var(--white)', color: 'var(--gray-900)',
                      textAlign: 'center', fontWeight: 700,
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--rose-300)'}
                    onBlur={e => e.target.style.borderColor = 'var(--gray-200)'}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)', fontWeight: 600 }}>h</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', minWidth: 90 }}>
                    ~{(getTarget(s.key) / WEEKS_REMAINING).toFixed(1)}h/semana
                  </span>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 500 }}>
                Total: {totalTarget}h · Meta semanal: {avgWeeklyTarget.toFixed(1)}h
              </p>
              <button
                className="btn btn-ghost"
                style={{ fontSize: '0.72rem', color: 'var(--rose-400)' }}
                onClick={resetTargets}
              >
                Repor padrao
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Two main counters */}
      <div className="dashboard-grid" style={{ marginBottom: 14 }}>
        <div className="stat-card">
          <div className="stat-label"><Clock size={12} /> Total do semestre</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <div className="stat-value">{totalHours.toFixed(1)}</div>
            <span style={{ fontSize: '0.85rem', color: 'var(--gray-400)', fontWeight: 600 }}>/ {totalTarget}h</span>
          </div>
          <div className="progress-wrap" style={{ marginBottom: 6 }}>
            <div className="progress-fill" style={{ width: `${totalPct}%`, background: 'var(--rose-300)' }} />
          </div>
          <div className="stat-sub">{totalPct}% da meta global · {Math.max(0, totalTarget - totalHours).toFixed(1)}h em falta</div>
        </div>

        <div className="stat-card">
          <div className="stat-label"><Star size={12} /> Esta semana</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
            <div className="stat-value">{weekHours.toFixed(1)}</div>
            <span style={{ fontSize: '0.85rem', color: 'var(--gray-400)', fontWeight: 600 }}>/ {weekTarget.toFixed(1)}h</span>
          </div>
          <div className="progress-wrap" style={{ marginBottom: 6 }}>
            <div className="progress-fill" style={{
              width: `${weekPct}%`,
              background: weekPct >= 80 ? 'var(--green-400)' : weekPct >= 50 ? '#f59e0b' : 'var(--red-400)',
            }} />
          </div>
          <div className="stat-sub">
            Esperado ate {dowLabel}: {weekTargetNow.toFixed(1)}h
            {!shouldShowBehind() && ' · (segunda - sem pressao ainda)'}
          </div>
        </div>
      </div>

      {/* Streak */}
      <div className="stat-card" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <div className="stat-label"><Flame size={12} /> Streak</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>{streak} dias</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 40 }}>
            {chartData.map(d => {
              const h   = Math.max(0, (d.hours / maxChart) * 100)
              const isT = d.date === TODAY.toDateString()
              return (
                <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{
                    width: '100%', height: `${h}%`, minHeight: d.hours > 0 ? 4 : 0,
                    background: isT ? 'var(--rose-400)' : 'var(--rose-200)',
                    borderRadius: 3,
                  }} />
                  <span style={{ fontSize: '0.6rem', color: isT ? 'var(--rose-400)' : 'var(--gray-400)', fontWeight: isT ? 700 : 500 }}>
                    {d.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Per subject */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <span className="card-title">On Track — esperado ate {dowLabel}</span>
        </div>
        <div style={{ padding: '8px 20px 16px' }}>
          {subjects.length === 0 && (
            <p style={{ fontSize: '0.83rem', color: 'var(--gray-400)', padding: '8px 0' }}>
              Ainda sem cadeiras configuradas. Adiciona-as nas Definições.
            </p>
          )}
          {subjects.map(s => {
            const subjectTarget  = getTarget(s.key)
            const weeklyT        = subjectTarget / WEEKS_REMAINING
            const targetNow      = weeklyT * (weekDayNum() / 7)
            const totalDone      = hoursForSubject(sessions, s.key)
            const weekDone       = hoursForSubjectThisWeek(sessions, s.key)
            const color          = statusColor(weekDone, targetNow)
            const pct            = Math.min(100, targetNow < 0.1 ? 100 : Math.round(weekDone / targetNow * 100))
            const remaining      = Math.max(0, subjectTarget - totalDone)
            const deficit        = Math.max(0, targetNow - weekDone)
            const daysLeftInWeek = Math.max(1, 7 - weekDayNum())
            const isBehind       = shouldShowBehind() && pct < 80 && targetNow > 0.1
            const showSuggestions = expandedSuggestions[s.key]
            const suggestions    = isBehind ? getStudySuggestions(s, deficit, daysLeftInWeek, sessions) : []

            return (
              <div key={s.key} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: '0.9rem' }}>{s.emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.83rem', flex: 1, color: 'var(--gray-800)' }}>{s.name}</span>
                  <span style={{ fontSize: '0.73rem', fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 3 }}>
                    {statusIcon(weekDone, targetNow)} {statusLabel(weekDone, targetNow)}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontWeight: 600, minWidth: 140, textAlign: 'right' }}>
                    {weekDone.toFixed(1)}h semana · {totalDone.toFixed(1)}h / {subjectTarget}h
                  </span>
                </div>
                <div className="progress-wrap">
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: s.color, borderRadius: 50, transition: 'width 0.4s',
                  }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>
                    Faltam {remaining.toFixed(1)}h ate ao fim do semestre · meta semanal: {weeklyT.toFixed(1)}h
                  </span>
                  {isBehind && (
                    <button
                      onClick={() => setExpandedSuggestions(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: showSuggestions ? '#fef9c3' : '#fffbeb',
                        border: `1px solid ${showSuggestions ? '#fde047' : '#fde68a'}`,
                        borderRadius: 20, padding: '3px 9px',
                        fontSize: '0.68rem', fontWeight: 700, color: '#b45309',
                        cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                      }}
                    >
                      <Lightbulb size={10} />
                      Sugestões
                      {showSuggestions ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                  )}
                </div>

                {/* ── Suggestions panel ── */}
                {isBehind && showSuggestions && (
                  <div style={{
                    marginTop: 8, padding: '10px 12px',
                    background: '#fffbeb', border: '1px solid #fde68a',
                    borderRadius: 10,
                  }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                      💡 Para recuperar {deficit.toFixed(1)}h em atraso
                    </p>
                    {suggestions.map((sg, i) => (
                      <div key={i} style={{ marginBottom: sg.methods ? 6 : 5 }}>
                        <p style={{ fontSize: '0.78rem', color: '#78350f', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ flexShrink: 0 }}>{sg.emoji}</span>
                          <span>{sg.text}</span>
                        </p>
                        {sg.methods && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4, marginLeft: 20 }}>
                            {sg.methods.map((m, j) => (
                              <span key={j} style={{
                                background: s.color ? s.color + '22' : '#fef3c7',
                                border: `1px solid ${s.color ? s.color + '55' : '#fde68a'}`,
                                color: s.color || '#92400e',
                                borderRadius: 20, padding: '2px 9px',
                                fontSize: '0.72rem', fontWeight: 700,
                              }}>{m}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        setForm(p => ({ ...p, subject: s.key, hours: Math.ceil(deficit * 2) / 2 || 1 }))
                        setShowForm(true)
                        setExpandedSuggestions(prev => ({ ...prev, [s.key]: false }))
                      }}
                      style={{
                        marginTop: 6, padding: '5px 12px',
                        background: '#d97706', color: 'white', border: 'none',
                        borderRadius: 8, fontSize: '0.75rem', fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      + Registar sessão agora
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add session */}
      <button className="btn btn-primary" onClick={() => setShowForm(v => !v)} style={{ marginBottom: 14 }}>
        <Plus size={14} /> {showForm ? 'Cancelar' : 'Registar sessao'}
      </button>

      {showForm && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label className="form-label">Cadeira</label>
                <select className="form-input" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}>
                  {subjects.map(s => <option key={s.key} value={s.key}>{s.emoji} {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Horas</label>
                <input type="number" min="0.25" max="12" step="0.25" className="form-input"
                  placeholder="1.5" value={form.hours}
                  onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Data</label>
                <input type="date" className="form-input" value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Notas (opcional)</label>
              <input type="text" className="form-input" placeholder="O que estudaste..."
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addSession()} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Humor</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{emoji:'😴',label:'Cansada'},{emoji:'😐',label:'Normal'},{emoji:'😊',label:'Bem'},{emoji:'🔥',label:'Flow'}].map(m => (
                  <button key={m.emoji} type="button" onClick={() => setForm(p => ({ ...p, mood: m.emoji }))} title={m.label} style={{
                    width: 36, height: 36, borderRadius: 8, cursor: 'pointer', fontSize: '1.1rem',
                    border: `2px solid ${form.mood === m.emoji ? 'var(--rose-300)' : 'var(--gray-200)'}`,
                    background: form.mood === m.emoji ? 'var(--rose-50)' : 'var(--white)',
                  }}>{m.emoji}</button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={addSession}>
              <Plus size={14} /> Guardar sessao
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {sessions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Historial</span>
          </div>
          <div style={{ padding: '8px 20px 12px' }}>
            {sessions.slice(0, 20).map(session => {
              const subj = subjects.find(s => s.key === session.subject)
              return (
                <div key={session.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 0', borderBottom: '1px solid var(--gray-50)',
                }}>
                  <span>{subj?.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.83rem', color: subj?.textColor }}>{subj?.name}</span>
                      {session.mood && <span style={{ fontSize: '0.9rem' }}>{session.mood}</span>}
                    </div>
                    {session.notes && <p style={{ fontSize: '0.73rem', color: 'var(--gray-400)', margin: 0 }}>{session.notes}</p>}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gray-700)' }}>{session.hours}h</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)', minWidth: 80, textAlign: 'right' }}>{session.date}</span>
                  <button className="btn btn-ghost" onClick={() => { if (window.confirm('Apagar esta sessão?')) removeSession(session.id) }}><X size={12} /></button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}