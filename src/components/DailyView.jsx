import { useState, useEffect, useRef } from 'react'
import { getTasksForDay, getSubjectsMap } from '../data/schedule'
import { Check, Plus, X, Settings2 } from 'lucide-react'
import { CalendarView } from './CalendarView'
import { getMondayOfWeek } from '../utils/dates'
import { QUADRANTS, ENERGY_LEVELS, PERIODS, DAY_NAMES_SHORT as DAY_NAMES, DAY_NAMES_FULL as DAY_FULL, WEEK_DAYS } from '../constants'
import { useToast, ToastContainer } from './Toast'

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
  const [newTaskEmoji, setNewTaskEmoji] = useState('')
  const [newTaskQuadrant, setNewTaskQuadrant] = useState('Q1')
  const [newTaskMins, setNewTaskMins]   = useState('')
  const [newTaskRecurrence, setNewTaskRecurrence] = useState('none')
  const [taskFilter, setTaskFilter]     = useState('all') // 'all'|'Q1'|'Q2'|'Q3'|'Q4'
  const [dragIdx, setDragIdx]           = useState(null)
  const [matrixOverrides, setOverrides] = useState(loadMatrix)
  const [showMatrix, setShowMatrix]     = useState(() => { try { return JSON.parse(localStorage.getItem('show-matrix')) ?? false } catch { return false } })
  const [addedTask, setAddedTask]       = useState('')
  const [editingId, setEditingId]       = useState(null)
  const [energyLevels, setEnergyLevels] = useState(loadEnergy)
  const [activePeriod, setActivePeriod] = useState(getCurrentPeriod)
  const { toasts, toast, dismiss } = useToast()

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

  // Aplica tarefas marcadas como feitas na widget — reage ao evento de storage disparado pelo App.jsx
  useEffect(() => {
    const todayStr = new Date().toDateString()
    const handler = (e) => {
      if (e.key !== `tasks-${todayStr}`) return
      if (dateStr !== todayStr) return // a utilizadora está a ver outro dia
      try { setDone(JSON.parse(e.newValue || '{}')) } catch {}
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [dateStr])
  useEffect(() => { localStorage.setItem(`tasks-${dateStr}`, JSON.stringify(done)) }, [done, dateStr])
  useEffect(() => { saveExtra(extraTasks) }, [extraTasks])
  useEffect(() => { saveMatrix(matrixOverrides) }, [matrixOverrides])
  useEffect(() => { saveEnergy(energyLevels) }, [energyLevels])
  useEffect(() => { localStorage.setItem('show-matrix', JSON.stringify(showMatrix)) }, [showMatrix])

  // Exporta as tarefas de hoje + próximo exame para o widget do desktop (Übersicht)
  useEffect(() => {
    if (!window.electronAPI?.exportWidgetData) return
    const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)
    const todayDone = loadDone(todayDate)
    const subjectsMap = getSubjectsMap()
    const taskGroups = getTasksForDay(todayDate.getDay())
    const todayDow = todayDate.getDay()
    const allTasks = [
      ...taskGroups.flatMap(g => g.tasks.map(t => ({
        id: t.id, label: t.label, subjectKey: g.subjectKey,
        subjectName: subjectsMap[g.subjectKey]?.name || g.subjectKey,
        subjectColor: subjectsMap[g.subjectKey]?.color || '#e5e7eb',
        subjectEmoji: subjectsMap[g.subjectKey]?.emoji || '📚',
        done: !!todayDone[t.id], isExtra: false,
      }))),
      ...extraTasks
        .filter(t => !t.recurrence || t.recurrence === 'daily' || (t.recurrence === 'weekly' && t.createdDow === todayDow))
        .map(t => ({
          id: t.id, label: t.label, subjectKey: null,
          subjectName: 'Extra', subjectColor: '#e5e7eb', subjectEmoji: '📌',
          done: !!todayDone[t.id], isExtra: true,
        })),
    ]
    // Próximos exames (sem nota final, ordenados por data)
    const todayISO = todayDate.toISOString().split('T')[0]
    const rawExams = (() => { try { return JSON.parse(localStorage.getItem('exams')) || [] } catch { return [] } })()
    const settings = (() => { try { return JSON.parse(localStorage.getItem('user-settings')) || {} } catch { return {} } })()
    const subjectsByName = Object.fromEntries((settings.subjects || []).map(s => [s.name, s]))
    const upcomingExams = rawExams
      .filter(e => e.date >= todayISO && e.actualGrade == null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3)
      .map(e => {
        const sub = subjectsByName[e.subject] || {}
        const days = Math.round((new Date(e.date + 'T12:00:00') - todayDate) / 86400000)
        return {
          subject: e.subject,
          type: e.type || 'Exame',
          date: e.date,
          days,
          color: sub.color || '#e5e7eb',
          emoji: sub.emoji || '📝',
        }
      })
    const sessions = (() => { try { return JSON.parse(localStorage.getItem('study-sessions')) || [] } catch { return [] } })()
    const todayHours = parseFloat(sessions
      .filter(s => s.date === todayDate.toDateString())
      .reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0)
      .toFixed(1))
    window.electronAPI.exportWidgetData({
      date: todayDate.toDateString(),
      tasks: allTasks,
      doneCount: allTasks.filter(t => t.done).length,
      totalCount: allTasks.length,
      upcomingExams,
      todayHours,
    }).catch(() => {})
  }, [done, extraTasks])

  // Regular tasks: mark as done for this day only
  const check = (id) => setDone(prev => ({ ...prev, [id]: true }))

  // Extra tasks: remove globally (disappears from all days)
  const removeExtra = (id) => {
    let removedTask = null
    let removedOverride = null
    setExtraTasks(prev => {
      removedTask = prev.find(t => t.id === id)
      const updated = prev.filter(t => t.id !== id)
      saveExtra(updated)
      return updated
    })
    setOverrides(prev => { removedOverride = prev[id]; const n = { ...prev }; delete n[id]; return n })
    toast({
      message: 'Tarefa eliminada',
      onUndo: () => {
        if (!removedTask) return
        setExtraTasks(prev => {
          const updated = [...prev, removedTask]
          saveExtra(updated)
          return updated
        })
        if (removedOverride) setOverrides(prev => ({ ...prev, [id]: removedOverride }))
      },
    })
  }

  const addExtra = () => {
    if (!newTask.trim()) return
    const label = newTask.trim()
    const id = `extra-${Date.now()}`
    const task = {
      id, label, isExtra: true,
      emoji: newTaskEmoji.trim() || null,
      mins: newTaskMins ? parseInt(newTaskMins, 10) : null,
      recurrence: newTaskRecurrence !== 'none' ? newTaskRecurrence : null,
      createdDow: newTaskRecurrence !== 'none' ? new Date().getDay() : null,
    }
    const updated = [...extraTasks, task]
    setExtraTasks(updated)
    saveExtra(updated)
    setOverrides(prev => ({ ...prev, [id]: newTaskQuadrant }))
    setNewTask('')
    setNewTaskEmoji('')
    setNewTaskMins('')
    setNewTaskRecurrence('none')
    setAddedTask(label)
    setTimeout(() => setAddedTask(''), 2000)
  }

  // Carry-forward: import incomplete extra tasks from a past day into today
  const carryForwardPastExtras = (pastDate) => {
    const pastDoneMap = loadDone(pastDate)
    const pastSchedule = getTasksForDay(pastDate.getDay())
    const incompleteSched = pastSchedule.flatMap(g =>
      g.tasks.filter(t => !pastDoneMap[t.id]).map(t => ({ ...t, subjectKey: g.subjectKey }))
    )
    if (incompleteSched.length === 0) return
    incompleteSched.forEach(t => {
      const alreadyAdded = extraTasks.some(e => e.label === t.label)
      if (!alreadyAdded) {
        const id = `extra-${Date.now()}-${t.id}`
        const emoji = SUBJECTS[t.subjectKey]?.emoji || null
        const newT = { id, label: t.label, emoji, isExtra: true, carriedFrom: pastDate.toDateString() }
        setExtraTasks(prev => { const u = [...prev, newT]; saveExtra(u); return u })
        setOverrides(prev => ({ ...prev, [id]: autoClassify(id, t.label) }))
      }
    })
  }

  const snoozeTask = (task) => {
    if (task.isExtra) {
      // Extra tasks: mark done today → reappears tomorrow (done is per-day)
      setDone(prev => ({ ...prev, [task.id]: true }))
    } else {
      // Scheduled tasks: mark done today + add as extra so it shows tomorrow
      check(task.id)
      const id = `extra-${Date.now()}-snoozed`
      const emoji = task.subjectKey ? SUBJECTS[task.subjectKey]?.emoji || null : null
      const newT = { id, label: task.label, emoji, isExtra: true }
      setExtraTasks(prev => { const u = [...prev, newT]; saveExtra(u); return u })
    }
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
  // Filter recurring extra tasks: daily shows every day, weekly only on same day of week
  const visibleExtraTasks = extraTasks.filter(t => {
    if (!t.recurrence) return true
    if (t.recurrence === 'daily') return true
    if (t.recurrence === 'weekly') return selectedDate.getDay() === t.createdDow
    return true
  })
  const allExtraTasks = visibleExtraTasks.map(t => ({ ...t, subjectKey: null, isExtra: true }))
  const allTasks     = [...allScheduledTasks, ...allExtraTasks]
  const pendingTasks = allTasks.filter(t => !done[t.id])

  const byQuadrant = {}
  Object.keys(QUADRANTS).forEach(q => { byQuadrant[q] = [] })
  pendingTasks.forEach(task => {
    const q = getQuadrant(task.id, task.label)
    if (taskFilter === 'all' || taskFilter === q) byQuadrant[q].push(task)
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

    const handleClick = () => { check(task.id) }

    return (
      <div key={task.id} style={{ marginBottom: 3 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.75)', borderRadius: 'var(--r)',
            padding: '7px 10px', cursor: 'pointer',
          }}
          onClick={handleClick}
        >
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            border: `1.5px solid ${q.border}`, flexShrink: 0,
          }} />
          {(subject?.emoji || task.emoji) && <span style={{ fontSize: 'var(--t-body)' }}>{subject?.emoji || task.emoji}</span>}
          <span style={{ fontSize: 'var(--t-caption)', fontWeight: 500, color: q.text, flex: 1, lineHeight: 1.3 }}>
            {task.label}
            {task.recurrence && <span style={{ fontSize: 'var(--t-caption)', marginLeft: 4, opacity: 0.6 }}>{task.recurrence === 'daily' ? '🔁' : '📅'}</span>}
          </span>
          {task.mins && <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: q.text, opacity: 0.6, flexShrink: 0 }}>{task.mins}min</span>}
          {scheduledLabels.has(task.label) && (
            <span title="Já tem bloco no horário" style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: '#16a34a', background: 'var(--green-50)', border: '1px solid #86efac', borderRadius: 50, padding: '1px 6px', flexShrink: 0 }}>
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
            onClick={e => { e.stopPropagation(); snoozeTask(task) }}
            title="Adiar para amanhã"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--t-body)', color: q.text, opacity: 0.5, padding: '0 2px', lineHeight: 1 }}
          >↪</button>
          <button
            onClick={e => { e.stopPropagation(); setEditingId(editingId === task.id ? null : task.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--t-caption)', color: q.text, opacity: 0.5, padding: '0 2px' }}
            title="Mover para outro quadrante"
          >↕</button>
        </div>

        {editingId === task.id && (
          <div style={{
            background: 'var(--white)', border: '1px solid var(--gray-200)',
            borderRadius: 'var(--r)', padding: '6px', marginTop: 4,
            boxShadow: 'var(--shadow)', zIndex: 10, position: 'relative',
          }}>
            <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 600, marginBottom: 4, paddingLeft: 4 }}>Mover para:</p>
            {Object.entries(QUADRANTS).map(([k, qOpt]) => (
              <button
                key={k}
                onClick={() => setQuadrant(task.id, k)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  width: '100%', padding: '5px 8px', borderRadius: 6,
                  border: 'none', background: k === qKey ? qOpt.color : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 'var(--t-caption)', fontWeight: 600, color: qOpt.text, textAlign: 'left',
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
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
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
        <div style={{ display: 'flex', gap: 8 }}>
          {allCount > 0 && (
            <button
              onClick={() => setShowMatrix(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 50,
                border: '1.5px solid var(--gray-200)',
                background: showMatrix ? 'var(--rose-50)' : 'var(--white)',
                color: showMatrix ? 'var(--rose-400)' : 'var(--gray-500)',
                fontFamily: 'inherit', fontWeight: 700, fontSize: 'var(--t-caption)', cursor: 'pointer',
              }}
            >
              <Settings2 size={13} />
              {showMatrix ? 'Vista normal' : 'Matriz'}
            </button>
          )}
        </div>
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
          borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 14,
          boxShadow: 'var(--shadow)',
        }}>
          <p style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)', letterSpacing: 0.5, marginBottom: 8 }}>
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
                    fontFamily: 'inherit', fontWeight: 700, fontSize: 'var(--t-body)', cursor: 'pointer',
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
              marginTop: 10, fontSize: 'var(--t-caption)', color: currentEnergy.color,
              fontWeight: 600, background: currentEnergy.bg,
              padding: '6px 12px', borderRadius: 'var(--r)', display: 'inline-block',
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
              <p style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)', letterSpacing: 0.6, marginBottom: 8 }}>
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
                      borderRadius: 'var(--r)', padding: '12px 14px',
                    }}>
                      <p style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: q.text, marginBottom: 8 }}>
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
              <p style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)', letterSpacing: 0.6, marginBottom: 8 }}>
                Seleciona a tua energia para ver a ordem sugerida · clica numa tarefa para a mover
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {Object.entries(QUADRANTS).map(([qKey, q]) => (
                  <div key={qKey} style={{
                    background: q.color, border: `1.5px solid ${q.border}`,
                    borderRadius: 'var(--r)', padding: '12px 14px', minHeight: 80,
                  }}>
                    <p style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: q.text, marginBottom: 8 }}>
                      {q.emoji} {q.label}
                    </p>
                    {byQuadrant[qKey].length === 0
                      ? <p style={{ fontSize: 'var(--t-caption)', color: q.text, opacity: 0.4, fontStyle: 'italic' }}>Nada aqui</p>
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
                    <button
                      onClick={e => { e.stopPropagation(); snoozeTask({ ...task, subjectKey, isExtra: false }) }}
                      title="Adiar para amanhã"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-300)', padding: '0 4px', fontSize: 'var(--t-body)', lineHeight: 1, flexShrink: 0 }}
                    >↪</button>
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

      {/* Deficit suggestions — shown only when no schedule tasks for today */}
      {isToday && allCount === 0 && (() => {
        try {
          const s = JSON.parse(localStorage.getItem('user-settings') || '{}')
          const subjs = s.subjects || []
          if (subjs.length === 0) return null
          const sess = JSON.parse(localStorage.getItem('study-sessions') || '[]')
          const monday = getMondayOfWeek(new Date())
          const targets = JSON.parse(localStorage.getItem('subject-targets') || '{}')
          const hoursGoal = s.hoursGoal || 550
          const daysRem = s.periodEnd ? Math.max(1, Math.round((new Date(s.periodEnd) - new Date()) / 86400000)) : 120
          const weeksRem = Math.max(1, daysRem / 7)
          const dow = new Date().getDay() === 0 ? 7 : new Date().getDay()
          const deficits = subjs.map(sub => {
            const weeklyT = (parseFloat(targets[sub.key] || hoursGoal / subjs.length) / weeksRem)
            const targetNow = weeklyT * (dow / 7)
            const weekDone = sess.filter(x => x.subject === sub.key && new Date(x.date) >= monday).reduce((a, b) => a + (b.hours || 0), 0)
            const deficit = Math.max(0, parseFloat((targetNow - weekDone).toFixed(1)))
            return { ...sub, deficit, weekDone: parseFloat(weekDone.toFixed(1)), weeklyT: parseFloat(weeklyT.toFixed(1)) }
          }).filter(x => x.deficit > 0).sort((a, b) => b.deficit - a.deficit)
          if (deficits.length === 0) return null
          return (
            <div style={{ marginBottom: 16, padding: '16px 18px', background: 'var(--white)', border: '1.5px dashed var(--gray-200)', borderRadius: 'var(--r)' }}>
              <p style={{ fontSize: 'var(--t-caption)', fontWeight: 800, color: 'var(--gray-400)', letterSpacing: 0.5, marginBottom: 10 }}>
                💡 SUGESTÕES — ATRASO DESTA SEMANA
              </p>
              {deficits.slice(0, 4).map(sub => (
                <div key={sub.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{sub.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--t-body)', color: 'var(--gray-800)' }}>{sub.name}</p>
                    <p style={{ margin: 0, fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>
                      {sub.weekDone}h feitas · meta {sub.weeklyT}h/semana
                    </p>
                  </div>
                  <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, padding: '3px 10px', borderRadius: 50, background: (sub.color || '#f9a8d4') + '22', color: sub.textColor || 'var(--gray-600)', flexShrink: 0 }}>
                    {sub.deficit}h em falta
                  </span>
                </div>
              ))}
            </div>
          )
        } catch { return null }
      })()}

      {/* Extra tasks */}
      <div style={{ marginTop: 20, borderTop: '1px solid var(--gray-100)', paddingTop: 20 }}>
        <p style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)', letterSpacing: 0.5, marginBottom: 10 }}>
          Tarefas extra
        </p>

        {!showMatrix && extraTasks.filter(t => !done[t.id]).length > 0 && (
          <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {extraTasks.filter(t => !done[t.id]).map((task, i) => (
              <div
                key={task.id}
                draggable
                onDragStart={() => onExtraDragStart(i)}
                onDragOver={(e) => onExtraDragOver(e, i)}
                onDragEnd={onExtraDragEnd}
                className="task-item"
                style={{ cursor: 'grab', opacity: dragIdx === i ? 0.4 : 1 }}
                onClick={() => task.recurrence
                  ? setDone(prev => ({ ...prev, [task.id]: true }))
                  : removeExtra(task.id)
                }
              >
                <div className="task-checkbox" style={{ border: '1.5px solid var(--gray-300)' }}>
                  <Check size={13} color="transparent" strokeWidth={3} />
                </div>
                {task.emoji
                  ? <span style={{ fontSize: '1rem', flexShrink: 0, lineHeight: 1 }}>{task.emoji}</span>
                  : null
                }
                <span className="task-label" style={{ color: 'var(--gray-700)' }}>{task.label}</span>
                {task.mins && <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)', flexShrink: 0, marginLeft: 'auto' }}>{task.mins}min</span>}
                {task.recurrence && <span style={{ fontSize: 'var(--t-caption)', opacity: 0.45, flexShrink: 0 }}>{task.recurrence === 'daily' ? '🔁' : '📅'}</span>}
                <button onClick={e => { e.stopPropagation(); snoozeTask(task) }} title="Adiar para amanhã"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-300)', padding: '0 3px', fontSize: 'var(--t-body)', lineHeight: 1, flexShrink: 0 }}>↪</button>
                <button onClick={e => { e.stopPropagation(); removeExtra(task.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-300)', padding: '0 2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input
            type="text"
            placeholder="Nova tarefa extra..."
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addExtra()}
            style={{ flex: 1, fontFamily: 'inherit', fontSize: 'var(--t-body)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--r)', padding: '7px 12px', background: 'var(--white)', color: 'var(--gray-900)', outline: 'none' }}
          />
          <button className="btn btn-primary" onClick={addExtra} style={{ flexShrink: 0, padding: '7px 14px' }}>
            <Plus size={14} />
          </button>
        </div>

        {/* Emoji quick picks from subjects */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)', letterSpacing: 0.4, flexShrink: 0 }}>emoji</span>
          {[...new Map(Object.values(SUBJECTS).filter(s => s.emoji).map(s => [s.emoji, s])).values()].map(s => (
            <button key={s.emoji} onClick={() => setNewTaskEmoji(prev => prev === s.emoji ? '' : s.emoji)} title={s.name}
              style={{ padding: '3px 7px', border: `1.5px solid ${newTaskEmoji === s.emoji ? '#f43f5e' : 'var(--gray-200)'}`, borderRadius: 6, background: newTaskEmoji === s.emoji ? '#fff1f2' : 'transparent', cursor: 'pointer', fontSize: 'var(--t-body)', lineHeight: 1 }}>
              {s.emoji}
            </button>
          ))}
          <input
            type="text" placeholder="✏️" value={newTaskEmoji}
            onChange={e => setNewTaskEmoji(e.target.value)} maxLength={2}
            style={{ width: 34, textAlign: 'center', fontSize: 'var(--t-body)', fontFamily: 'inherit', border: '1.5px solid var(--gray-200)', borderRadius: 6, padding: '3px 4px', background: 'var(--white)', color: 'var(--gray-900)', outline: 'none' }}
          />
        </div>

        {/* Urgência */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)', letterSpacing: 0.4, flexShrink: 0 }}>urgência</span>
          {Object.entries(QUADRANTS).map(([id, q]) => (
            <button key={id} onClick={() => setNewTaskQuadrant(id)}
              style={{ padding: '3px 10px', border: `1.5px solid ${newTaskQuadrant === id ? q.border : 'var(--gray-200)'}`, borderRadius: 50, background: newTaskQuadrant === id ? q.color : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 'var(--t-caption)', color: newTaskQuadrant === id ? q.text : 'var(--gray-500)', whiteSpace: 'nowrap' }}>
              {q.emoji} {q.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="number" min={5} max={480} placeholder="⏱ min"
            value={newTaskMins} onChange={e => setNewTaskMins(e.target.value)}
            style={{ width: 80, fontFamily: 'inherit', fontSize: 'var(--t-caption)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--r)', padding: '5px 8px', background: 'var(--white)', color: 'var(--gray-900)', outline: 'none' }}
          />
          <select value={newTaskRecurrence} onChange={e => setNewTaskRecurrence(e.target.value)}
            style={{ fontFamily: 'inherit', fontSize: 'var(--t-caption)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--r)', padding: '5px 8px', background: 'var(--white)', color: 'var(--gray-700)', cursor: 'pointer', outline: 'none' }}>
            <option value="none">Sem recorrência</option>
            <option value="daily">🔁 Diária</option>
            <option value="weekly">📅 Semanal</option>
          </select>
          {addedTask && <span style={{ fontSize: 'var(--t-caption)', color: 'var(--green-500)', fontWeight: 700 }}>✓ adicionada!</span>}
        </div>
      </div>

      <div style={{ marginTop: 32, borderTop: '1px solid var(--gray-100)', paddingTop: 32 }}>
        <CalendarView />
      </div>
    </div>
  )
}