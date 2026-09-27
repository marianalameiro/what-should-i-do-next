import { useState, useEffect } from 'react'
import { Play, Pause, RotateCcw, ExternalLink } from 'lucide-react'

const MODES = [
  { id: 'work25',     label: 'Foco 25',   minutes: 25,  color: '#e11d48' },
  { id: 'work50',     label: 'Foco 50',   minutes: 50,  color: '#e11d48' },
  { id: 'work60',     label: 'Foco 60',   minutes: 60,  color: '#9b1c3a' },
  { id: 'stopwatch',  label: 'Contador',  minutes: null, color: '#6366f1' },
  { id: 'shortBreak', label: 'Pausa 5',   minutes: 5,   color: '#16a34a' },
  { id: 'longBreak',  label: 'Pausa 15',  minutes: 15,  color: '#2563eb' },
]

function readTimerState() {
  try {
    const raw = JSON.parse(localStorage.getItem('pomodoro-timer-state'))
    if (!raw) return null
    if (raw.running && raw.savedAt) {
      const elapsed = Math.floor((Date.now() - raw.savedAt) / 1000)
      return raw.isStopwatch
        ? { ...raw, secondsElapsed: (raw.secondsElapsed || 0) + elapsed }
        : { ...raw, secondsLeft: Math.max(0, (raw.secondsLeft || 0) - elapsed) }
    }
    return raw
  } catch { return null }
}

function writeTimerState(state) {
  const full = { ...state, savedAt: Date.now() }
  localStorage.setItem('pomodoro-timer-state', JSON.stringify(full))
}

export default function TrayApp() {
  const [timerState, setTimerState] = useState(() => readTimerState())
  const [settings, setSettings]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('user-settings')) } catch { return null }
  })
  const [selSubject, setSelSubject] = useState('')
  const [selMode, setSelMode]       = useState('work25')
  const [showLog, setShowLog]       = useState(false)
  const [logHours, setLogHours]     = useState('1')
  const [logDone, setLogDone]       = useState(false)

  const subjects = settings?.subjects || []

  // Sincroniza cadeira selecionada com timer ativo ou primeira cadeira
  useEffect(() => {
    if (timerState?.subject) setSelSubject(timerState.subject)
    else if (subjects.length > 0 && !selSubject) setSelSubject(subjects[0]?.key || '')
  }, [timerState?.subject, subjects.length])

  // Tick a cada segundo
  useEffect(() => {
    const id = setInterval(() => setTimerState(readTimerState()), 1000)
    return () => clearInterval(id)
  }, [])

  // Storage events do processo principal
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'pomodoro-timer-state') {
        try { setTimerState(JSON.parse(e.newValue)) } catch {}
      }
      if (e.key === 'user-settings') {
        try { setSettings(JSON.parse(e.newValue)) } catch {}
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const openApp = () => {
    if (window.electronAPI?.focusMainWindow) window.electronAPI.focusMainWindow()
  }

  const logSession = () => {
    const h = parseFloat(logHours)
    if (!h || h <= 0 || !selSubject) return
    try {
      const sessions = JSON.parse(localStorage.getItem('study-sessions') || '[]')
      sessions.push({ id: Date.now(), subject: selSubject, hours: h, date: new Date().toDateString(), notes: '', mood: '😊', startTime: Date.now() - h * 3600000 })
      localStorage.setItem('study-sessions', JSON.stringify(sessions))
    } catch {}
    setLogDone(true)
    setLogHours('1')
    setShowLog(false)
    setTimeout(() => setLogDone(false), 3000)
  }

  const toggleTimer = () => {
    const ch = new BroadcastChannel('pomodoro-sync')
    ch.postMessage({ type: 'TOGGLE_PLAY' })
    ch.close()
  }

  const startNew = () => {
    const modeObj = MODES.find(m => m.id === selMode)
    const isStopwatch = selMode === 'stopwatch'
    const state = {
      mode: selMode,
      subject: selSubject,
      secondsLeft: isStopwatch ? 0 : modeObj.minutes * 60,
      secondsElapsed: 0,
      running: true,
      isStopwatch,
    }
    writeTimerState(state)
    setTimerState({ ...state, savedAt: Date.now() })
    const ch = new BroadcastChannel('pomodoro-sync')
    ch.postMessage({ type: 'SET_TIMER', ...state })
    ch.close()
  }

  const resetTimer = () => {
    const modeObj = MODES.find(m => m.id === (timerState?.mode || 'work25')) || MODES[0]
    const isStopwatch = timerState?.mode === 'stopwatch'
    const state = {
      mode: timerState?.mode || 'work25',
      subject: timerState?.subject || selSubject,
      secondsLeft: isStopwatch ? 0 : modeObj.minutes * 60,
      secondsElapsed: 0,
      running: false,
      isStopwatch,
    }
    writeTimerState(state)
    setTimerState(state)
    const ch = new BroadcastChannel('pomodoro-sync')
    ch.postMessage({ type: 'SET_TIMER', ...state })
    ch.close()
  }

  const isActive = timerState && (
    timerState.running ||
    (timerState.isStopwatch && (timerState.secondsElapsed || 0) > 0) ||
    (!timerState.isStopwatch && (timerState.secondsLeft || 0) > 0 && (timerState.secondsLeft || 0) < (MODES.find(m => m.id === timerState.mode)?.minutes || 25) * 60)
  )

  const S = {
    wrap: { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', padding: '14px 16px', background: 'rgba(252,252,252,0.97)', color: '#111', boxSizing: 'border-box', overflowY: 'auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    label: { fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em' },
    sectionLabel: { fontSize: 9.5, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.07em', marginBottom: 6, marginTop: 0 },
    pills: { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 },
  }

  if (isActive) {
    const { running, isStopwatch, secondsLeft, secondsElapsed, mode: activeMode, subject: activeSubject } = timerState
    const display = isStopwatch ? (secondsElapsed || 0) : (secondsLeft || 0)
    const mm = Math.floor(display / 60).toString().padStart(2, '0')
    const ss = (display % 60).toString().padStart(2, '0')
    const modeObj = MODES.find(m => m.id === activeMode) || MODES[0]
    const subjectObj = subjects.find(s => s.key === activeSubject)
    const totalSec = isStopwatch ? 1 : (modeObj.minutes || 25) * 60
    const progress = isStopwatch ? 0 : Math.round(((totalSec - display) / totalSec) * 100)

    return (
      <div style={S.wrap}>
        <div style={S.header}>
          <span style={S.label}>{modeObj.label.toUpperCase()}</span>
          <button onClick={openApp} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}>
            <ExternalLink size={13} />
          </button>
        </div>

        {subjectObj && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 16, background: subjectObj.color + '18', color: subjectObj.color, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, alignSelf: 'flex-start' }}>
            <span>{subjectObj.emoji}</span>
            <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subjectObj.name}</span>
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{ fontSize: 58, fontWeight: 800, letterSpacing: -2, lineHeight: 1, color: running ? '#111' : '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
            {mm}:{ss}
          </div>

          {!isStopwatch && (
            <div style={{ width: '100%', height: 3, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: modeObj.color, borderRadius: 2 }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button onClick={toggleTimer} style={{ width: 50, height: 50, borderRadius: '50%', border: 'none', cursor: 'pointer', background: running ? '#f3f4f6' : modeObj.color, color: running ? '#374151' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: running ? 'none' : `0 4px 12px ${modeObj.color}55` }}>
              {running ? <Pause size={19} /> : <Play size={19} style={{ marginLeft: 2 }} />}
            </button>
            <button onClick={resetTimer} title="Reiniciar" style={{ width: 50, height: 50, borderRadius: '50%', border: '1.5px solid #e5e7eb', cursor: 'pointer', background: '#fff', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Vista idle: escolher cadeira + modo + iniciar
  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.label}>POMODORO</span>
        <button onClick={openApp} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}>
          <ExternalLink size={13} />
        </button>
      </div>

      {subjects.length > 0 && (
        <div>
          <p style={S.sectionLabel}>CADEIRA</p>
          <div style={S.pills}>
            {subjects.map(s => (
              <button key={s.key} onClick={() => setSelSubject(s.key)} style={{ padding: '4px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: `1.5px solid ${selSubject === s.key ? s.color : '#e5e7eb'}`, background: selSubject === s.key ? s.color + '20' : 'transparent', color: selSubject === s.key ? s.color : '#6b7280', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                {s.emoji} {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p style={S.sectionLabel}>MODO</p>
        <div style={S.pills}>
          {MODES.map(m => (
            <button key={m.id} onClick={() => setSelMode(m.id)} style={{ padding: '4px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: `1.5px solid ${selMode === m.id ? m.color : '#e5e7eb'}`, background: selMode === m.id ? m.color + '20' : 'transparent', color: selMode === m.id ? m.color : '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Streak */}
      {(() => {
        try {
          const sl = JSON.parse(localStorage.getItem('study-sessions') || '[]')
          const days = new Set(sl.map(s => new Date(s.date).toDateString()))
          let streak = 0
          const d = new Date(); d.setHours(0,0,0,0)
          if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1)
          while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1) }
          if (streak === 0) return null
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '5px 8px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
              <span style={{ fontSize: 13 }}>🔥</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ea580c' }}>{streak} dia{streak !== 1 ? 's' : ''} seguido{streak !== 1 ? 's' : ''}</span>
            </div>
          )
        } catch { return null }
      })()}

      {/* Study priority today */}
      {(() => {
        try {
          const cfg = JSON.parse(localStorage.getItem('user-settings') || '{}')
          const subs = cfg.subjects || []
          if (subs.length === 0) return null
          const tgts = JSON.parse(localStorage.getItem('subject-targets') || '{}')
          const sl = JSON.parse(localStorage.getItem('study-sessions') || '[]')
          const periodEnd = cfg.periodEnd ? new Date(cfg.periodEnd + 'T23:59:59') : new Date(Date.now() + 60 * 86400000)
          const daysLeft = Math.max(1, (periodEnd - Date.now()) / 86400000)
          const defaultH = (cfg.hoursGoal || 550) / Math.max(1, subs.length)
          const top = subs.map(s => {
            const t = parseFloat(tgts[s.key]); const target = t > 0 ? t : defaultH
            const done = sl.filter(x => x.subject === s.key).reduce((a, b) => a + (b.hours || 0), 0)
            return { ...s, needed: parseFloat(Math.max(0, (target - done) / daysLeft).toFixed(1)) }
          }).filter(s => s.needed > 0).sort((a, b) => b.needed - a.needed).slice(0, 3)
          if (top.length === 0) return null
          return (
            <div style={{ marginBottom: 8 }}>
              <p style={S.sectionLabel}>FOCO DE HOJE</p>
              {top.map(s => (
                <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                  <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{s.emoji} {s.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.needed >= 3 ? '#dc2626' : s.needed >= 1.5 ? '#d97706' : '#16a34a' }}>{s.needed}h</span>
                </div>
              ))}
            </div>
          )
        } catch { return null }
      })()}

      <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={startNew} disabled={subjects.length > 0 && !selSubject} style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: '#e11d48', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (subjects.length > 0 && !selSubject) ? 0.5 : 1 }}>
          ▶ Iniciar
        </button>

        {/* Quick session log */}
        {logDone ? (
          <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#16a34a', padding: '5px 0' }}>✓ Sessão registada!</div>
        ) : showLog ? (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <input
              type="number" min={0.25} max={12} step={0.25}
              value={logHours} onChange={e => setLogHours(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && logSession()}
              autoFocus
              style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontFamily: 'inherit', fontSize: 12, textAlign: 'center', outline: 'none' }}
              placeholder="horas"
            />
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>h</span>
            <button onClick={logSession} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>✓</button>
            <button onClick={() => setShowLog(false)} style={{ padding: '6px 8px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#9ca3af', fontFamily: 'inherit', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>✕</button>
          </div>
        ) : (
          <button onClick={() => setShowLog(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', padding: '2px 0', textAlign: 'center' }}>
            + REGISTAR SESSÃO
          </button>
        )}
      </div>
    </div>
  )
}
