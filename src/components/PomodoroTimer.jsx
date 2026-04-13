import { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, Timer } from 'lucide-react'


const MODES = [
  { id: 'work25',     label: 'Foco 25',     minutes: 25,  color: '#c0455a', isWork: true },
  { id: 'work50',     label: 'Foco 50',     minutes: 50,  color: '#c0455a', isWork: true },
  { id: 'work60',     label: 'Foco 60',     minutes: 60,  color: '#9b1c3a', isWork: true },
  { id: 'stopwatch',  label: 'Contador',    minutes: null, color: '#6366f1', isWork: true },
  { id: 'shortBreak', label: 'Pausa curta', minutes: 5,   color: '#16a34a', isWork: false },
  { id: 'longBreak',  label: 'Pausa longa', minutes: 15,  color: '#2563eb', isWork: false },
]

const TIMER_STATE_KEY = 'pomodoro-timer-state'

function loadSessions() {
  try { return JSON.parse(localStorage.getItem('study-sessions')) || [] }
  catch { return [] }
}
function saveSessions(s) { localStorage.setItem('study-sessions', JSON.stringify(s)) }

function playDoneSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18)
      gain.gain.setValueAtTime(0.35, ctx.currentTime + i * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.5)
      osc.start(ctx.currentTime + i * 0.18)
      osc.stop(ctx.currentTime + i * 0.18 + 0.5)
    })
  } catch {}
}

function loadTimerState() {
  try {
    const raw = JSON.parse(localStorage.getItem(TIMER_STATE_KEY))
    if (!raw) return null
    if (raw.running && raw.savedAt) {
      const elapsed = Math.floor((Date.now() - raw.savedAt) / 1000)
      if (raw.isStopwatch) {
        return { ...raw, secondsElapsed: (raw.secondsElapsed || 0) + elapsed }
      } else {
        const newLeft = Math.max(0, raw.secondsLeft - elapsed)
        return { ...raw, secondsLeft: newLeft, running: newLeft > 0 }
      }
    }
    return raw
  } catch { return null }
}

function saveTimerState(state) {
  localStorage.setItem(TIMER_STATE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }))
}

export function PomodoroTimer({ subjects: propSubjects }) {
  const subjects = propSubjects || []
  const saved = loadTimerState()

  // Read prefill from schedule page
  const prefillSubject = (() => {
    try {
      const pf = JSON.parse(localStorage.getItem('pomodoro-prefill'))
      if (pf?.subjectKey) {
        localStorage.removeItem('pomodoro-prefill')
        return pf.subjectKey
      }
    } catch {}
    return null
  })()

  const [mode, setMode]               = useState(saved?.mode || 'work25')
  const [subject, setSubject]         = useState(prefillSubject || saved?.subject || subjects[0]?.key || '')
  const [secondsLeft, setSeconds]     = useState(saved?.secondsLeft ?? 25 * 60)
  const [secondsElapsed, setElapsed]  = useState(saved?.secondsElapsed || 0)
  const [running, setRunning]         = useState(saved?.running || false)
  const [completed, setCompleted]     = useState(0)
  const [log, setLog]                 = useState([])
  const [showNotes, setShowNotes]     = useState(false)
  const [pendingMinutes, setPendingMinutes] = useState(0)
  const [noteText, setNoteText]       = useState('')
  const [sessionProject, setSessionProject] = useState('')

  const projects = (() => { try { return JSON.parse(localStorage.getItem('projects-v2')) || [] } catch { return [] } })()
    .filter(p => p.status !== 'completed')
  const didMount        = useRef(false)
  const intervalRef     = useRef(null)
  // Wall-clock based timing — source of truth to avoid setInterval drift
  const wallStartRef    = useRef(null)   // Date.now() when current run began
  const baseLeftRef     = useRef(null)   // secondsLeft at start of current run
  const baseElapsedRef  = useRef(null)   // secondsElapsed at start of current run
  // Always-fresh refs so the timer effect can read current state without stale closures
  const secondsLeftRef  = useRef(secondsLeft)
  const secondsElapsedRef = useRef(secondsElapsed)

  const currentMode = MODES.find(m => m.id === mode)
  const isStopwatch = mode === 'stopwatch'

  // Keep fresh refs in sync with state
  useEffect(() => { secondsLeftRef.current    = secondsLeft    }, [secondsLeft])
  useEffect(() => { secondsElapsedRef.current = secondsElapsed }, [secondsElapsed])

  useEffect(() => {
    saveTimerState({ mode, subject, secondsLeft, secondsElapsed, running, isStopwatch })
  }, [mode, subject, secondsLeft, secondsElapsed, running, isStopwatch])

  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    clearInterval(intervalRef.current)
    setRunning(false)
    setElapsed(0)
    setShowNotes(false)
    if (!isStopwatch) setSeconds(currentMode.minutes * 60)
    else setSeconds(0)
  }, [mode])

  useEffect(() => {
    if (!running) { clearInterval(intervalRef.current); return }

    // Snapshot wall clock and current values when run starts
    wallStartRef.current   = Date.now()
    baseLeftRef.current    = secondsLeftRef.current
    baseElapsedRef.current = secondsElapsedRef.current

    const tick = () => {
      const wallElapsed = Math.floor((Date.now() - wallStartRef.current) / 1000)

      if (isStopwatch) {
        setElapsed(baseElapsedRef.current + wallElapsed)
      } else {
        const newLeft = Math.max(0, baseLeftRef.current - wallElapsed)
        setSeconds(newLeft)
        if (newLeft <= 0) {
          clearInterval(intervalRef.current)
          setRunning(false)
          playDoneSound()
          setPendingMinutes(currentMode.minutes)
          setShowNotes(true)
          // Auto-save immediately — notes dialog is optional enrichment
          if (currentMode.isWork) {
            const sessions = loadSessions()
            const hours = parseFloat((currentMode.minutes / 60).toFixed(2))
            const autoSession = {
              id: Date.now(),
              subject,
              hours,
              notes: `Pomodoro ${currentMode.minutes}min`,
              date: new Date().toDateString(),
              startTime: wallStartRef.current,
              projectId: sessionProject || null,
              _pomodoroAutoSaved: true,
            }
            saveSessions([autoSession, ...sessions])
            setCompleted(prev => prev + 1)
            setLog(prev => [{
              id: autoSession.id,
              subject,
              minutes: currentMode.minutes,
              notes: '',
              time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
            }, ...prev])
          }
        }
      }
    }

    // Poll every 250ms — but browsers throttle background tabs.
    // On visibility change we re-sync immediately from wall clock so the
    // timer is always correct after the screen comes back on.
    intervalRef.current = setInterval(tick, 250)

    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [running, mode, subject])

  const saveSession = (totalMinutes, notes) => {
    if (!currentMode.isWork) return
    const sessions = loadSessions()
    const hours = parseFloat((totalMinutes / 60).toFixed(2))
    const newSession = {
      id: Date.now(),
      subject,
      hours,
      notes: notes || (isStopwatch ? 'Contador livre' : `Pomodoro ${totalMinutes}min`),
      date: new Date().toDateString(),
      startTime: Date.now() - totalMinutes * 60 * 1000,
      projectId: sessionProject || null,
    }
    saveSessions([newSession, ...sessions])
    setCompleted(prev => prev + 1)
    setLog(prev => [{
      id: Date.now(),
      subject,
      minutes: totalMinutes,
      notes: notes || '',
      time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
    }, ...prev])
    if (Notification.permission === 'granted') {
      new Notification('Sessão concluída!', { body: `${totalMinutes} minutos de foco completos!` })
    }
  }

  // For stopwatch: pause and show notes dialog
  const stopStopwatch = () => {
    clearInterval(intervalRef.current)
    setRunning(false)
    const minutesStudied = Math.floor(secondsElapsed / 60)
    if (minutesStudied >= 1) {
      setPendingMinutes(minutesStudied)
      setShowNotes(true)
    } else {
      setElapsed(0)
    }
  }

  const confirmSave = () => {
    if (isStopwatch) {
      // Stopwatch: save now (no auto-save happened)
      saveSession(pendingMinutes, noteText)
    } else if (noteText.trim()) {
      // Countdown: just update notes on the auto-saved session
      const sessions = loadSessions()
      const updated = sessions.map((s, i) => i === 0 && s._pomodoroAutoSaved
        ? { ...s, notes: noteText.trim(), _pomodoroAutoSaved: undefined }
        : s)
      saveSessions(updated)
      setLog(prev => prev.map((l, i) => i === 0 ? { ...l, notes: noteText.trim() } : l))
    }
    setElapsed(0)
    setNoteText('')
    setShowNotes(false)
    setPendingMinutes(0)
  }

  const cancelSave = () => {
    // Countdown: session already auto-saved, just close
    // Stopwatch: discard
    if (isStopwatch) { setElapsed(0) }
    setNoteText('')
    setShowNotes(false)
    setPendingMinutes(0)
  }

  const reset = () => {
    clearInterval(intervalRef.current)
    setRunning(false)
    setElapsed(0)
    setShowNotes(false)
    if (!isStopwatch) setSeconds(currentMode.minutes * 60)
  }

  const requestNotifications = () => {
    if (Notification.permission !== 'granted') Notification.requestPermission()
  }

  const displaySeconds = isStopwatch ? secondsElapsed : secondsLeft
  const minutes = Math.floor(displaySeconds / 60).toString().padStart(2, '0')
  const secs    = (displaySeconds % 60).toString().padStart(2, '0')
  const totalSec = isStopwatch ? Math.max(displaySeconds, 1) : currentMode.minutes * 60
  const progress = isStopwatch
    ? ((secondsElapsed % (60 * 60)) / (60 * 60)) * 100
    : ((totalSec - secondsLeft) / totalSec) * 100
  const circumference = 2 * Math.PI * 90

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>🍅 Pomodoro</h1>
        <p className="subtitle">O cronómetro continua a correr mesmo que mudes de página</p>
      </div>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            padding: '7px 14px', borderRadius: 50,
            border: `2px solid ${mode === m.id ? m.color : 'var(--gray-200)'}`,
            background: mode === m.id ? m.color : 'var(--white)',
            color: mode === m.id ? 'var(--white)' : 'var(--gray-500)',
            fontFamily: 'inherit', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {m.id === 'stopwatch' && <Timer size={12} />}
            {m.label}{m.minutes ? ` · ${m.minutes}min` : ''}
          </button>
        ))}
      </div>

      {/* Subject selector */}
      <div style={{ marginBottom: 28 }}>
        <label style={{ display: 'block', fontSize: '0.73rem', fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          A estudar
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {subjects.map(s => (
            <button key={s.key} onClick={() => setSubject(s.key)} style={{
              padding: '7px 14px', borderRadius: 50,
              border: `2px solid ${subject === s.key ? currentMode.color : 'var(--gray-200)'}`,
              background: subject === s.key ? `${currentMode.color}15` : 'var(--white)',
              color: subject === s.key ? currentMode.color : 'var(--gray-500)',
              fontFamily: 'inherit', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              {s.emoji} {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Timer circle */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ position: 'relative', width: 220, height: 220 }}>
          <svg width="220" height="220" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="110" cy="110" r="90" fill="none" stroke="var(--gray-100)" strokeWidth="10" />
            <circle cx="110" cy="110" r="90" fill="none" stroke={currentMode.color} strokeWidth="10"
              strokeLinecap="round" strokeDasharray={circumference}
              strokeDashoffset={circumference - (progress / 100) * circumference}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: -2, color: 'var(--gray-900)', lineHeight: 1 }}>
              {minutes}:{secs}
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-400)', marginTop: 4 }}>
              {isStopwatch ? 'A contar...' : currentMode.label}
            </div>
            {completed > 0 && (
              <div style={{ fontSize: '0.72rem', color: currentMode.color, fontWeight: 700, marginTop: 4 }}>
                {'🍅'.repeat(Math.min(completed, 8))}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button onClick={reset} style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '2px solid var(--gray-200)', background: 'var(--white)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--gray-400)',
          }}>
            <RotateCcw size={18} />
          </button>

          {isStopwatch && running ? (
            <button onClick={stopStopwatch} style={{
              height: 64, padding: '0 24px', borderRadius: 32, border: 'none',
              background: currentMode.color, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              color: 'white', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem',
              boxShadow: `0 4px 20px ${currentMode.color}50`,
            }}>
              <Pause size={20} /> Parar e guardar
            </button>
          ) : (
            <button onClick={() => { setRunning(v => !v); requestNotifications() }} style={{
              width: 64, height: 64, borderRadius: '50%', border: 'none',
              background: currentMode.color, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', boxShadow: `0 4px 20px ${currentMode.color}50`,
              transform: running ? 'scale(0.95)' : 'scale(1)',
            }}>
              {running ? <Pause size={26} /> : <Play size={26} style={{ marginLeft: 3 }} />}
            </button>
          )}
        </div>

        {isStopwatch && !running && secondsElapsed === 0 && !showNotes && (
          <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: 10, fontWeight: 500 }}>
            Liga e estuda. Para quando terminares — as horas são guardadas.
          </p>
        )}
      </div>

      {/* Notes dialog — shown after stopping stopwatch */}
      {showNotes && (
        <div style={{
          background: 'var(--white)', border: '1.5px solid #c4b5fd',
          borderRadius: 'var(--radius-lg)', padding: '20px 22px',
          marginBottom: 20, boxShadow: 'var(--shadow-md)',
        }}>
          <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--gray-800)', marginBottom: 4 }}>
            Sessão concluída ✨
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--gray-400)', marginBottom: 14 }}>
            {pendingMinutes} minutos · {subjects.find(s => s.key === subject)?.name}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 10 }}>
            ✅ Sessão guardada automaticamente. Adiciona notas se quiseres (opcional).
          </p>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            O que estudaste?
          </label>
          <textarea
            rows={3}
            placeholder="Ex: Revi o capítulo 3, fiz exercícios de limites, li artigo sobre sinapses..."
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            autoFocus
            style={{
              width: '100%', fontFamily: 'inherit', fontSize: '0.88rem',
              border: '1px solid var(--gray-200)', borderRadius: 10,
              padding: '10px 12px', outline: 'none',
              background: 'var(--gray-50)', color: 'var(--gray-900)',
              resize: 'vertical', lineHeight: 1.6, marginBottom: 12,
              boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.borderColor = '#8b5cf6'}
            onBlur={e => e.target.style.borderColor = 'var(--gray-200)'}
            onKeyDown={e => e.key === 'Enter' && e.metaKey && confirmSave()}
          />
          {projects.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Ligar a projeto (opcional)
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSessionProject('')}
                  style={{ padding: '4px 10px', borderRadius: 50, border: `1.5px solid ${!sessionProject ? '#8b5cf6' : 'var(--gray-200)'}`, background: !sessionProject ? '#f5f3ff' : 'var(--white)', fontFamily: 'inherit', fontSize: '0.78rem', cursor: 'pointer', color: !sessionProject ? '#5b21b6' : 'var(--gray-500)', fontWeight: !sessionProject ? 700 : 500 }}
                >
                  Nenhum
                </button>
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSessionProject(p.id)}
                    style={{ padding: '4px 10px', borderRadius: 50, border: `1.5px solid ${sessionProject === p.id ? '#8b5cf6' : 'var(--gray-200)'}`, background: sessionProject === p.id ? '#f5f3ff' : 'var(--white)', fontFamily: 'inherit', fontSize: '0.78rem', cursor: 'pointer', color: sessionProject === p.id ? '#5b21b6' : 'var(--gray-500)', fontWeight: sessionProject === p.id ? 700 : 500 }}
                  >
                    {p.emoji || '🗂'} {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={confirmSave} style={{ background: '#8b5cf6' }}>
              {isStopwatch ? 'Guardar sessão' : 'Adicionar notas'}
            </button>
            <button className="btn btn-secondary" onClick={cancelSave}>
              {isStopwatch ? 'Descartar' : 'Fechar'}
            </button>
          </div>
        </div>
      )}

      {/* Session log */}
      {log.length > 0 && (
        <div style={{
          background: 'var(--white)', border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius)', padding: '16px 18px', boxShadow: 'var(--shadow-xs)',
        }}>
          <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gray-700)', marginBottom: 10 }}>
            Sessões de hoje
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {log.map(l => {
              const subj = subjects.find(s => s.key === l.subject)
              return (
                <div key={l.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 12px', background: 'var(--gray-50)',
                  borderRadius: 8, fontSize: '0.85rem',
                }}>
                  <span>{subj?.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{subj?.name}</span>
                    {l.notes && <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', margin: '2px 0 0', fontStyle: 'italic' }}>{l.notes}</p>}
                  </div>
                  <span style={{ color: 'var(--gray-400)', fontWeight: 600, flexShrink: 0 }}>{l.minutes} min</span>
                  <span style={{ color: 'var(--gray-400)', fontSize: '0.75rem', flexShrink: 0 }}>{l.time}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}