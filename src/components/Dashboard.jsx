import { useState, useEffect, useMemo } from 'react'
import { Clock, ChevronRight, Target, TrendingUp, TrendingDown, Minus, RotateCcw } from 'lucide-react'
import { getTasksForDay } from '../data/schedule'
import { getMondayOfWeek, daysUntil } from '../utils/dates'
import { suggestNextSession } from '../utils/suggestNextSession'
import { withoutClosedSubjects } from '../utils/subjects'
import { SundayPlanning } from './SundayPlanning'

const TODAY = new Date()

function loadSessions()      { try { return JSON.parse(localStorage.getItem('study-sessions')) || [] } catch { return [] } }
function loadExams()         { try { return JSON.parse(localStorage.getItem('exams')) || [] } catch { return [] } }
function loadDone()          { try { return JSON.parse(localStorage.getItem(`tasks-${TODAY.toDateString()}`)) || {} } catch { return {} } }
function loadTargets()       { try { return JSON.parse(localStorage.getItem('subject-targets')) || {} } catch { return {} } }
function loadWeeklyTargets() { try { return JSON.parse(localStorage.getItem('weekly-targets')) || {} } catch { return {} } }
function loadExtra()         { try { return JSON.parse(localStorage.getItem('extra-tasks')) || [] } catch { return [] } }
function loadMatrix()        { try { return JSON.parse(localStorage.getItem('eisenhower-overrides')) || {} } catch { return {} } }
// Plano semanal mais recente — visível só durante a semana (7 dias após ser criado).
function loadCurrentWeekPlan() {
  try {
    const plans = JSON.parse(localStorage.getItem('weekly-plans')) || []
    const latest = plans[0]
    if (!latest) return null
    return (Date.now() - latest.id) <= 7 * 86400000 ? latest : null
  } catch { return null }
}

const QUADRANT_PRIORITY = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 }

function rankTasks(todayGroups, extra, done, matrix, subjects) {
  const candidates = []
  for (const g of todayGroups) {
    const subj = subjects.find(s => s.key === g.subjectKey)
    for (const t of g.tasks) {
      if (!done[t.id]) candidates.push({ ...t, subjectKey: g.subjectKey, subjectName: subj?.name, subjectEmoji: subj?.emoji, subjectColor: subj?.color })
    }
  }
  for (const t of extra) {
    if (!done[t.id]) {
      let subj = null
      if (t.subjectKey) subj = subjects.find(s => s.key === t.subjectKey)
      if (!subj && t.emoji) subj = subjects.find(s => s.emoji === t.emoji)
      candidates.push({
        ...t,
        subjectKey:   subj?.key   ?? null,
        subjectName:  subj?.name  ?? null,
        subjectEmoji: subj?.emoji ?? t.emoji ?? null,
        subjectColor: subj?.color ?? null,
      })
    }
  }
  candidates.sort((a, b) => {
    const qa = QUADRANT_PRIORITY[matrix[a.id]] ?? 4
    const qb = QUADRANT_PRIORITY[matrix[b.id]] ?? 4
    return qa - qb
  })
  return candidates
}

const MOODS = [
  { emoji: '😴', label: 'Cansada' },
  { emoji: '😐', label: 'Normal' },
  { emoji: '😊', label: 'Bem' },
  { emoji: '🔥', label: 'Flow' },
]

function weekDayNumber() { const d = TODAY.getDay(); return d === 0 ? 7 : d }
function shouldShowBehind() { return weekDayNumber() > 1 }


function hoursThisWeek(sessions) {
  const monday = getMondayOfWeek(TODAY)
  return sessions.filter(s => new Date(s.date) >= monday).reduce((a, b) => a + (b.hours || 0), 0)
}

function hoursForSubjectThisWeek(sessions, key) {
  const monday = getMondayOfWeek(TODAY)
  return sessions.filter(s => s.subject === key && new Date(s.date) >= monday).reduce((a, b) => a + (b.hours || 0), 0)
}

function trackStatus(done, target) {
  if (!shouldShowBehind() || target < 0.1) return 'green'
  const pct = done / target * 100
  if (pct >= 80) return 'green'
  if (pct >= 50) return 'amber'
  return 'red'
}

function trackIcon(status) {
  if (status === 'green') return <TrendingUp size={11} />
  if (status === 'amber') return <Minus size={11} />
  return <TrendingDown size={11} />
}

function greetingText() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

const EXAM_TYPES = ['Exame', 'Teste', 'Mini-teste']

function scoreSubject(s, sessions, exams, weeklyGoal) {
  const hrs  = hoursForSubjectThisWeek(sessions, s.key)
  const tNow = weeklyGoal * (weekDayNumber() / 7)
  const status = trackStatus(hrs, tNow)
  const nextE  = exams.find(e => e.date && EXAM_TYPES.includes(e.type) && daysUntil(e.date) >= 0 &&
    (e.subject?.toLowerCase() === s.name?.toLowerCase() || e.subject === s.key))
  const examDays = nextE ? daysUntil(nextE.date) : 999
  let score = 0
  if (status === 'red')   score += 100
  if (status === 'amber') score += 50
  score += Math.max(0, 100 - (tNow < 0.1 ? 100 : hrs / tNow * 100))
  if (examDays <= 7)  score += 200
  if (examDays <= 21) score += 80
  return { ...s, score, status, hrs, weeklyGoal, tNow }
}


export default function Dashboard({ onNavigate, settings, onOpenCadeira }) {
  const subjects = (settings?.subjects || []).filter(s => !s.closed)
  const [mood, setMood] = useState('😊')
  const [suggIdx, setSuggIdx] = useState(0)
  const [topTaskIdx, setTopTaskIdx] = useState(0)
  const [weeklyTargets, setWeeklyTargets] = useState(loadWeeklyTargets)
  const [editTarget, setEditTarget] = useState(null)
  const [targetDraft, setTargetDraft] = useState('')
  const [showSundayPlanning, setShowSundayPlanning] = useState(false)
  const [weekPlan, setWeekPlan] = useState(loadCurrentWeekPlan)

  const SEMESTER_END   = settings?.periodEnd ? new Date(settings.periodEnd) : new Date(Date.now() + 120 * 86400000)
  const DAYS_REMAINING = Math.max(0, Math.round((SEMESTER_END - TODAY) / 86400000))
  const WEEKS_REMAINING = Math.max(1, DAYS_REMAINING / 7)

  const getTarget = (key) => {
    const targets = loadTargets()
    const val = targets[key]
    const num = parseFloat(val)
    if (val !== undefined && val !== '' && !isNaN(num) && num > 0) return num
    return settings?.hoursGoal / Math.max(1, subjects.length) || 110
  }

  const [sessions, setSessions] = useState(loadSessions)

  useEffect(() => {
    const refresh = () => setSessions(loadSessions())
    const handler = (e) => { if (e.key === 'study-sessions') refresh() }
    window.addEventListener('storage', handler)
    const id = setInterval(refresh, 3000)
    return () => { window.removeEventListener('storage', handler); clearInterval(id) }
  }, [])

  const exams    = withoutClosedSubjects(loadExams(), settings)
  const done     = loadDone()

  const weekHrs  = hoursThisWeek(sessions)
  const totalHrs = sessions.reduce((a, b) => a + (b.hours || 0), 0)

  const lastWeekHrs = (() => {
    const monday = getMondayOfWeek(TODAY)
    const lastMonday = new Date(monday); lastMonday.setDate(monday.getDate() - 7)
    return sessions.filter(s => { const d = new Date(s.date); return d >= lastMonday && d < monday })
      .reduce((a, b) => a + (b.hours || 0), 0)
  })()
  const trendPct  = lastWeekHrs > 0 ? Math.round((weekHrs - lastWeekHrs) / lastWeekHrs * 100) : null
  const trendDiff = lastWeekHrs > 0 ? parseFloat((weekHrs - lastWeekHrs).toFixed(1)) : null

  // Today's tasks
  const todaySchedule = getTasksForDay(TODAY.getDay())
  const todayGroups   = todaySchedule.map(g => ({
    ...g,
    subject: subjects.find(s => s.key === g.subjectKey),
    tasks: g.tasks.map(t => ({ ...t, done: !!done[t.id] })),
  }))
  const allExtra      = loadExtra()
  // Filter extras to only those relevant for today (same logic as DailyView)
  const inferExtraDate = (t) => {
    if (t.createdDate) return t.createdDate
    try { const ts = parseInt(t.id.replace('extra-', ''), 10); if (!isNaN(ts) && ts > 1e12) return new Date(ts).toDateString() } catch {}
    return null
  }
  const todayExtraTasks = allExtra.filter(t => {
    if (t.recurrence === 'daily') return true
    if (t.recurrence === 'weekly') return TODAY.getDay() === t.createdDow
    const eff = inferExtraDate(t)
    return eff ? TODAY.toDateString() === eff : true
  })
  const pendingExtra  = todayExtraTasks.filter(t => !done[t.id])
  const allTodayCount = todaySchedule.flatMap(g => g.tasks).length + todayExtraTasks.length
  const allDoneCount  = todaySchedule.flatMap(g => g.tasks).filter(t => done[t.id]).length +
                        (todayExtraTasks.length - pendingExtra.length)
  const todayPct      = allTodayCount === 0 ? 100 : Math.round(allDoneCount / allTodayCount * 100)

  // Next exam
  const nextExam = exams.filter(e => daysUntil(e.date) > 0 && EXAM_TYPES.includes(e.type))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0]
  const urgency = nextExam ? (() => {
    const d = daysUntil(nextExam.date)
    if (d <= 7)  return { color: 'var(--red-400)',   label: 'Urgente' }
    if (d <= 21) return { color: 'var(--amber-400)', label: 'Em breve' }
    return { color: 'var(--green-500)', label: 'Com tempo' }
  })() : null

  const onTrackRows = subjects.length > 0 ? subjects.map(s => {
    const wGoal = weeklyTargets[s.key] !== undefined ? parseFloat(weeklyTargets[s.key]) : getTarget(s.key) / WEEKS_REMAINING
    return scoreSubject(s, sessions, exams, wGoal)
  }).sort((a, b) => b.score - a.score) : []

  const matrix    = loadMatrix()
  const allTasks  = rankTasks(todayGroups, todayExtraTasks, done, matrix, subjects)
  const topTask   = allTasks.length > 0 ? allTasks[topTaskIdx % allTasks.length] : null

  // Daily study suggestion per subject — weekly-based
  // Distributes the weekly deficit over the remaining days of the week
  const DAYS_LEFT_IN_WEEK = (() => {
    const dow = TODAY.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
    return dow === 0 ? 1 : (8 - dow)
  })()

  const dailySuggestions = (() => {
    if (subjects.length === 0) return []
    const monday = getMondayOfWeek(TODAY)
    const todayStr = TODAY.toDateString()
    return subjects.map(s => {
      const weeklyGoal = weeklyTargets[s.key] !== undefined
        ? parseFloat(weeklyTargets[s.key])
        : getTarget(s.key) / WEEKS_REMAINING
      if (!weeklyGoal || weeklyGoal <= 0) return null
      const subSessions = sessions.filter(x => x.subject === s.key)
      const doneThisWeekBeforeToday = subSessions
        .filter(x => new Date(x.date) >= monday && x.date !== todayStr)
        .reduce((a, b) => a + (b.hours || 0), 0)
      const doneToday = subSessions.filter(x => x.date === todayStr).reduce((a, b) => a + (b.hours || 0), 0)
      // Remaining weekly hours (deficit included), distributed over days left in the week
      const weeklyRemaining = Math.max(0, weeklyGoal - doneThisWeekBeforeToday)
      const dailyQuota = weeklyRemaining / DAYS_LEFT_IN_WEEK
      const rawStillNeeded = Math.max(0, dailyQuota - doneToday)
      const stillNeeded = parseFloat(rawStillNeeded.toFixed(1))
      return { ...s, doneToday: parseFloat(doneToday.toFixed(1)), dailyQuota: parseFloat(dailyQuota.toFixed(1)), stillNeeded, rawStillNeeded }
    }).filter(s => s && s.rawStillNeeded > 0.05).sort((a, b) => b.stillNeeded - a.stillNeeded)
  })()

  // Spaced repetition: topics due for review today
  const reviewDue = useMemo(() => {
    if (subjects.length === 0) return []
    try {
      const topicsMap = JSON.parse(localStorage.getItem('topics') || '{}')
      const INTERVALS = { unknown: 1, little: 3, good: 7, great: 14 }
      const todayD = new Date(); todayD.setHours(0, 0, 0, 0)
      const due = []
      subjects.forEach(s => {
        const subTopics = topicsMap[s.key] || topicsMap[s.name] || []
        subTopics.forEach(t => {
          if (!t.lastReviewed) return // never reviewed yet — not due
          const last = new Date(t.lastReviewed); last.setHours(0, 0, 0, 0)
          const daysSince = Math.round((todayD - last) / 86400000)
          if (daysSince >= (INTERVALS[t.confidence || 'unknown'])) {
            due.push({ ...t, subjectName: s.name, subjectEmoji: s.emoji, subjectColor: s.color })
          }
        })
      })
      return due
    } catch { return [] }
  }, [subjects])

  // Hero suggestions (ranked list from utility)
  const suggestions = suggestNextSession({
    subjects, sessions, exams, weeklyTargets, mood,
    todaySchedule, done,
    getWeeklyGoal: getTarget,
    weeksRemaining: WEEKS_REMAINING,
  })
  const safeIdx   = suggestions.length > 0 ? suggIdx % suggestions.length : 0
  const suggestion = suggestions[safeIdx] ?? null

  const heroColor      = suggestion?.color || 'var(--accent-400)'
  const heroColorFaint  = suggestion?.color ? suggestion.color + '18' : 'var(--accent-50)'
  const heroColorBorder = suggestion?.color ? suggestion.color + '40' : 'var(--accent-100)'


  return (
    <div className="fade-in">
      {showSundayPlanning && <SundayPlanning onClose={() => { setShowSundayPlanning(false); setWeekPlan(loadCurrentWeekPlan()) }} />}

      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: -0.8, color: 'var(--gray-900)', marginBottom: 2 }}>
          {greetingText()} 👋
        </h1>
        <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-400)', fontWeight: 500 }}>
          {TODAY.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* ── 1. HERO ─────────────────────────────────────────────────── */}
      {suggestion ? (
        <div style={{
          background: heroColorFaint,
          border: `1.5px solid ${heroColorBorder}`,
          borderRadius: 'var(--r)',
          padding: '22px 24px',
          marginBottom: 14,
        }}>
          {/* Label row */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 700, letterSpacing: '0.04em' }}>
              PRÓXIMOS 90 MIN
            </p>
          </div>

          {/* Main content: task (if exists) or subject suggestion */}
          {topTask ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
              <span style={{ fontSize: '2.2rem', lineHeight: 1, flexShrink: 0, marginTop: 2 }}>
                {topTask.subjectEmoji || suggestion.emoji}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 'var(--t-heading)', fontWeight: 800, color: 'var(--gray-900)', letterSpacing: -0.5, lineHeight: 1.2, marginBottom: 6 }}>
                  {topTask.label}
                </p>
                <p style={{ fontSize: 'var(--t-body)', color: topTask.subjectColor || heroColor, fontWeight: 600, margin: 0 }}>
                  {topTask.subjectName || suggestion?.name}
                  {matrix[topTask.id] && <span style={{ marginLeft: 6, opacity: 0.6, fontWeight: 500 }}>· {matrix[topTask.id]}</span>}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
              <span style={{ fontSize: '2.2rem', lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{suggestion.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  onClick={() => onOpenCadeira?.(suggestion.key)}
                  style={{ fontSize: 'var(--t-heading)', fontWeight: 800, color: 'var(--gray-900)', letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 8, cursor: onOpenCadeira ? 'pointer' : 'default' }}
                >
                  {suggestion.name}
                </p>
                <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-500)', lineHeight: 1.55, margin: 0 }}>
                  {suggestion.reason}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                const prefillKey = topTask ? topTask.subjectKey : suggestion.key
                const prefillTitle = topTask ? topTask.label : suggestion.name
                localStorage.setItem('pomodoro-prefill', JSON.stringify({ subjectKey: prefillKey, title: prefillTitle }))
                onNavigate('hours')
              }}
              style={{
                padding: '10px 20px', borderRadius: 'var(--r)', border: 'none',
                background: heroColor, color: '#fff', fontFamily: 'inherit',
                fontWeight: 700, fontSize: 'var(--t-body)', cursor: 'pointer',
              }}
            >
              Começar Pomodoro
            </button>
            {(allTasks.length > 1 || suggestions.length > 1) && (
              <button
                onClick={() => {
                  if (allTasks.length > 1) {
                    setTopTaskIdx(i => (i + 1) % allTasks.length)
                  } else {
                    setSuggIdx(i => (i + 1) % suggestions.length)
                  }
                }}
                style={{
                  padding: '10px 16px', borderRadius: 'var(--r)',
                  border: `1.5px solid ${heroColorBorder}`,
                  background: 'var(--white)', fontFamily: 'inherit',
                  fontWeight: 600, fontSize: 'var(--t-body)', cursor: 'pointer',
                  color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <RotateCcw size={13} strokeWidth={2} />
                Outra sugestão
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          background: 'var(--gray-50)', border: '1.5px dashed var(--gray-200)',
          borderRadius: 'var(--r)', padding: '28px 24px',
          marginBottom: 14, textAlign: 'center',
        }}>
          <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-400)', fontWeight: 500, marginBottom: 10 }}>
            Configura as tuas cadeiras para começar
          </p>
          <button className="btn btn-primary" onClick={() => onNavigate('settings')}>
            Ir para Definições
          </button>
        </div>
      )}

      {/* ── 2. ESTA SEMANA ─────────────────────────────────────────── */}
      <div className="dashboard-grid" style={{ marginBottom: 14 }}>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('hours')}>
          <div className="stat-label"><Clock size={12} /> Esta semana</div>
          {totalHrs === 0 ? (
            <>
              <div style={{ fontSize: 'var(--t-body)', fontWeight: 700, color: 'var(--rose-400)', marginTop: 6, marginBottom: 2 }}>
                Regista a primeira sessão →
              </div>
              <div className="stat-sub">Clica para abrir Horas</div>
            </>
          ) : (
            <>
              <div className="stat-value">
                {weekHrs.toFixed(1)}<span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-400)' }}>h</span>
              </div>
              <div className="stat-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {totalHrs.toFixed(0)}h no total
                {trendPct !== null && [0, 6].includes(TODAY.getDay()) && (
                  <span style={{
                    fontSize: 'var(--t-caption)', fontWeight: 700, padding: '1px 6px', borderRadius: 50,
                    background: trendPct >= 0 ? 'var(--green-50)' : 'var(--red-50)',
                    color: trendPct >= 0 ? 'var(--green-500)' : 'var(--red-400)',
                  }}>
                    {trendDiff >= 0 ? '+' : ''}{trendDiff}h vs sem. passada
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 3. PRÓXIMO EXAME ───────────────────────────────────────── */}
      {!nextExam && exams.length === 0 && subjects.length > 0 && (
        <button
          onClick={() => onNavigate('exams')}
          style={{
            width: '100%', marginBottom: 14, padding: '13px 18px',
            background: 'var(--gray-50)', border: '1.5px dashed var(--gray-200)',
            borderRadius: 'var(--r)', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 'var(--t-body)', color: 'var(--gray-500)', fontWeight: 600 }}>
            🎯 Que exames tens este semestre?
          </span>
          <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--rose-400)', flexShrink: 0 }}>
            + Adicionar →
          </span>
        </button>
      )}
      {nextExam && (
        <div className="exam-card" style={{ cursor: 'pointer', marginBottom: 14 }} onClick={() => onNavigate('exams')}>
          <div className="exam-countdown">
            <div className="exam-countdown-num" style={{ color: urgency.color }}>{daysUntil(nextExam.date)}</div>
            <div className="exam-countdown-label">dias</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <p className="exam-info-title">{nextExam.subject}</p>
              <span className={`status-pill status-${daysUntil(nextExam.date) <= 7 ? 'red' : daysUntil(nextExam.date) <= 21 ? 'amber' : 'green'}`}>
                {urgency.label}
              </span>
            </div>
            <p className="exam-info-sub">
              {nextExam.type} · {new Date(nextExam.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })} · Meta: {nextExam.minGrade}/20
            </p>
          </div>
          <ChevronRight size={16} color="var(--gray-300)" />
        </div>
      )}

      {/* ── 4. ON TRACK ────────────────────────────────────────────── */}
      {onTrackRows.length > 0 && (
        <div className="card dashboard-full" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <span className="card-title">
              <Target size={14} style={{ display: 'inline', marginRight: 6 }} />
              On Track
            </span>
            <button onClick={() => onNavigate('hours')} style={{ fontSize: 'var(--t-caption)', color: 'var(--rose-400)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
              Ver detalhes
            </button>
          </div>
          <div className="card-body" style={{ padding: '10px 20px' }}>
            {onTrackRows.map(s => {
              const pct = Math.min(100, s.tNow < 0.1 ? 100 : Math.round(s.hrs / s.tNow * 100))
              return (
                <div key={s.key} className="track-row">
                  <button
                    onClick={() => onOpenCadeira?.(s.key)}
                    title={`Ver página de ${s.name}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                  >
                    <span className="track-emoji">{s.emoji}</span>
                    <span className="track-name" style={{ textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color 0.15s' }}
                      onMouseEnter={e => e.target.style.textDecorationColor = 'var(--gray-400)'}
                      onMouseLeave={e => e.target.style.textDecorationColor = 'transparent'}
                    >{s.name}</span>
                  </button>
                  <div style={{ flex: 2, margin: '0 12px' }}>
                    <div className="progress-wrap">
                      <div className="progress-fill" style={{
                        width: `${pct}%`,
                        background: s.status === 'green' ? 'var(--green-400)' : s.status === 'amber' ? '#f59e0b' : 'var(--red-400)'
                      }} />
                    </div>
                  </div>
                  <span className={`status-pill status-${s.status}`} style={{ marginRight: 8 }}>
                    {trackIcon(s.status)}
                    {s.status === 'red' ? 'Atrasada' : s.status === 'amber' ? 'Atenção' : 'OK'}
                  </span>
                  {editTarget === s.key ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" min="0.5" max="40" step="0.5" value={targetDraft}
                        onChange={e => setTargetDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const val = parseFloat(targetDraft)
                            if (!isNaN(val) && val > 0) {
                              const updated = { ...weeklyTargets, [s.key]: val }
                              setWeeklyTargets(updated)
                              localStorage.setItem('weekly-targets', JSON.stringify(updated))
                            }
                            setEditTarget(null)
                          }
                          if (e.key === 'Escape') setEditTarget(null)
                        }}
                        autoFocus
                        style={{ width: 46, fontSize: 'var(--t-caption)', border: '1px solid var(--rose-300)', borderRadius: 5, padding: '2px 4px', textAlign: 'center', fontFamily: 'inherit' }}
                      />
                      <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>h/sem</span>
                    </span>
                  ) : (
                    <span className="track-hours" title="Clica para editar meta semanal"
                      onClick={() => { setEditTarget(s.key); setTargetDraft(s.weeklyGoal.toFixed(1)) }}
                      style={{ cursor: 'pointer' }}>
                      {s.hrs.toFixed(1)}h / {s.weeklyGoal.toFixed(1)}h
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 4b. SUGESTÃO DIÁRIA ────────────────────────────────────── */}
      {dailySuggestions.length > 0 && (
        <div className="card dashboard-full" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <span className="card-title">🎯 Para estar no ritmo hoje</span>
            <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>{DAYS_LEFT_IN_WEEK} {DAYS_LEFT_IN_WEEK === 1 ? 'dia restante' : 'dias restantes'} na semana</span>
          </div>
          <div className="card-body" style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dailySuggestions.slice(0, 4).map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{s.emoji}</span>
                <span style={{ flex: 1, fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--gray-700)' }}>{s.name}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 'var(--t-body)', fontWeight: 800, color: s.stillNeeded >= 3 ? '#dc2626' : s.stillNeeded >= 1.5 ? '#d97706' : '#16a34a' }}>
                    {s.stillNeeded}h
                  </span>
                  {s.doneToday > 0 && (
                    <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', display: 'block', lineHeight: 1 }}>
                      {s.doneToday}h feitas hoje
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4c. REVISÕES ─────────────────────────────────────────── */}
      {reviewDue.length > 0 && (
        <div className="card dashboard-full" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <span className="card-title">📖 Rever hoje</span>
            <button onClick={() => onNavigate('exams')} style={{ fontSize: 'var(--t-caption)', color: 'var(--rose-400)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
              Ver tópicos →
            </button>
          </div>
          <div className="card-body" style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reviewDue.slice(0, 5).map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{t.subjectEmoji}</span>
                <span style={{ flex: 1, fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--gray-700)' }}>{t.name}</span>
                <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: (t.subjectColor || '#e5e7eb') + '22', color: t.subjectColor || 'var(--gray-500)' }}>
                  {t.subjectName}
                </span>
              </div>
            ))}
            {reviewDue.length > 5 && (
              <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', margin: '2px 0 0' }}>
                +{reviewDue.length - 5} mais para rever
              </p>
            )}
          </div>
        </div>
      )}

      {/* Weekly planning — botão composto */}
      <button
        onClick={() => setShowSundayPlanning(true)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          background: 'linear-gradient(135deg, #faf5ff, #f3e8ff)',
          border: '1.5px solid #e9d5ff', borderRadius: 'var(--r)',
          padding: '14px 18px', marginTop: 8, marginBottom: 14,
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '1.6rem', lineHeight: 1, flexShrink: 0 }}>🗓️</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 800, fontSize: 'var(--t-body)', color: '#6b21a8' }}>
            {weekPlan ? 'Replanear a semana' : 'Planear a semana'}
          </span>
          <span style={{ display: 'block', fontSize: 'var(--t-caption)', color: '#9333ea', fontWeight: 600, marginTop: 1 }}>
            Reflexão guiada + plano da semana com IA
          </span>
        </span>
        <span style={{ fontSize: '1.1rem', color: '#a855f7', flexShrink: 0 }}>→</span>
      </button>

      {/* Plano da semana guardado — visível durante esta semana */}
      {weekPlan && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <span className="card-title">🗓️ O teu plano desta semana</span>
            <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 500 }}>{weekPlan.date}</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(() => {
              const colors = ['var(--amber-100)', 'var(--blue-100)', 'var(--green-50)', 'var(--orange-50)', 'var(--purple-50)']
              const borderColors = ['#fde047', '#93c5fd', '#86efac', '#fdba74', '#c4b5fd']
              const textColors = ['#854d0e', '#1e40af', '#14532d', '#9a3412', '#5b21b6']
              return weekPlan.content.split('\n\n').filter(Boolean).map((section, i) => {
                const lines = section.split('\n')
                const title = lines[0]
                const body = lines.slice(1).join('\n')
                return (
                  <div key={i} style={{ background: colors[i % colors.length], border: `1.5px solid ${borderColors[i % borderColors.length]}`, borderRadius: 'var(--r)', padding: '12px 14px' }}>
                    <p style={{ fontWeight: 800, fontSize: 'var(--t-body)', color: textColors[i % textColors.length], marginBottom: body ? 4 : 0 }}>{title}</p>
                    {body && <p style={{ fontSize: 'var(--t-body)', lineHeight: 1.6, color: textColors[i % textColors.length], margin: 0, opacity: 0.85, whiteSpace: 'pre-wrap' }}>{body}</p>}
                  </div>
                )
              })
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
