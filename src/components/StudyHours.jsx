import { useState, useEffect } from 'react'
import { Plus, X, TrendingUp, TrendingDown, Minus, Clock, Flame, Star, SlidersHorizontal, ChevronDown, ChevronUp, Lightbulb, CalendarDays } from 'lucide-react'
import { computeWeeklyStreak } from '../utils/streak'
import { PomodoroTimer } from './PomodoroTimer'
import { getMondayOfWeek } from '../utils/dates'
import { useToast, ToastContainer } from './Toast'
import { computeAchievements } from '../utils/achievements'
import { CONFIDENCE } from '../constants'

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

const DOW_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function weekDayNum() {
  const dow = TODAY.getDay()
  return dow === 0 ? 7 : dow
}

function shouldShowBehind() { return weekDayNum() > 1 }

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
  return sessions.filter(s => s.subject === key).reduce((a, b) => a + (b.hours || 0), 0)
}

function hoursForSubjectThisWeek(sessions, key) {
  const monday = getMondayOfWeek(TODAY)
  return sessions
    .filter(s => s.subject === key && new Date(s.date) >= monday)
    .reduce((a, b) => a + (b.hours || 0), 0)
}

function hoursThisWeek(sessions) {
  const monday = getMondayOfWeek(TODAY)
  return sessions.filter(s => new Date(s.date) >= monday).reduce((a, b) => a + (b.hours || 0), 0)
}


function last7Days(sessions) {
  const result = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(TODAY)
    d.setDate(TODAY.getDate() - i)
    const key = d.toDateString()
    const hours = sessions.filter(s => s.date === key).reduce((a, b) => a + (b.hours || 0), 0)
    result.push({ label: d.toLocaleDateString('pt-PT', { weekday: 'short' }), hours, date: key })
  }
  return result
}

function getStudySuggestions(subject, deficit, daysLeftInWeek, sessions) {
  const suggestions = []
  const subjectSessions = sessions
    .filter(s => s.subject === subject.key)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  const lastSession = subjectSessions[0]
  const daysSinceLast = lastSession
    ? Math.max(0, Math.round((TODAY - new Date(lastSession.date)) / 86400000))
    : null
  const avgSessionLen = subjectSessions.length >= 2
    ? subjectSessions.slice(0, 8).reduce((a, b) => a + (b.hours || 0), 0) / Math.min(subjectSessions.length, 8)
    : null
  const recentMoods = subjectSessions.slice(0, 3).map(s => s.mood).filter(Boolean)
  const lowEnergy = recentMoods.length >= 2 && recentMoods.every(m => m === '😴' || m === '😐')

  // 1. Concrete recovery plan (split sensibly across remaining days)
  if (deficit > 0 && daysLeftInWeek > 0) {
    if (daysLeftInWeek === 1) {
      if (deficit <= 1.5) {
        suggestions.push({ emoji: '⏱️', text: `Faz ${deficit.toFixed(1)}h ainda hoje — uma sessão focada fecha o atraso` })
      } else {
        const blocks = Math.ceil(deficit / 1.5)
        const blockLen = (deficit / blocks).toFixed(1)
        suggestions.push({ emoji: '⏱️', text: `Divide as ${deficit.toFixed(1)}h em ${blocks} blocos de ${blockLen}h com 15–20min de pausa entre eles para não quebrar` })
      }
    } else {
      const todayH = Math.min(Math.ceil(deficit * 0.45 * 2) / 2, avgSessionLen ? avgSessionLen * 1.1 : 2)
      const restPerDay = Math.ceil(((deficit - todayH) / (daysLeftInWeek - 1)) * 2) / 2
      suggestions.push({
        emoji: '📅',
        text: `Plano de recuperação: ${todayH.toFixed(1)}h hoje + ${restPerDay.toFixed(1)}h/dia nos ${daysLeftInWeek - 1} dias seguintes — resolve o atraso sem sobrecarregar um único dia`,
      })
    }
  }

  // 2. Recency — specific advice based on gap
  if (daysSinceLast === null) {
    suggestions.push({ emoji: '🆕', text: `Ainda não registaste nenhuma sessão de ${subject.name} — começa por mapear os tópicos principais e criar um mini-plano de estudo` })
  } else if (daysSinceLast >= 6) {
    suggestions.push({ emoji: '⚠️', text: `${daysSinceLast} dias sem estudar esta cadeira — reserva os primeiros 20min para uma revisão rápida do que já sabes antes de avançar para matéria nova. Sem isso, a sessão vai ser ineficiente.` })
  } else if (daysSinceLast >= 3) {
    suggestions.push({ emoji: '🔁', text: `Última sessão há ${daysSinceLast} dias — relê os últimos 10min de notas antes de arrancar para não perder o fio ao raciocínio` })
  }

  // 3. Pomodoro with concrete numbers
  if (deficit >= 0.75) {
    const pomoCount = Math.max(1, Math.round(deficit * 60 / 25))
    const pomoHours = (pomoCount * 25 / 60).toFixed(1)
    suggestions.push({
      emoji: '🍅',
      text: lowEnergy
        ? `Com energia baixa, começa com 2 Pomodoros curtos (2×25min = 50min) — é menos intimidante e costuma desbloquear o ritmo`
        : `${pomoCount} Pomodoros (${pomoCount}×25min ≈ ${pomoHours}h) cobrem o atraso — inicia o timer sem negociar contigo mesma`,
    })
  }

  // 4. Exam proximity
  let upcomingExam = null
  try {
    const exams = JSON.parse(localStorage.getItem('exams')) || []
    upcomingExam = exams
      .filter(e => {
        const d = Math.round((new Date(e.date + 'T12:00:00') - TODAY) / 86400000)
        return d >= 0 && d <= 21 &&
          (e.subject?.toLowerCase() === subject.name?.toLowerCase() || e.subject === subject.key ||
           subject.name?.toLowerCase().includes(e.subject?.toLowerCase()))
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0]
  } catch (err) { console.error('StudyHours: failed to load upcoming exam', err) }
  if (upcomingExam) {
    const d = Math.round((new Date(upcomingExam.date + 'T12:00:00') - TODAY) / 86400000)
    const hoursPerDay = d > 0 ? (deficit / d).toFixed(1) : deficit.toFixed(1)
    if (d <= 3) {
      suggestions.push({ emoji: '🚨', text: `${upcomingExam.type || 'Teste'} daqui a ${d} dia${d !== 1 ? 's' : ''} — para o que tiveres a fazer e faz ${hoursPerDay}h/dia até lá. Foca em exercícios resolvidos, não em ler matéria nova.` })
    } else {
      suggestions.push({ emoji: '📌', text: `${upcomingExam.type || 'Teste'} em ${d} dias — com este atraso tens ~${hoursPerDay}h/dia disponíveis para te preparares. Não deixes acumular mais.` })
    }
  }

  // 5. Technique based on deficit size and methods configured
  const methods = subject.methods || []
  if (methods.length > 0) {
    const recommended = deficit > 2
      ? methods[0]
      : methods[Math.floor(Math.random() * methods.length)]
    suggestions.push({
      emoji: '📋',
      text: `Para este atraso, o método mais rentável desta cadeira é provavelmente "${recommended}" — ${deficit > 1.5 ? 'faz isso primeiro antes de passar para outros' : 'deve dar para cobrir numa boa sessão'}`,
    })
  } else if (deficit > 3) {
    suggestions.push({ emoji: '💡', text: `Com mais de 3h em atraso, divide assim: 1ª sessão → revisão dos apontamentos + identificar o que não sabes; 2ª sessão → exercícios sobre esses pontos fracos` })
  } else if (deficit > 1) {
    suggestions.push({ emoji: '💡', text: `Sessão de exercícios práticos > reler apontamentos — praticares ativamente recupera mais em menos tempo do que reler passivamente` })
  } else {
    suggestions.push({ emoji: '💡', text: `Com menos de 1h em falta, uma revisão activa de 45min (testa-te a ti própria em vez de releres) é suficiente` })
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
  const [showOnTrack, setShowOnTrack] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [editingSession, setEditingSession] = useState(null)
  const [editDraft, setEditDraft] = useState({})
  const [historySearch, setHistorySearch] = useState('')
  const [historySubject, setHistorySubject] = useState('')
  const [chartDays, setChartDays] = useState(7)
  const [postSession, setPostSession] = useState(null)
  const { toasts, toast, dismiss } = useToast()
  const [form, setForm] = useState({
    subject: subjects[0]?.key || '',
    hours: '',
    mins: '0',
    notes: '',
    mood: '😊',
    date: TODAY.toISOString().split('T')[0],
  })

  useEffect(() => { saveSessions(sessions) }, [sessions])
  useEffect(() => { saveTargets(targets) }, [targets])

  const getTarget = (key) => getTargetForKey(targets, key, defaultTarget)

  const addSession = () => {
    const h = parseFloat(form.hours) || 0
    const m = parseInt(form.mins) || 0
    const totalHours = parseFloat((h + m / 60).toFixed(2))
    if (totalHours <= 0) return
    const newSession = {
      id: Date.now(),
      subject: form.subject,
      hours: totalHours,
      notes: form.notes,
      mood: form.mood,
      date: new Date(form.date).toDateString(),
      startTime: null,
    }
    const achsBefore = computeAchievements(sessions)
    const achsAfter = computeAchievements([newSession, ...sessions])
    achsAfter.filter(a => !achsBefore.some(b => b.desc === a.desc))
      .forEach(ach => toast({ message: `${ach.icon} ${ach.desc}`, duration: 8000 }))
    setSessions(prev => [newSession, ...prev])
    setForm(p => ({ ...p, hours: '', mins: '0', notes: '', mood: '😊' }))
    setShowForm(false)
    try {
      const allTopics = JSON.parse(localStorage.getItem('topics') || '{}')
      const subjectObj = subjects.find(s => s.key === form.subject)
      const sTopics = allTopics[form.subject] || allTopics[subjectObj?.name || ''] || []
      const topicKey = allTopics[form.subject] ? form.subject : (subjectObj?.name || form.subject)
      if (sTopics.length > 0) setPostSession({ subjectKey: topicKey, topics: sTopics })
    } catch {}
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
  const totalHours      = sessions.reduce((a, b) => a + (b.hours || 0), 0)
  const totalPct        = Math.min(100, totalTarget === 0 ? 100 : Math.round(totalHours / totalTarget * 100))

  const avgWeeklyTarget = subjects.reduce((a, s) => a + getTarget(s.key) / WEEKS_REMAINING, 0)
  const weekHours       = hoursThisWeek(sessions)
  const weekTarget      = avgWeeklyTarget
  const weekPct         = Math.min(100, shouldShowBehind() ? Math.round(weekHours / weekTarget * 100) : 100)
  const weekTargetNow   = weekTarget * (weekDayNum() / 7)

  const saveEditSession = () => {
    const hours = parseFloat(editDraft.hours)
    if (!hours || hours <= 0) return
    setSessions(prev => prev.map(s => s.id === editingSession
      ? { ...s, hours, notes: editDraft.notes, mood: editDraft.mood, date: new Date(editDraft.date).toDateString() }
      : s
    ))
    setEditingSession(null)
    setEditDraft({})
  }

  const weeklyMin    = Math.max(5, Math.round(avgWeeklyTarget))
  const weeklyStreak = computeWeeklyStreak(sessions, weeklyMin)
  const chartData = (() => {
    const result = []
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(TODAY)
      d.setDate(TODAY.getDate() - i)
      const key = d.toDateString()
      const hours = sessions.filter(s => s.date === key).reduce((a, b) => a + (b.hours || 0), 0)
      const label = chartDays <= 7
        ? d.toLocaleDateString('pt-PT', { weekday: 'short' })
        : d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'numeric' })
      result.push({ label, hours, date: key })
    }
    return result
  })()
  const maxChart  = Math.max(...chartData.map(d => d.hours), 1)
  const dowLabel  = DOW_LABELS[TODAY.getDay()]

  // Weekday breakdown: average hours per day of week from all sessions
  const dowBreakdown = (() => {
    const totals = [0,0,0,0,0,0,0]
    const counts = [0,0,0,0,0,0,0]
    sessions.forEach(s => {
      const dow = new Date(s.date).getDay()
      totals[dow] += s.hours
      counts[dow]++
    })
    return [1,2,3,4,5,6,0].map(dow => ({
      label: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dow],
      avg: counts[dow] > 0 ? totals[dow] / counts[dow] : 0,
      dow,
    }))
  })()

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1>⏱️ Horas de Estudo</h1>
          <p className="subtitle">
            {DAYS_REMAINING} dias restantes · {WEEKS_REMAINING.toFixed(1)} semanas · Hoje é {dowLabel}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
            <Plus size={14} /> {showForm ? 'Cancelar' : 'Registar sessão'}
          </button>
          <button className={showPomodoro ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setShowPomodoro(v => !v)}>
            🍅 Pomodoro
          </button>
        </div>
      </div>

      {showPomodoro && (
        <div style={{ marginBottom: 24 }}>
          <PomodoroTimer subjects={subjects} />
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label className="form-label">Cadeira</label>
                <select className="form-input" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}>
                  {subjects.map(s => <option key={s.key} value={s.key}>{s.emoji} {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Horas</label>
                <input type="number" min="0" max="12" step="1" className="form-input"
                  placeholder="0" value={form.hours} autoFocus
                  onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Minutos</label>
                <select className="form-input" value={form.mins} onChange={e => setForm(p => ({ ...p, mins: e.target.value }))}>
                  {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => (
                    <option key={m} value={m}>{String(m).padStart(2,'0')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Data</label>
                <input type="date" className="form-input" value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Notas (opcional)</label>
              <textarea className="form-input" placeholder="O que estudaste..." rows={2}
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                style={{ resize: 'vertical', lineHeight: 1.5 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Humor</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{emoji:'😴',label:'Cansada'},{emoji:'😐',label:'Normal'},{emoji:'😊',label:'Bem'},{emoji:'🔥',label:'Flow'}].map(m => (
                  <button key={m.emoji} type="button" onClick={() => setForm(p => ({ ...p, mood: m.emoji }))} title={m.label} style={{
                    width: 36, height: 36, borderRadius: 'var(--r)', cursor: 'pointer', fontSize: '1.1rem',
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

      {/* Post-session topic confidence chips */}
      {postSession && (
        <div className="card" style={{ marginBottom: 14, background: 'var(--green-50)', border: '1.5px solid #86efac' }}>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontWeight: 800, color: '#15803d', margin: 0, fontSize: 'var(--t-body)' }}>
                ✅ Guardado! O que cobriste nesta sessão?
              </p>
              <button onClick={() => setPostSession(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', fontFamily: 'inherit', fontSize: 'var(--t-caption)', fontWeight: 600 }}>
                Fechar
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {postSession.topics.map(topic => {
                const conf = CONFIDENCE.find(c => c.id === topic.confidence) || CONFIDENCE[0]
                return (
                  <button key={topic.id}
                    onClick={() => {
                      const ids = ['unknown', 'little', 'good', 'great']
                      const idx = ids.indexOf(topic.confidence)
                      const next = ids[Math.min(idx + 1, ids.length - 1)]
                      try {
                        const raw = JSON.parse(localStorage.getItem('topics') || '{}')
                        const subs = raw[postSession.subjectKey] || []
                        raw[postSession.subjectKey] = subs.map(t => t.id === topic.id ? { ...t, confidence: next } : t)
                        localStorage.setItem('topics', JSON.stringify(raw))
                        setPostSession(ps => ({ ...ps, topics: ps.topics.map(t => t.id === topic.id ? { ...t, confidence: next } : t) }))
                      } catch {}
                    }}
                    style={{
                      padding: '5px 12px', borderRadius: 50, fontFamily: 'inherit',
                      fontSize: 'var(--t-caption)', fontWeight: 700, cursor: 'pointer',
                      background: conf.bg, color: conf.color,
                      border: `1.5px solid ${conf.color}44`,
                      transition: 'all 0.15s',
                    }}
                  >
                    {topic.name}
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: 'var(--t-caption)', color: '#16a34a', margin: 0, fontWeight: 500 }}>
              Clica num tópico para aumentar a confiança · fica guardado em Exames
            </p>
          </div>
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
                <span style={{ flex: 1, fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--gray-700)' }}>
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
                      width: 76, fontFamily: 'inherit', fontSize: 'var(--t-body)',
                      border: '1.5px solid var(--gray-200)', borderRadius: 'var(--r)',
                      padding: '6px 8px', outline: 'none',
                      background: 'var(--white)', color: 'var(--gray-900)',
                      textAlign: 'center', fontWeight: 700,
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--rose-300)'}
                    onBlur={e => e.target.style.borderColor = 'var(--gray-200)'}
                  />
                  <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 600 }}>h</span>
                  <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', minWidth: 90 }}>
                    ~{(getTarget(s.key) / WEEKS_REMAINING).toFixed(1)}h/semana
                  </span>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 500 }}>
                Total: {totalTarget}h · Meta semanal: {avgWeeklyTarget.toFixed(1)}h
              </p>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 'var(--t-caption)', color: 'var(--rose-400)' }}
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
            <span style={{ fontSize: 'var(--t-body)', color: 'var(--gray-400)', fontWeight: 600 }}>/ {totalTarget}h</span>
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
            <span style={{ fontSize: 'var(--t-body)', color: 'var(--gray-400)', fontWeight: 600 }}>/ {weekTarget.toFixed(1)}h</span>
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

      {/* Weekly streak + daily activity chart */}
      <div className="stat-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 12 }}>
          {/* Streak */}
          <div style={{ minWidth: 0 }}>
            <div className="stat-label"><Flame size={12} /> Streak semanal</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span className="stat-value" style={{ fontSize: '1.5rem' }}>{weeklyStreak.current}</span>
              <span style={{ fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--gray-400)' }}>
                semana{weeklyStreak.current !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="stat-sub" style={{ marginTop: 2 }}>
              meta: {weeklyMin}h/sem{weeklyStreak.best > weeklyStreak.current ? ` · recorde ${weeklyStreak.best}` : ''}
            </div>
          </div>
          {/* Weeks hit */}
          <div style={{ minWidth: 0 }}>
            <div className="stat-label"><CalendarDays size={12} /> Metas cumpridas</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span className="stat-value" style={{ fontSize: '1.5rem' }}>{weeklyStreak.weeksHit}</span>
              <span style={{ fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--gray-400)' }}>semanas</span>
            </div>
            <div className="stat-sub" style={{ marginTop: 2 }}>semanas com ≥{weeklyMin}h (total)</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 4, alignSelf: 'flex-start' }}>
            {[7,30].map(n => (
              <button key={n} onClick={() => setChartDays(n)} style={{
                padding: '3px 10px', borderRadius: 50, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 'var(--t-caption)', fontWeight: 700, border: `1.5px solid ${chartDays === n ? 'var(--rose-300)' : 'var(--gray-200)'}`,
                background: chartDays === n ? 'var(--rose-50)' : 'var(--white)', color: chartDays === n ? 'var(--rose-400)' : 'var(--gray-400)',
              }}>{n}d</button>
            ))}
          </div>
        </div>
        <div className="stat-label" style={{ marginBottom: 6 }}>Actividade diária</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: chartDays > 7 ? 2 : 5, height: 50 }}>
          {chartData.map(d => {
            const h   = Math.max(0, (d.hours / maxChart) * 100)
            const isT = d.date === TODAY.toDateString()
            return (
              <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{
                  width: '100%', height: `${h}%`, minHeight: d.hours > 0 ? 3 : 0,
                  background: isT ? 'var(--rose-400)' : 'var(--rose-200)',
                  borderRadius: 2,
                }} />
                {chartDays <= 14 && (
                  <span style={{ fontSize: 'var(--t-caption)', color: isT ? 'var(--rose-400)' : 'var(--gray-400)', fontWeight: isT ? 700 : 500 }}>
                    {d.label}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Weekday breakdown */}
      {sessions.length >= 5 && (
        <div className="card" style={{ marginBottom: 14, padding: '16px 20px' }}>
          <p style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)', letterSpacing: '0.07em', marginBottom: 14 }}>
            Média de horas por dia da semana
          </p>
          {(() => {
            const maxAvg = Math.max(...dowBreakdown.map(d => d.avg), 0.1)
            const best = dowBreakdown.reduce((b, d) => d.avg > b.avg ? d : b, dowBreakdown[0])
            const todayDow = TODAY.getDay()
            return (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                {dowBreakdown.map(d => {
                  const pct = d.avg > 0 ? d.avg / maxAvg : 0
                  const isToday = d.dow === todayDow
                  const isBest = d.dow === best.dow
                  const color = isBest ? '#16a34a' : isToday ? 'var(--rose-400)' : 'var(--gray-300)'
                  return (
                    <div key={d.dow} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                      {d.avg > 0 && (
                        <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color, lineHeight: 1 }}>
                          {d.avg.toFixed(1)}h
                        </span>
                      )}
                      <div style={{ width: '100%', height: `${Math.max(pct * 52, d.avg > 0 ? 4 : 2)}px`, background: color, borderRadius: '4px 4px 0 0', transition: 'height 0.3s', opacity: d.avg > 0 ? 1 : 0.25 }} />
                      <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: isToday ? 'var(--rose-400)' : 'var(--gray-400)', lineHeight: 1 }}>{d.label}</span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* Per subject */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <span className="card-title">On Track — esperado ate {dowLabel}</span>
          <button
            onClick={() => setShowOnTrack(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 4, display: 'flex', alignItems: 'center' }}
          >
            {showOnTrack ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {showOnTrack && <div style={{ padding: '8px 20px 16px' }}>
          {subjects.length === 0 && (
            <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-400)', padding: '8px 0' }}>
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
                  <span style={{ fontSize: 'var(--t-body)' }}>{s.emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: 'var(--t-body)', flex: 1, color: 'var(--gray-800)' }}>{s.name}</span>
                  <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 3 }}>
                    {statusIcon(weekDone, targetNow)} {statusLabel(weekDone, targetNow)}
                  </span>
                  <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 600, minWidth: 140, textAlign: 'right' }}>
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
                  <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>
                    Faltam {remaining.toFixed(1)}h ate ao fim do semestre · meta semanal: {weeklyT.toFixed(1)}h
                  </span>
                  {isBehind && (
                    <button
                      onClick={() => setExpandedSuggestions(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: showSuggestions ? 'var(--amber-100)' : 'var(--amber-50)',
                        border: `1px solid ${showSuggestions ? '#fde047' : '#fde68a'}`,
                        borderRadius: 'var(--r-pill)', padding: '3px 9px',
                        fontSize: 'var(--t-caption)', fontWeight: 700, color: '#b45309',
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
                    marginTop: 8, padding: '12px 14px',
                    background: 'var(--amber-50)', border: '1px solid #fde68a',
                    borderRadius: 'var(--r)',
                  }}>
                    <p style={{ fontSize: 'var(--t-caption)', fontWeight: 800, color: '#92400e', letterSpacing: 0.4, marginBottom: 10 }}>
                      Como recuperar {deficit.toFixed(1)}h em atraso
                    </p>
                    {suggestions.map((sg, i) => (
                      <div key={i} style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ flexShrink: 0, fontSize: '1rem', lineHeight: 1.4 }}>{sg.emoji}</span>
                        <p style={{ fontSize: 'var(--t-body)', color: '#78350f', lineHeight: 1.55, margin: 0 }}>{sg.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>}
      </div>

      {/* History */}
      {sessions.length === 0 && (
        <div style={{
          marginBottom: 20, padding: '28px 24px', textAlign: 'center',
          background: 'var(--white)', borderRadius: 'var(--r)',
          border: '1.5px dashed var(--gray-200)',
        }}>
          <p style={{ fontSize: '2rem', marginBottom: 10 }}>⏱️</p>
          <p style={{ fontWeight: 800, color: 'var(--gray-800)', marginBottom: 6, fontSize: 'var(--t-body)' }}>
            Nenhuma sessão registada ainda
          </p>
          <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-400)', marginBottom: 16, lineHeight: 1.55 }}>
            Cada sessão conta — mesmo 30 minutos. Começa agora.
          </p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Registar primeira sessão
          </button>
        </div>
      )}
      {sessions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Historial</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Pesquisar notas..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                style={{ fontSize: 'var(--t-caption)', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '4px 8px', fontFamily: 'inherit', color: 'var(--gray-900)', background: 'var(--white)', outline: 'none', width: 140 }}
              />
              <select value={historySubject} onChange={e => setHistorySubject(e.target.value)}
                style={{ fontSize: 'var(--t-caption)', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '4px 8px', fontFamily: 'inherit', color: 'var(--gray-900)', background: 'var(--white)', outline: 'none' }}>
                <option value="">Todas</option>
                {subjects.map(s => <option key={s.key} value={s.key}>{s.emoji} {s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ padding: '8px 20px 12px' }}>
            {sessions.filter(s => {
              if (historySubject && s.subject !== historySubject) return false
              if (historySearch && !(s.notes||'').toLowerCase().includes(historySearch.toLowerCase())) return false
              return true
            }).slice(0, 30).map(session => {
              const subj = subjects.find(s => s.key === session.subject)
              const isEditing = editingSession === session.id
              return (
                <div key={session.id} style={{ borderBottom: '1px solid var(--gray-50)', borderLeft: `3px solid ${subj?.color || 'var(--gray-200)'}`, paddingLeft: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                    <span>{subj?.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--t-body)', color: subj?.textColor }}>{subj?.name}</span>
                        {session.mood && <span style={{ fontSize: 'var(--t-body)' }}>{session.mood}</span>}
                      </div>
                      {session.notes && <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', margin: 0 }}>{session.notes}</p>}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 'var(--t-body)', color: 'var(--gray-700)' }}>{session.hours}h</span>
                    <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', minWidth: 80, textAlign: 'right' }}>{session.date}</span>
                    <button className="btn btn-ghost" style={{ fontSize: 'var(--t-caption)', padding: '2px 6px' }}
                      onClick={() => { setEditingSession(isEditing ? null : session.id); setEditDraft({ hours: session.hours, notes: session.notes || '', mood: session.mood || '😊', date: new Date(session.date).toISOString().split('T')[0] }) }}>
                      ✏️
                    </button>
                    {confirmDeleteId === session.id ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button className="btn" onClick={() => { removeSession(session.id); setConfirmDeleteId(null) }}
                          style={{ fontSize: 'var(--t-caption)', padding: '3px 8px', background: 'var(--red-100)', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 6 }}>
                          Apagar
                        </button>
                        <button className="btn" onClick={() => setConfirmDeleteId(null)}
                          style={{ fontSize: 'var(--t-caption)', padding: '3px 8px', background: 'var(--gray-100)', color: 'var(--gray-600)', border: '1px solid var(--gray-200)', borderRadius: 6 }}>
                          Não
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost" onClick={() => setConfirmDeleteId(session.id)}><X size={12} /></button>
                    )}
                  </div>
                  {isEditing && (
                    <div style={{ padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 'var(--r)', marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div>
                        <label className="form-label">Horas</label>
                        <input type="number" min="0.25" max="12" step="0.25" className="form-input" style={{ width: 70 }}
                          value={editDraft.hours} onChange={e => setEditDraft(p => ({ ...p, hours: e.target.value }))} />
                      </div>
                      <div>
                        <label className="form-label">Data</label>
                        <input type="date" className="form-input" style={{ width: 130 }}
                          value={editDraft.date} onChange={e => setEditDraft(p => ({ ...p, date: e.target.value }))} />
                      </div>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <label className="form-label">Notas</label>
                        <input type="text" className="form-input" value={editDraft.notes}
                          onChange={e => setEditDraft(p => ({ ...p, notes: e.target.value }))} />
                      </div>
                      <button className="btn btn-primary" style={{ fontSize: 'var(--t-caption)', padding: '6px 12px' }} onClick={saveEditSession}>Guardar</button>
                      <button className="btn btn-secondary" style={{ fontSize: 'var(--t-caption)', padding: '6px 12px' }} onClick={() => setEditingSession(null)}>Cancelar</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}