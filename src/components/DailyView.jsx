import { useState, useEffect, useRef } from 'react'
import { getTasksForDay, getSubjectsMap } from '../data/schedule'
import { Check, Plus, X, Settings2 } from 'lucide-react'
import { CalendarView } from './CalendarView'
import { getMondayOfWeek } from '../utils/dates'
import { QUADRANTS, ENERGY_LEVELS, PERIODS, DAY_NAMES_SHORT as DAY_NAMES, DAY_NAMES_FULL as DAY_FULL, WEEK_DAYS } from '../constants'

function getCurrentPeriod() {
  const h = new Date().getHours()
  if (h < 13) return 'morning'
  if (h < 19) return 'afternoon'
  return 'evening'
}

const DEFAULT_RULES = [
  { match: ['sheet-weekend', 'ficha', 'teste', 'exame', 'avaliação', 'entrega', 'prazo'],                       quadrant: 'Q1' },
  { match: ['transcribe', 'transcrever', 'transcrição', 'cornell', 'resumo', 'apontamentos', 'síntese'],        quadrant: 'Q2' },
  { match: ['flashcards', 'cartões', 'biblio', 'bibliografia', 'modelo', 'exercícios', 'pratica', 'prática'],   quadrant: 'Q2' },
  { match: ['review', 'revisão', 'revisar', 'rever', 'reli', 'reler'],                                         quadrant: 'Q3' },
  { match: ['extra', 'opcional', 'leitura extra', 'complementar'],                                             quadrant: 'Q4' },
]

function autoClassify(taskId, taskLabel) {
  const combined = (taskId + ' ' + taskLabel).toLowerCase()
  for (const rule of DEFAULT_RULES) {
    if (rule.match.some(k => combined.includes(k))) return rule.quadrant
  }
  return 'Q2'
}

function loadMatrix()  { try { return JSON.parse(localStorage.getItem('eisenhower-overrides')) || {} } catch { return {} } }
function saveMatrix(m) { localStorage.setItem('eisenhower-overrides', JSON.stringify(m)) }
function loadEnergy()  { try { return JSON.parse(localStorage.getItem('energy-levels')) || {} } catch { return {} } }
function saveEnergy(e) { localStorage.setItem('energy-levels', JSON.stringify(e)) }

function getDateForDow(dow, monday) {
  const idx = WEEK_DAYS.indexOf(dow)
  const d = new Date(monday)
  d.setDate(monday.getDate() + idx)
  return d
}

function loadDone(date) {
  try { return JSON.parse(localStorage.getItem(`tasks-${date.toDateString()}`)) || {} }
  catch { return {} }
}

function loadExtra() {
  try { return JSON.parse(localStorage.getItem('extra-tasks')) || [] }
  catch { return [] }
}

function saveExtra(tasks) {
  localStorage.setItem('extra-tasks', JSON.stringify(tasks))
}

function getCompletionPct(date) {
  const schedule = getTasksForDay(date.getDay())
  const ids = schedule.flatMap(g => g.tasks.map(t => t.id))
  if (ids.length === 0) return 100
  const done = loadDone(date)
  return Math.round(ids.filter(id => done[id]).length / ids.length * 100)
}

function getIncompletePastDays(todayMonday) {
  const result = []
  for (let w = 1; w <= 4; w++) {
    const prevMonday = new Date(todayMonday)
    prevMonday.setDate(todayMonday.getDate() - 7 * w)
    WEEK_DAYS.forEach(dow => {
      const date = getDateForDow(dow, prevMonday)
      if (date >= todayMonday) return
      const schedule = getTasksForDay(dow)
      const hasRealTasks = schedule.some(g => g.tasks.length > 0)
      const pct = getCompletionPct(date)
      if (hasRealTasks && pct < 100 && pct > 0) result.push(date)
    })
  }
  return result
}

export default function DailyView() {
  const SUBJECTS = getSubjectsMap()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMonday = getMondayOfWeek(today)

  const [selectedDate, setSelectedDate] = useState(today)
  const [done, setDone]                 = useState(() => loadDone(today))
  const [extraTasks, setExtraTasks]     = useState(loadExtra)
  const [newTask, setNewTask]           = useState('')
  const [newTaskQuadrant, setNewTaskQuadrant] = useState('Q1')
  const [dragIdx, setDragIdx]           = useState(null)
  const [matrixOverrides, setOverrides] = useState(loadMatrix)
  const [showMatrix, setShowMatrix]     = useState(() => { try { return JSON.parse(localStorage.getItem('show-matrix')) ?? false } catch { return false } })
  const [addedTask, setAddedTask]       = useState('')
  const [editingId, setEditingId]       = useState(null)
  const [energyLevels, setEnergyLevels] = useState(loadEnergy)
  const [activePeriod, setActivePeriod] = useState(getCurrentPeriod)

  const dateStr   = selectedDate.toDateString()
  const isoDateStr = selectedDate.toISOString().split('T')[0]
  const schedule  = getTasksForDay(selectedDate.getDay())

  // Labels de tarefas já com bloco no horário deste dia
  const scheduledLabels = (() => {
    try {
      const blocks = JSON.parse(localStorage.getItem(`schedule-blocks-${isoDateStr}`)) || []
      return new Set(blocks.map(b => b.title).filter(Boolean))
    } catch { return new Set() }
  })()
  const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6
  const isToday   = dateStr === today.toDateString()

  const energyKey     = `${dateStr}-${activePeriod}`
  const currentEnergy = ENERGY_LEVELS.find(e => e.id === energyLevels[energyKey]) || null

  useEffect(() => { setDone(loadDone(selectedDate)) }, [dateStr])
  useEffect(() => { localStorage.setItem(`tasks-${dateStr}`, JSON.stringify(done)) }, [done, dateStr])
  useEffect(() => { saveExtra(extraTasks) }, [extraTasks])
  useEffect(() => { saveMatrix(matrixOverrides) }, [matrixOverrides])
  useEffect(() => { saveEnergy(energyLevels) }, [energyLevels])
  useEffect(() => { localStorage.setItem('show-matrix', JSON.stringify(showMatrix)) }, [showMatrix])

  // Regular tasks: mark as done for this day only
  const check = (id) => setDone(prev => ({ ...prev, [id]: true }))

  // Extra tasks: remove globally (disappears from all days)
  const removeExtra = (id) => {
    setExtraTasks(prev => {
      const updated = prev.filter(t => t.id !== id)
      saveExtra(updated)
      return updated
    })
    setOverrides(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const addExtra = () => {
    if (!newTask.trim()) return
    const label = newTask.trim()
    const id = `extra-${Date.now()}`
    const updated = [...extraTasks, { id, label, isExtra: true }]
    setExtraTasks(updated)
    saveExtra(updated)
    setOverrides(prev => ({ ...prev, [id]: newTaskQuadrant }))
    setNewTask('')
    setAddedTask(label)
    setTimeout(() => setAddedTask(''), 2000)
  }

  const snoozeExtra = (taskId) => {
    // Mark done for today — task re-appears tomorrow since done is per-day
    setDone(prev => ({ ...prev, [taskId]: true }))
  }

  const dragThrottleRef = useRef(0)
  const onExtraDragStart = (i) => setDragIdx(i)
  const onExtraDragOver = (e, i) => {
    e.preventDefault()
    const now = Date.now()
    if (now - dragThrottleRef.current < 60) return
    dragThrottleRef.current = now
    if (dragIdx === null || dragIdx === i) return
    const updated = [...extraTasks]
    const [moved] = updated.splice(dragIdx, 1)
    updated.splice(i, 0, moved)
    setExtraTasks(updated)
    setDragIdx(i)
  }
  const onExtraDragEnd = () => setDragIdx(null)

  const setQuadrant = (taskId, quadrant) => {
    setOverrides(prev => ({ ...prev, [taskId]: quadrant }))
    setEditingId(null)
  }

  const setEnergy = (periodKey, energyId) => {
    setEnergyLevels(prev => ({ ...prev, [periodKey]: energyId }))
  }

  const getQuadrant = (taskId, taskLabel) => matrixOverrides[taskId] || autoClassify(taskId, taskLabel)

  const allScheduledTasks = schedule.flatMap(g =>
    g.tasks.map(t => ({ ...t, subjectKey: g.subjectKey, isExtra: false }))
  )
  const allExtraTasks = extraTasks.map(t => ({ ...t, subjectKey: null, isExtra: true }))
  const allTasks     = [...allScheduledTasks, ...allExtraTasks]
  const pendingTasks = allTasks.filter(t => !done[t.id])

  const byQuadrant = {}
  Object.keys(QUADRANTS).forEach(q => { byQuadrant[q] = [] })
  pendingTasks.forEach(task => {
    const q = getQuadrant(task.id, task.label)
    byQuadrant[q].push(task)
  })

  const orderedQuadrants = currentEnergy
    ? currentEnergy.quadrantOrder
    : ['Q1','Q2','Q3','Q4']

  const allIds    = allTasks.map(t => t.id)
  const doneCount = allIds.filter(id => done[id]).length
  const allCount  = allIds.length
  const pct       = allCount === 0 ? 0 : Math.round((doneCount / allCount) * 100)

  const [confetti, setConfetti] = useState([])
  const confettiShown = useRef(false)
  const COLORS = ['#f9a8d4','#c4b5fd','#fdba74','#86efac','#93c5fd','#fde68a','#f87171']

  useEffect(() => {
    if (pct === 100 && allCount > 0 && !confettiShown.current) {
      confettiShown.current = true
      const pieces = Array.from({ length: 25 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        duration: 1.8 + Math.random() * 1.4,
        delay: Math.random() * 0.8,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 6,
      }))
      setConfetti(pieces)
      setTimeout(() => setConfetti([]), 4000)
    }
    if (pct < 100) confettiShown.current = false
  }, [pct, allCount])

  const incompletePast = getIncompletePastDays(todayMonday)
  const thisWeekTabs = WEEK_DAYS
    .map(dow => getDateForDow(dow, todayMonday))
    .filter(date => {
      const isT    = date.toDateString() === today.toDateString()
      const isPast = date < today
      if (isT) return true
      if (isPast) return getCompletionPct(date) < 100
      return getTasksForDay(date.getDay()).some(g => g.tasks.length > 0)
    })

  const allTabs = [
    ...incompletePast.filter(d => !thisWeekTabs.find(t => t.toDateString() === d.toDateString())),
    ...thisWeekTabs,
  ].sort((a, b) => a - b)

  function renderTask(task, q, qKey) {
    const subject = task.subjectKey ? SUBJECTS[task.subjectKey] : null

    const handleClick = () => {
      if (task.isExtra) { removeExtra(task.id) } else { check(task.id) }
    }

    return (
      <div key={task.id} style={{ marginBottom: 3 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.75)', borderRadius: 8,
            padding: '7px 10px', cursor: 'pointer',
          }}
          onClick={handleClick}
        >
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            border: `1.5px solid ${q.border}`, flexShrink: 0,
          }} />
          {subject && <span style={{ fontSize: '0.8rem' }}>{subject.emoji}</span>}
          <span style={{ fontSize: '0.78rem', fontWeight: 500, color: q.text, flex: 1, lineHeight: 1.3 }}>
            {task.label}
          </span>
          {scheduledLabels.has(task.label) && (
            <span title="Já tem bloco no horário" style={{ fontSize: '0.62rem', fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 50, padding: '1px 6px', flexShrink: 0 }}>
              📅
            </span>
          )}
          {task.isExtra && (
            <button
              onClick={e => { e.stopPropagation(); removeExtra(task.id) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: q.text, opacity: 0.4, padding: '0 2px', display: 'flex', alignItems: 'center' }}
            >
              <X size={11} />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); setEditingId(editingId === task.id ? null : task.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: q.text, opacity: 0.5, padding: '0 2px' }}
            title="Mover para outro quadrante"
          >↕</button>
        </div>

        {editingId === task.id && (
          <div style={{
            background: 'var(--white)', border: '1px solid var(--gray-200)',
            borderRadius: 8, padding: '6px', marginTop: 4,
            boxShadow: 'var(--shadow-md)', zIndex: 10, position: 'relative',
          }}>
            <p style={{ fontSize: '0.68rem', color: 'var(--gray-400)', fontWeight: 600, marginBottom: 4, paddingLeft: 4 }}>Mover para:</p>
            {Object.entries(QUADRANTS).map(([k, qOpt]) => (
              <button
                key={k}
                onClick={() => setQuadrant(task.id, k)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  width: '100%', padding: '5px 8px', borderRadius: 6,
                  border: 'none', background: k === qKey ? qOpt.color : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: '0.75rem', fontWeight: 600, color: qOpt.text, textAlign: 'left',
                }}
              >
                {qOpt.emoji} {qOpt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fade-in">
      {confetti.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: `${p.left}%`,
          background: p.color,
          width: p.size,
          height: p.size,
          animationDuration: `${p.duration}s`,
          animationDelay: `${p.delay}s`,
        }} />
      ))}
      {/* Day tabs */}
      <div className="day-tabs">
        {allTabs.map(date => {
          const dow    = date.getDay()
          const isT    = date.toDateString() === today.toDateString()
          const tabPct = getCompletionPct(date)
          const isPast = date < today && !isT
          return (
            <button
              key={date.toDateString()}
              className={`day-tab ${dateStr === date.toDateString() ? 'active' : ''}`}
              onClick={() => setSelectedDate(new Date(date))}
            >
              <span className="day-tab-name" style={{ color: isT ? 'var(--rose-400)' : isPast ? '#ef4444' : '' }}>
                {DAY_NAMES[dow]}
              </span>
              <span className="day-tab-num">{date.getDate()}</span>
              {tabPct === 100
                ? <span className="day-tab-dot" style={{ background: '#16a34a' }} />
                : tabPct > 0
                  ? <span className="day-tab-dot" style={{ background: isPast ? '#ef4444' : 'var(--rose-300)' }} />
                  : null}
            </button>
          )
        })}
      </div>

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>
            {DAY_FULL[selectedDate.getDay()]} {isToday ? '🌸' : ''}
            <span style={{ fontSize: '1rem', color: 'var(--gray-400)', fontWeight: 500, marginLeft: 8 }}>
              {selectedDate.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
            </span>
          </h1>
          <p className="subtitle">
            {allCount === 0 ? 'Sem tarefas para este dia!' : `${doneCount} de ${allCount} tarefas concluídas`}
          </p>
        </div>
        {allCount > 0 && (
          <button
            onClick={() => setShowMatrix(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 50,
              border: '1.5px solid var(--gray-200)',
              background: showMatrix ? 'var(--rose-50)' : 'var(--white)',
              color: showMatrix ? 'var(--rose-400)' : 'var(--gray-500)',
              fontFamily: 'inherit', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            <Settings2 size={13} />
            {showMatrix ? 'Vista normal' : 'Matriz'}
          </button>
        )}
      </div>

      {/* Progress */}
      {allCount > 0 && (
        <>
          <p className="progress-label">{pct}% do dia concluído</p>
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}

      {/* Energy selector */}
      {showMatrix && allCount > 0 && (
        <div style={{
          background: 'var(--white)', border: '1px solid var(--gray-100)',
          borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 14,
          boxShadow: 'var(--shadow-xs)',
        }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Como está a tua energia?
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ENERGY_LEVELS.map(e => {
              const isActive = energyLevels[energyKey] === e.id
              return (
                <button
                  key={e.id}
                  onClick={() => setEnergy(energyKey, e.id)}
                  style={{
                    padding: '7px 14px', borderRadius: 50,
                    border: `2px solid ${isActive ? e.color : 'var(--gray-200)'}`,
                    background: isActive ? e.bg : 'var(--white)',
                    color: isActive ? e.color : 'var(--gray-500)',
                    fontFamily: 'inherit', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {e.emoji} {e.label}
                </button>
              )
            })}
          </div>

          {currentEnergy && (
            <p style={{
              marginTop: 10, fontSize: '0.78rem', color: currentEnergy.color,
              fontWeight: 600, background: currentEnergy.bg,
              padding: '6px 12px', borderRadius: 8, display: 'inline-block',
            }}>
              💡 {currentEnergy.tip}
            </p>
          )}
        </div>
      )}

      {/* Matrix view */}
      {showMatrix && allCount > 0 && (
        <div style={{ marginBottom: 16 }}>
          {currentEnergy ? (
            <>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                Ordem sugerida com energia {currentEnergy.emoji} {currentEnergy.label}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {orderedQuadrants.map(qKey => {
                  const q = QUADRANTS[qKey]
                  const tasks = byQuadrant[qKey]
                  if (tasks.length === 0) return null
                  return (
                    <div key={qKey} style={{
                      background: q.color, border: `1.5px solid ${q.border}`,
                      borderRadius: 'var(--radius)', padding: '12px 14px',
                    }}>
                      <p style={{ fontSize: '0.73rem', fontWeight: 700, color: q.text, marginBottom: 8 }}>
                        {q.emoji} {q.label}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {tasks.map(task => renderTask(task, q, qKey))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                Seleciona a tua energia para ver a ordem sugerida · clica numa tarefa para a mover
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {Object.entries(QUADRANTS).map(([qKey, q]) => (
                  <div key={qKey} style={{
                    background: q.color, border: `1.5px solid ${q.border}`,
                    borderRadius: 'var(--radius)', padding: '12px 14px', minHeight: 80,
                  }}>
                    <p style={{ fontSize: '0.73rem', fontWeight: 700, color: q.text, marginBottom: 8 }}>
                      {q.emoji} {q.label}
                    </p>
                    {byQuadrant[qKey].length === 0
                      ? <p style={{ fontSize: '0.72rem', color: q.text, opacity: 0.4, fontStyle: 'italic' }}>Nada aqui</p>
                      : byQuadrant[qKey].map(task => renderTask(task, q, qKey))
                    }
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Normal view */}
      {!showMatrix && (
        schedule.map(({ subjectKey, tasks }) => {
          const subject      = SUBJECTS[subjectKey]
          const visibleTasks = tasks.filter(t => !done[t.id])
          if (visibleTasks.length === 0) return null
          const doneSub = tasks.filter(t => done[t.id]).length
          return (
            <div className="subject-group" key={subjectKey}>
              <div className="subject-header" style={{ borderLeft: `4px solid ${subject.color}` }}>
                <div className="subject-dot" style={{ background: subject.color }} />
                <span className="subject-name" style={{ color: subject.textColor }}>{subject.emoji} {subject.name}</span>
                <span className="subject-count">{doneSub}/{tasks.length}</span>
              </div>
              <div className="task-list">
                {visibleTasks.map(task => (
                  <div key={task.id} className="task-item" onClick={() => check(task.id)}>
                    <div className="task-checkbox"><Check size={13} color="transparent" strokeWidth={3} /></div>
                    <span className="task-label">{task.label}</span>
                    {task.highlight && <span className="task-highlight">{isWeekend ? 'fim de semana' : 'última aula'}</span>}
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      {allCount > 0 && doneCount === allCount && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--rose-400)', fontWeight: 700, fontSize: '1rem' }}>
          🎉 Dia concluído! Orgulho de ti!
        </div>
      )}

      {/* Add extra task */}
      <div className="extra-section">
        <p className="extra-title"><Plus size={15} /> Tarefas extra</p>
        <div className="extra-input-row" style={{ marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Adicionar tarefa extra..."
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addExtra()}
          />
          <button className="btn btn-primary" onClick={addExtra}><Plus size={15} /> Adicionar</button>
        </div>

        {addedTask && (
          <p style={{ fontSize: '0.78rem', color: 'var(--green-500)', fontWeight: 700, marginBottom: 6 }}>
            ✓ "{addedTask}" adicionada!
          </p>
        )}

        {!showMatrix && extraTasks.filter(t => !done[t.id]).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            {extraTasks.filter(t => !done[t.id]).map((task, i) => (
              <div
                key={task.id}
                draggable
                onDragStart={() => onExtraDragStart(i)}
                onDragOver={(e) => onExtraDragOver(e, i)}
                onDragEnd={onExtraDragEnd}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', background: 'var(--white)',
                  border: '1.5px solid var(--gray-200)', borderRadius: 8,
                  cursor: 'grab', opacity: dragIdx === i ? 0.4 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <span style={{ color: 'var(--gray-300)', fontSize: '1rem', lineHeight: 1 }}>⠿</span>
                <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 500, color: 'var(--gray-700)' }}>{task.label}</span>
                <button
                  onClick={() => snoozeExtra(task.id)}
                  title="Adiar para amanhã"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: '0 2px', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center' }}
                >↪</button>
                <button
                  onClick={() => removeExtra(task.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {Object.entries(QUADRANTS).map(([qKey, q]) => (
            <button key={qKey} onClick={() => setNewTaskQuadrant(qKey)} style={{
              padding: '3px 10px', borderRadius: 50, fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
              border: `2px solid ${newTaskQuadrant === qKey ? q.border : 'var(--gray-200)'}`,
              background: newTaskQuadrant === qKey ? q.color : 'var(--white)',
              color: newTaskQuadrant === qKey ? q.text : 'var(--gray-400)',
            }}>{q.emoji} {q.label}</button>
          ))}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontWeight: 500, marginTop: 8 }}>
          Clica numa tarefa extra para a concluir · o ✕ apaga-a permanentemente 🌿
        </p>
      </div>

      <div style={{ marginTop: 32, borderTop: '1px solid var(--gray-100)', paddingTop: 32 }}>
        <CalendarView />
      </div>
    </div>
  )
}