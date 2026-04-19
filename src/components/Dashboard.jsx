import { useState } from 'react'
import { Clock, Flame, ChevronRight, Target, TrendingUp, TrendingDown, Minus, RotateCcw } from 'lucide-react'
import { getTasksForDay } from '../data/schedule'
import { getMondayOfWeek, daysUntil } from '../utils/dates'
import { suggestNextSession } from '../utils/suggestNextSession'
import { computeWeeklyStreak } from '../utils/streak'
import { SundayPlanning } from './SundayPlanning'

const TODAY = new Date()

function loadSessions()      { try { return JSON.parse(localStorage.getItem('study-sessions')) || [] } catch { return [] } }
function loadExams()         { try { return JSON.parse(localStorage.getItem('exams')) || [] } catch { return [] } }
function loadDone()          { try { return JSON.parse(localStorage.getItem(`tasks-${TODAY.toDateString()}`)) || {} } catch { return {} } }
function loadTargets()       { try { return JSON.parse(localStorage.getItem('subject-targets')) || {} } catch { return {} } }
function loadWeeklyTargets() { try { return JSON.parse(localStorage.getItem('weekly-targets')) || {} } catch { return {} } }
function loadExtra()         { try { return JSON.parse(localStorage.getItem('extra-tasks')) || [] } catch { return [] } }

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

function scoreSubject(s, sessions, exams, weeklyGoal) {
  const hrs  = hoursForSubjectThisWeek(sessions, s.key)
  const tNow = weeklyGoal * (weekDayNumber() / 7)
  const status = trackStatus(hrs, tNow)
  const nextE  = exams.find(e => e.date && daysUntil(e.date) >= 0 &&
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
  const subjects = settings?.subjects || []
  const [mood, setMood] = useState('😊')
  const [suggIdx, setSuggIdx] = useState(0)
  const [weeklyTargets, setWeeklyTargets] = useState(loadWeeklyTargets)
  const [editTarget, setEditTarget] = useState(null)
  const [targetDraft, setTargetDraft] = useState('')
  const [showSundayPlanning, setShowSundayPlanning] = useState(false)

  const isSunday = TODAY.getDay() === 0

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

  const sessions = loadSessions()
  const exams    = loadExams()
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
  const pendingExtra  = allExtra.filter(t => !done[t.id])
  const allTodayCount = todaySchedule.flatMap(g => g.tasks).length + allExtra.length
  const allDoneCount  = todaySchedule.flatMap(g => g.tasks).filter(t => done[t.id]).length +
                        (allExtra.length - pendingExtra.length)
  const todayPct      = allTodayCount === 0 ? 100 : Math.round(allDoneCount / allTodayCount * 100)

  // Next exam
  const REAL_EXAM_TYPES = ['Exame', 'Teste', 'Mini-teste']
  const nextExam = exams.filter(e => daysUntil(e.date) >= 0 && REAL_EXAM_TYPES.includes(e.type))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0]
  const urgency = nextExam ? (() => {
    const d = daysUntil(nextExam.date)
    if (d <= 7)  return { color: 'var(--red-400)',   label: 'Urgente' }
    if (d <= 21) return { color: 'var(--amber-400)', label: 'Em breve' }
    return { color: 'var(--green-500)', label: 'Com tempo' }
  })() : null

  // On-track (top 3 by urgency)
  const onTrackRows = subjects.length > 0 ? subjects.map(s => {
    const wGoal = weeklyTargets[s.key] !== undefined ? parseFloat(weeklyTargets[s.key]) : getTarget(s.key) / WEEKS_REMAINING
    return scoreSubject(s, sessions, exams, wGoal)
  }).sort((a, b) => b.score - a.score).slice(0, 3) : []

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

  // Weekly streak — honest: "N semanas seguidas com ≥Xh"
  const totalWeeklyGoal = subjects.reduce((acc, s) => {
    const wGoal = weeklyTargets[s.key] !== undefined ? parseFloat(weeklyTargets[s.key]) : getTarget(s.key) / WEEKS_REMAINING
    return acc + (isNaN(wGoal) ? 0 : wGoal)
  }, 0)
  const weeklyMin     = Math.max(5, Math.round(totalWeeklyGoal))
  const weeklyStreak  = computeWeeklyStreak(sessions, weeklyMin)
  const weekPctOfMin  = Math.min(100, weeklyMin > 0 ? Math.round(weekHrs / weeklyMin * 100) : 0)

  return (
    <div className="fade-in">
      {showSundayPlanning && <SundayPlanning onClose={() => setShowSundayPlanning(false)} />}

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 700, letterSpacing: '0.04em' }}>
              PRÓXIMOS 90 MIN
            </p>
            {/* Energy picker — inline, compact */}
            <div style={{ display: 'flex', gap: 3 }}>
              {MOODS.map(m => (
                <button key={m.emoji} onClick={() => { setMood(m.emoji); setSuggIdx(0) }} title={m.label} style={{
                  width: 28, height: 28, borderRadius: 'var(--r-pill)', cursor: 'pointer', fontSize: '0.85rem',
                  border: `1.5px solid ${mood === m.emoji ? heroColor : 'transparent'}`,
                  background: mood === m.emoji ? heroColor + '22' : 'transparent',
                  opacity: mood === m.emoji ? 1 : 0.5,
                }}>{m.emoji}</button>
              ))}
            </div>
          </div>

          {/* Subject */}
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

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                localStorage.setItem('pomodoro-prefill', JSON.stringify({ subjectKey: suggestion.key, title: suggestion.name }))
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
            {suggestions.length > 1 && (
              <button
                onClick={() => setSuggIdx(i => (i + 1) % suggestions.length)}
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
              <div className="stat-sub">Clica para abrir Horas &amp; Metas</div>
            </>
          ) : (
            <>
              <div className="stat-value">
                {weekHrs.toFixed(1)}<span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-400)' }}>h</span>
              </div>
              <div className="stat-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {totalHrs.toFixed(0)}h no total
                {trendPct !== null && (
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
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('hours')}>
          <div className="stat-label"><Flame size={12} /> Streak semanal</div>
          {weeklyStreak.current === 0 ? (
            <>
              <div style={{ fontSize: 'var(--t-body)', fontWeight: 700, color: 'var(--gray-500)', marginTop: 6, marginBottom: 4 }}>
                0 semanas seguidas
              </div>
              <div style={{ height: 4, borderRadius: 99, background: 'var(--gray-100)', overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', width: `${weekPctOfMin}%`, background: 'var(--rose-300)', borderRadius: 99 }} />
              </div>
              <div className="stat-sub">{weekHrs.toFixed(1)}h / {weeklyMin}h esta semana</div>
            </>
          ) : (
            <>
              <div className="stat-value">
                {weeklyStreak.current}<span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-400)' }}>sem</span>
              </div>
              <div style={{ height: 4, borderRadius: 99, background: 'var(--gray-100)', overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', width: `${weekPctOfMin}%`, background: weekPctOfMin >= 100 ? '#4ade80' : 'var(--rose-300)', borderRadius: 99 }} />
              </div>
              <div className="stat-sub">{weekHrs.toFixed(1)}h / {weeklyMin}h esta semana{weeklyStreak.best > weeklyStreak.current ? ` · recorde ${weeklyStreak.best}sem` : ''}</div>
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

      {/* ── 5. HOJE ────────────────────────────────────────────────── */}
      <div className="card dashboard-full" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <span className="card-title">Hoje</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {allTodayCount > 0 && (
              <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: todayPct === 100 ? 'var(--green-500)' : 'var(--gray-400)' }}>
                {allDoneCount}/{allTodayCount}{todayPct === 100 ? ' 🎉' : ''}
              </span>
            )}
            <button onClick={() => onNavigate('today')} style={{ fontSize: 'var(--t-caption)', color: 'var(--rose-400)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
              Ver tudo
            </button>
          </div>
        </div>

        {allTodayCount > 0 && (
          <div style={{ height: 3, background: 'var(--gray-100)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${todayPct}%`, background: todayPct === 100 ? 'var(--green-400)' : 'var(--accent-300)', transition: 'width 0.4s' }} />
          </div>
        )}

        <div className="card-body" style={{ padding: '8px 20px' }}>
          {allTodayCount === 0 ? (
            <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-400)', padding: '8px 0' }}>
              Sem tarefas agendadas para hoje 🎉
            </p>
          ) : (
            <>
              {todayGroups.filter(g => g.tasks.length > 0).slice(0, 3).map(g => (
                <div key={g.subjectKey} style={{ marginBottom: 10 }}>
                  {g.subject && (
                    <p style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: g.subject.color || 'var(--gray-400)', marginBottom: 4 }}>
                      {g.subject.emoji} {g.subject.name}
                    </p>
                  )}
                  {g.tasks.slice(0, 3).map(t => (
                    <div key={t.id} className="today-task-row" style={{ padding: '5px 0' }}>
                      <div className={`today-task-check${t.done ? ' done' : ''}`}>
                        {t.done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span className={`today-task-label${t.done ? ' done' : ''}`}>{t.label}</span>
                    </div>
                  ))}
                </div>
              ))}
              {pendingExtra.slice(0, 2).map(t => (
                <div key={t.id} className="today-task-row" style={{ padding: '5px 0' }}>
                  <div className="today-task-check">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><circle cx="4" cy="4" r="3" stroke="var(--gray-300)" strokeWidth="1.5"/></svg>
                  </div>
                  <span className="today-task-label">{t.label}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Weekly planning — always accessible */}
      <button onClick={() => setShowSundayPlanning(true)} className="btn btn-ghost"
        style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', marginBottom: 8 }}>
        {isSunday ? '📋 Planear a semana →' : '🤖 Plano semanal com IA →'}
      </button>
    </div>
  )
}
