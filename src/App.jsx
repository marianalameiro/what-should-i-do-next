import { useState, useEffect, useRef, Component } from "react"

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 32, fontFamily: 'inherit' }}>
        <p style={{ fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Erro ao carregar esta página</p>
        <pre style={{ fontSize: '0.75rem', color: '#71717a', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {this.state.error.message}{'\n'}{this.state.error.stack}
        </pre>
        <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '6px 14px', borderRadius: 8, border: '1px solid #e4e4e7', cursor: 'pointer', fontFamily: 'inherit' }}>
          Tentar novamente
        </button>
      </div>
    )
    return this.props.children
  }
}
import { supabase } from "./lib/supabase"
import { useUserSettings } from "./hooks/useUserSettings"
import { getTasksForDay, getSubjectsMap } from "./data/schedule"

import LoginPage from "./components/LoginPage"
import Onboarding from "./components/Onboarding"
import SettingsPage from "./components/SettingsPage"

import Dashboard from "./components/Dashboard"
import DailyView from "./components/DailyView"
import ExamsView from "./components/ExamsView"
import StudyHours from "./components/StudyHours"
import StudyDiary from "./components/StudyDiary"
import ProjectsPage from "./components/ProjectsPage"
import StatsPage from "./components/StatsPage"
import SchedulePage from "./components/SchedulePage"
import { smartEmoji } from "./components/CalendarEmoji"

const TABS = [
  { id: "dashboard", emoji: "🏠", label: "Diário de Bordo" },
  { id: "today", emoji: "📋", label: "Hoje" },
  { id: "schedule", emoji: "🗓️", label: "Horário" },
  { id: "projects", emoji: "🗂", label: "Projetos" },
  { id: "exams", emoji: "🎯", label: "Exames" },
  { id: "hours", emoji: "⏱️", label: "Horas & Metas" },
  { id: "diary", emoji: "📓", label: "Diário" },
  { id: "stats", emoji: "📊", label: "Estatísticas" },
  { id: "settings", emoji: "⚙️", label: "Definições" },
]

function QuickLogModal({ onClose, settings }) {
  const subjects = settings?.subjects || []
  const [subject, setSubject] = useState(subjects[0]?.key || '')
  const [hours, setHours]     = useState('')
  const [mins, setMins]       = useState('0')
  const [notes, setNotes]     = useState('')
  const [saved, setSaved]     = useState(false)

  const save = () => {
    const h = parseFloat(hours) || 0
    const m = parseInt(mins) || 0
    const total = parseFloat((h + m / 60).toFixed(2))
    if (total <= 0 || !subject) return
    try {
      const sessions = JSON.parse(localStorage.getItem('study-sessions') || '[]')
      sessions.unshift({ id: Date.now(), subject, hours: total, notes, mood: '😊', date: new Date().toDateString(), startTime: null })
      localStorage.setItem('study-sessions', JSON.stringify(sessions))
    } catch {}
    setSaved(true)
    setTimeout(onClose, 900)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9997, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--white)', borderRadius: 14, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)' }}>
          <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--gray-800)', margin: 0 }}>⏱️ Registar sessão</p>
        </div>
        {saved ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: '1.5rem' }}>✅</div>
        ) : (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {subjects.map(s => (
                <button key={s.key} onClick={() => setSubject(s.key)} style={{ padding: '5px 12px', borderRadius: 50, border: `2px solid ${subject === s.key ? s.color : 'var(--gray-200)'}`, background: subject === s.key ? s.color + '33' : 'var(--white)', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', color: subject === s.key ? s.textColor : 'var(--gray-500)' }}>
                  {s.emoji} {s.name}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-400)', marginBottom: 4, textTransform: 'uppercase' }}>Horas</label>
                <input type="number" min="0" max="12" step="1" placeholder="0" value={hours} onChange={e => setHours(e.target.value)} autoFocus
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 700, border: '1.5px solid var(--gray-200)', borderRadius: 8, padding: '8px 10px', outline: 'none', background: 'var(--white)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-400)', marginBottom: 4, textTransform: 'uppercase' }}>Minutos</label>
                <select value={mins} onChange={e => setMins(e.target.value)}
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 700, border: '1.5px solid var(--gray-200)', borderRadius: 8, padding: '8px 10px', outline: 'none', background: 'var(--white)', boxSizing: 'border-box' }}>
                  {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => <option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}
                </select>
              </div>
            </div>
            <input type="text" placeholder="Notas (opcional)" value={notes} onChange={e => setNotes(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()}
              style={{ fontFamily: 'inherit', fontSize: '0.88rem', border: '1.5px solid var(--gray-200)', borderRadius: 8, padding: '8px 10px', outline: 'none', background: 'var(--white)' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} disabled={!subject || (!(parseFloat(hours) > 0) && parseInt(mins) === 0)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--rose-400)', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', opacity: (!subject || (!(parseFloat(hours) > 0) && parseInt(mins) === 0)) ? 0.5 : 1 }}>
                Guardar
              </button>
              <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--gray-200)', background: 'var(--white)', fontFamily: 'inherit', cursor: 'pointer', color: 'var(--gray-500)' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CommandPalette({ onClose, onNavigate }) {
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const navItems = TABS.map(t => ({ ...t, type: 'nav', action: () => onNavigate(t.id) }))

  const searchItems = (() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const results = []
    try {
      const sessions = JSON.parse(localStorage.getItem('study-sessions') || '[]')
      sessions.filter(s => (s.subject || '').toLowerCase().includes(q) || (s.notes || '').toLowerCase().includes(q))
        .slice(0, 4).forEach(s => results.push({
          id: `session-${s.id}`, emoji: '⏱️', type: 'session',
          label: s.subject || 'Sessão', sub: `${s.hours}h · ${s.date}${s.notes ? ' · ' + s.notes.slice(0, 40) : ''}`,
          action: () => onNavigate('hours'),
        }))
    } catch {}
    try {
      const exams = JSON.parse(localStorage.getItem('exams') || '[]')
      exams.filter(e => (e.subject || '').toLowerCase().includes(q) || (e.type || '').toLowerCase().includes(q))
        .slice(0, 3).forEach(e => results.push({
          id: `exam-${e.id}`, emoji: '🎯', type: 'exam',
          label: e.subject || 'Exame', sub: `${e.type || ''} · ${e.date ? new Date(e.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) : ''}`,
          action: () => onNavigate('exams'),
        }))
    } catch {}
    try {
      const diary = JSON.parse(localStorage.getItem('diary-entries') || '[]')
      diary.filter(e => (e.text || '').toLowerCase().includes(q) || (e.subject || '').toLowerCase().includes(q))
        .slice(0, 3).forEach(e => results.push({
          id: `diary-${e.id}`, emoji: '📓', type: 'diary',
          label: (e.text || '').slice(0, 50) || 'Entrada', sub: `Diário · ${new Date(e.id).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}`,
          action: () => onNavigate('diary'),
        }))
    } catch {}
    return results
  })()

  const allItems = query.trim()
    ? [
        ...navItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase())),
        ...searchItems,
      ]
    : navItems

  const filtered = allItems

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && filtered[sel]) { filtered[sel].action(); onClose() }
  }

  const TYPE_LABEL = { nav: 'Páginas', session: 'Sessões', exam: 'Exames', diary: 'Diário' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 120 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--white)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: 500, maxWidth: '90vw', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--gray-100)' }}>
          <span style={{ fontSize: '1rem' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSel(0) }}
            onKeyDown={handleKey}
            placeholder="Pesquisar páginas, sessões, exames, diário..."
            style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '0.95rem', background: 'transparent', color: 'var(--gray-900)' }}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)', fontWeight: 700 }}>ESC</span>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <p style={{ padding: '20px 16px', color: 'var(--gray-400)', fontSize: '0.88rem', textAlign: 'center' }}>Nenhum resultado para "{query}"</p>
          ) : (() => {
            const els = []
            let lastType = null
            filtered.forEach((item, i) => {
              if (item.type !== lastType) {
                lastType = item.type
                els.push(
                  <p key={`hd-${item.type}`} style={{ padding: '6px 16px 2px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    {TYPE_LABEL[item.type] || item.type}
                  </p>
                )
              }
              els.push(
                <button
                  key={item.id}
                  onClick={() => { item.action(); onClose() }}
                  style={{
                    width: '100%', padding: '9px 16px', border: 'none', textAlign: 'left',
                    background: i === sel ? 'var(--pink-50)' : 'transparent',
                    fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    color: 'var(--gray-800)',
                  }}
                >
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>{item.emoji}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: i === sel ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                    {item.sub && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--gray-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.sub}</span>}
                  </span>
                </button>
              )
            })
            return els
          })()}
        </div>
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--gray-100)', fontSize: '0.7rem', color: 'var(--gray-400)', display: 'flex', gap: 12 }}>
          <span>↑↓ navegar</span><span>↵ abrir</span><span>esc fechar</span>
        </div>
      </div>
    </div>
  )
}

const isElectron = typeof window !== "undefined" && window.electronAPI

export default function App() {
  const [tab, setTab] = useState("dashboard")
  const [session, setSession] = useState(undefined)
  const [dragging, setDragging] = useState(false)
  const [pomodoroTick, setPomodoroTick] = useState(null)
  const [todayHours, setTodayHours] = useState(0)
  const [quickLog, setQuickLog] = useState(false)

  const dragOrigin = useRef(null)

  const { settings, setSettings, loading: settingsLoading } = useUserSettings()

  // ───────── Supabase session (skipped in Electron — all data is local)
  useEffect(() => {
    if (isElectron) {
      setSession({})
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))

    return () => subscription.unsubscribe()
  }, [])

  // ───────── Apply theme
  useEffect(() => {
    if (!settings) return

    document.documentElement.setAttribute("data-theme", settings.theme || "light")

    if (settings.accentH) {
      document.documentElement.style.setProperty("--accent-h", settings.accentH)
      document.documentElement.style.setProperty("--accent-s", settings.accentS || "52%")
      document.documentElement.style.setProperty("--accent-l", settings.accentL || "56%")
    }
  }, [settings])

  // ───────── Electron drag window
  const onSidebarMouseDown = (e) => {
    if (!isElectron) return
    if (e.target.closest("button")) return

    dragOrigin.current = { x: e.screenX, y: e.screenY }
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging || !isElectron) return

    const onMove = (e) => {
      const dx = e.screenX - dragOrigin.current.x
      const dy = e.screenY - dragOrigin.current.y

      dragOrigin.current = { x: e.screenX, y: e.screenY }

      window.electronAPI.moveWindow(dx, dy)
    }

    const onUp = () => setDragging(false)

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)

    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [dragging])

  // ───────── Keyboard navigation (1-9) + Cmd+K command palette
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    const handle = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(v => !v)
        return
      }
      if (e.key === 'Escape') { setCmdOpen(false); return }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const map = { '1':'dashboard','2':'today','3':'schedule','4':'projects','5':'exams','6':'hours','7':'diary','8':'stats','9':'settings' }
      if (map[e.key]) { e.preventDefault(); setTab(map[e.key]) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])

  // ───────── Pomodoro sidebar ticker + today hours + deep work
  useEffect(() => {
    function readTodayHours() {
      try {
        const sessions = JSON.parse(localStorage.getItem('study-sessions') || '[]')
        const todayStr = new Date().toDateString()
        return parseFloat(sessions.filter(s => s.date === todayStr).reduce((a, b) => a + (b.hours || 0), 0).toFixed(1))
      } catch { return 0 }
    }
    const interval = setInterval(() => {
      try {
        const raw = JSON.parse(localStorage.getItem('pomodoro-timer-state'))
        if (raw?.running) {
          const elapsed = raw.savedAt ? Math.floor((Date.now() - raw.savedAt) / 1000) : 0
          const live = raw.isStopwatch
            ? { ...raw, secondsElapsed: (raw.secondsElapsed || 0) + elapsed }
            : { ...raw, secondsLeft: Math.max(0, (raw.secondsLeft || 0) - elapsed) }
          setPomodoroTick(live)
        } else {
          setPomodoroTick(null)
        }
      } catch { setPomodoroTick(null) }
      setTodayHours(readTodayHours())
    }, 1000)
    setTodayHours(readTodayHours())
    return () => clearInterval(interval)
  }, [])

  // ───────── Notification system (all types in one interval)
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'denied') return

    // ── Helpers ──────────────────────────────────────────────────────────────
    function getNotifSettings() {
      try {
        const s = JSON.parse(localStorage.getItem('user-settings') || '{}')
        return { wakeHour: parseInt((s.wakeTime || '08:00').split(':')[0], 10),
                 sleepHour: parseInt((s.sleepTime || '23:00').split(':')[0], 10),
                 n: { studyProgress: true, streakRisk: true, weeklyReview: true, longBreak: true, examDay: true,
                      morningReminder: true, dailyGoal: true, neglectedSubject: true, midWeekGoal: true,
                      ...s.notifications } }
      } catch { return { wakeHour: 8, sleepHour: 23, n: { studyProgress:true,streakRisk:true,weeklyReview:true,longBreak:true,examDay:true,morningReminder:true,dailyGoal:true,neglectedSubject:true,midWeekGoal:true } } }
    }

    function getTodayStats() {
      try {
        const sessions = JSON.parse(localStorage.getItem('study-sessions') || '[]')
        const todayStr = new Date().toDateString()
        const hours = parseFloat(sessions.filter(s => s.date === todayStr).reduce((a, b) => a + (b.hours || 0), 0).toFixed(2))
        const days = new Set(sessions.map(s => s.date))
        if (hours > 0) days.add(todayStr)
        let streak = 0
        const d = new Date(); d.setHours(0, 0, 0, 0)
        if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1)
        while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1) }
        return { hours, streak }
      } catch { return { hours: 0, streak: 0 } }
    }

    function notify(title, body) {
      try { new Notification(title, { body, silent: false }) } catch {}
    }

    // ── Study progress (hourly) ───────────────────────────────────────────────
    function checkStudyProgress(h, todayStr, { hours, streak }) {
      const lastKey = `study-notif-hour-${todayStr}`
      const lastHour = parseInt(localStorage.getItem(lastKey) ?? '-1', 10)
      if (h <= lastHour) return
      localStorage.setItem(lastKey, String(h))
      const fmt = hours === 0 ? '0' : Number.isInteger(hours) ? `${hours}` : hours.toFixed(1)
      let title, body
      if (hours === 0) {
        if (h < 11)      { title = '☀️ Bom dia!';            body = 'Ainda não estudaste hoje. Que tal um Pomodoro para começar?' }
        else if (h < 15) { title = '📚 Ainda sem horas hoje'; body = 'Há tempo! Mesmo 30 minutos fazem diferença.' }
        else if (h < 19) { title = '⏰ Tarde de estudo?';     body = 'Ainda está a tempo de registar horas hoje!' }
        else             { title = '🌙 Como correu o dia?';   body = 'Não te esqueças de registar sessões manuais se estudaste offline.' }
      } else if (hours < 1) { title = `📖 ${fmt}h hoje`;              body = 'Bom começo! Mantém o ritmo.' }
      else if (hours < 2)   { title = `📚 ${fmt}h de estudo hoje`;    body = 'Estás a ir bem. Continua assim!' }
      else if (hours < 4)   { title = `⚡ ${fmt}h de produtividade`;  body = 'Excelente sessão de estudo! Mantém o foco.' }
      else if (hours < 6)   { title = `🔥 ${fmt}h hoje — óptimo!`;   body = 'Dia muito produtivo. Faz uma pausa quando precisares.' }
      else                   { title = `🏆 ${fmt}h hoje`;              body = 'Sessão épica! Mereces descansar um pouco.' }
      if (streak >= 3) body += ` 🔥 ${streak} dias seguidos!`
      notify(title, body)
    }

    // ── Streak at risk (once at 21h if no study today and streak > 0) ────────
    function checkStreakRisk(h, todayStr, { hours, streak }) {
      if (h !== 21) return
      const key = `streak-risk-${todayStr}`
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      if (hours === 0 && streak > 0) {
        notify(`🔥 Streak em risco!`, `Tens ${streak} dia${streak !== 1 ? 's' : ''} de streak. Estuda um pouco hoje para não perder!`)
      }
    }

    // ── Weekly review reminder (Sunday 20h) ──────────────────────────────────
    function checkWeeklyReview(h, todayStr) {
      if (new Date().getDay() !== 0 || h !== 20) return
      const key = `review-reminded-${todayStr}`
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      try {
        const reviews = JSON.parse(localStorage.getItem('weekly-reviews') || '[]')
        const thisMonday = new Date(); thisMonday.setHours(0,0,0,0); thisMonday.setDate(thisMonday.getDate() - thisMonday.getDay() + 1)
        const doneThisWeek = reviews.some(r => r.generatedOn && new Date(r.generatedOn) >= thisMonday)
        if (!doneThisWeek) notify('📓 Review semanal', 'Ainda não fizeste a review desta semana. Dedica 5 minutos antes de dormir!')
      } catch {}
    }

    // ── Exam notifications: countdown days + on the day itself ───────────────
    function checkExams(todayStr) {
      const key = `exam-notified-${todayStr}`
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      try {
        const exams = JSON.parse(localStorage.getItem('exams') || '[]')
        const today = new Date(); today.setHours(0, 0, 0, 0)
        exams.forEach(exam => {
          if (!exam.date) return
          const d = new Date(exam.date + 'T12:00:00')
          const days = Math.round((d - today) / 86400000)
          if (days === 0) notify(`🎯 Hoje tens ${exam.type || 'exame'}!`, `${exam.subject} — bom trabalho, vai confiante!`)
          else if ([1, 3, 7].includes(days)) notify(`📅 ${exam.subject}`, days === 1 ? `Amanhã tens ${exam.type}!` : `${exam.type} daqui a ${days} dias`)
        })
      } catch {}
    }

    // ── Long break after 4 pomodoros ────────────────────────────────────────
    function checkLongBreak(todayStr) {
      try {
        const sessions = JSON.parse(localStorage.getItem('study-sessions') || '[]')
        const today = new Date().toDateString()
        const key = `long-break-notif-count-${todayStr}`
        const lastCount = parseInt(localStorage.getItem(key) || '0', 10)
        const pomosToday = sessions.filter(s => s.date === today && (s.notes?.startsWith('Pomodoro') || s._pomodoroAutoSaved !== undefined)).length
        // notify each time the count crosses a multiple of 4
        const newMultiple = Math.floor(pomosToday / 4)
        const oldMultiple = Math.floor(lastCount / 4)
        if (newMultiple > oldMultiple && pomosToday >= 4) {
          localStorage.setItem(key, String(pomosToday))
          notify('☕ Pausa longa!', `Fizeste ${pomosToday} Pomodoros hoje. Mereces uma pausa de 20–30 minutos!`)
        } else {
          localStorage.setItem(key, String(pomosToday))
        }
      } catch {}
    }

    // ── Long session (3h+ today without 30min gap) ───────────────────────────
    function checkLongSession(todayStr) {
      try {
        const sessions = JSON.parse(localStorage.getItem('study-sessions') || '[]')
        const today = new Date().toDateString()
        const todaySessions = sessions.filter(s => s.date === today && s.startTime)
          .sort((a, b) => a.startTime - b.startTime)
        if (todaySessions.length === 0) return
        // Check if last session ended more than 30 min ago and total hours >= 3
        const lastEnd = todaySessions[todaySessions.length - 1].startTime + (todaySessions[todaySessions.length - 1].hours || 0) * 3600000
        const gapMins = (Date.now() - lastEnd) / 60000
        const totalH = todaySessions.reduce((a, b) => a + (b.hours || 0), 0)
        const key = `long-session-notif-${todayStr}-${Math.floor(totalH)}`
        if (totalH >= 3 && gapMins < 60 && !localStorage.getItem(key)) {
          localStorage.setItem(key, '1')
          notify('🧠 Sessão longa!', `Já estudaste ${totalH.toFixed(1)}h hoje. Faz uma pausa de pelo menos 20 minutos!`)
        }
      } catch {}
    }

    // ── Morning reminder (at wake hour) ─────────────────────────────────────
    function checkMorningReminder(h, todayStr) {
      const { wakeHour } = getNotifSettings()
      if (h !== wakeHour) return
      const key = `morning-reminder-${todayStr}`
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      try {
        const exams = JSON.parse(localStorage.getItem('exams') || '[]')
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const soon = exams
          .filter(e => { if (!e.date) return false; const d = new Date(e.date + 'T12:00:00'); const days = Math.round((d - today) / 86400000); return days >= 0 && days <= 3 })
          .sort((a, b) => new Date(a.date) - new Date(b.date))
        if (soon.length > 0) {
          const next = soon[0]
          const days = Math.round((new Date(next.date + 'T12:00:00') - today) / 86400000)
          notify('🌅 Bom dia!', days === 0 ? `Hoje é dia de ${next.type} de ${next.subject}! Vai confiante!` : `${next.type} de ${next.subject} amanhã — foca-te hoje!`)
        } else {
          const msgs = ['Começa com calma — um Pomodoro de cada vez.', 'Mantém o ritmo! Cada sessão conta.', 'Novo dia, nova oportunidade de aprender.']
          notify('🌅 Bom dia!', msgs[new Date().getDay() % msgs.length])
        }
      } catch {}
    }

    // ── Daily goal reached ──────────────────────────────────────────────────
    function checkDailyGoalReached(todayStr, { hours }) {
      const key = `daily-goal-reached-${todayStr}`
      if (localStorage.getItem(key)) return
      try {
        const targets = JSON.parse(localStorage.getItem('daily-study-targets') || '{}')
        const total = Object.values(targets).reduce((a, b) => a + Number(b || 0), 0)
        if (total <= 0 || hours < total) return
        localStorage.setItem(key, '1')
        notify('🎯 Meta do dia atingida!', `Estudaste ${hours.toFixed(1)}h hoje — objetivo cumprido! Mereces descansar.`)
      } catch {}
    }

    // ── Neglected subject (once per day, 9–12h) ─────────────────────────────
    function checkNeglectedSubject(h, todayStr) {
      if (h < 9 || h > 12) return
      const key = `neglected-subject-${todayStr}`
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      try {
        const sessions = JSON.parse(localStorage.getItem('study-sessions') || '[]')
        const s = JSON.parse(localStorage.getItem('user-settings') || '{}')
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const neglected = (s.subjects || []).find(sub => {
          const last = sessions.filter(ses => ses.subject === sub.name || ses.subject === sub.key).sort((a, b) => new Date(b.date) - new Date(a.date))[0]
          if (!last) return false
          return Math.round((today - new Date(last.date)) / 86400000) >= 5
        })
        if (neglected) notify(`📚 Já não estudas ${neglected.name}`, `Há 5+ dias sem sessões de ${neglected.name}. Que tal dar-lhe atenção hoje?`)
      } catch {}
    }

    // ── Mid-week goal check (Wednesday noon) ────────────────────────────────
    function checkMidWeekGoal(h, todayStr) {
      if (new Date().getDay() !== 3 || h !== 12) return
      const key = `midweek-check-${todayStr}`
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      try {
        const sessions = JSON.parse(localStorage.getItem('study-sessions') || '[]')
        const targets = JSON.parse(localStorage.getItem('daily-study-targets') || '{}')
        const totalDaily = Object.values(targets).reduce((a, b) => a + Number(b || 0), 0)
        if (totalDaily <= 0) return
        const weeklyTarget = totalDaily * 5
        const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - monday.getDay() + 1)
        const weekHours = sessions.filter(s => new Date(s.date) >= monday).reduce((a, b) => a + (b.hours || 0), 0)
        const pct = Math.round((weekHours / weeklyTarget) * 100)
        if (pct < 40) notify('📊 Meio da semana', `Só ${weekHours.toFixed(1)}h das ${weeklyTarget.toFixed(0)}h previstas (${pct}%). Ainda dá para recuperar!`)
        else if (pct >= 60) notify('📊 Meio da semana', `${weekHours.toFixed(1)}h estudadas — ${pct}% da meta semanal. Continua assim!`)
      } catch {}
    }

    // ── Main check loop ──────────────────────────────────────────────────────
    function checkAll() {
      const now = new Date()
      const h = now.getHours()
      const todayStr = now.toDateString()
      const { wakeHour, sleepHour, n } = getNotifSettings()

      // Exam check always runs once per day at wake
      if (n.examDay) checkExams(todayStr)

      if (h < wakeHour || h >= sleepHour) return

      const stats = getTodayStats()
      if (n.studyProgress)    checkStudyProgress(h, todayStr, stats)
      if (n.streakRisk)       checkStreakRisk(h, todayStr, stats)
      if (n.weeklyReview)     checkWeeklyReview(h, todayStr)
      if (n.longBreak)        checkLongBreak(todayStr)
      if (n.longBreak)        checkLongSession(todayStr)
      if (n.morningReminder)  checkMorningReminder(h, todayStr)
      if (n.dailyGoal)        checkDailyGoalReached(todayStr, stats)
      if (n.neglectedSubject) checkNeglectedSubject(h, todayStr)
      if (n.midWeekGoal)      checkMidWeekGoal(h, todayStr)
    }

    let interval
    function setup() {
      checkAll()
      interval = setInterval(checkAll, 60 * 1000)
    }

    if (Notification.permission === 'granted') {
      setup()
    } else {
      Notification.requestPermission().then(p => { if (p === 'granted') setup() })
    }

    return () => clearInterval(interval)
  }, [])

  // ───────── Widget ↔ task list sync (always active, regardless of page)
  useEffect(() => {
    if (!window.electronAPI) return

    function buildWidgetData() {
      try {
        const s = JSON.parse(localStorage.getItem('user-settings') || '{}')
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const todayStr = today.toDateString()
        const todayISO = today.toISOString().split('T')[0]
        const todayDone = JSON.parse(localStorage.getItem(`tasks-${todayStr}`) || '{}')
        const extraTasks = JSON.parse(localStorage.getItem('extra-tasks') || '[]')
        const subjectsMap = getSubjectsMap()
        const taskGroups = getTasksForDay(today.getDay())
        const todayDow = today.getDay()
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
            .map(t => ({ id: t.id, label: t.label, subjectKey: null, subjectName: 'Extra', subjectColor: '#e5e7eb', subjectEmoji: '📌', done: !!todayDone[t.id], isExtra: true })),
        ]
        const rawExams = JSON.parse(localStorage.getItem('exams') || '[]')
        const subsByName = Object.fromEntries((s.subjects || []).map(sub => [sub.name, sub]))
        const upcomingExams = rawExams
          .filter(e => e.date >= todayISO && e.actualGrade == null)
          .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3)
          .map(e => { const sub = subsByName[e.subject] || {}; const days = Math.round((new Date(e.date + 'T12:00:00') - today) / 86400000); return { subject: e.subject, type: e.type || 'Exame', date: e.date, days, color: sub.color || '#e5e7eb', emoji: sub.emoji || '📝' } })
        const sessions = JSON.parse(localStorage.getItem('study-sessions') || '[]')
        const todayHours = parseFloat(sessions.filter(s => s.date === todayStr).reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0).toFixed(1))
        return { date: todayStr, tasks: allTasks, doneCount: allTasks.filter(t => t.done).length, totalCount: allTasks.length, upcomingExams, todayHours }
      } catch { return null }
    }

    // Widget → app: process done-queue, write to localStorage, notify DailyView
    const processQueue = async () => {
      const queue = await window.electronAPI.readDoneQueue().catch(() => [])
      if (!queue?.length) return
      const today = new Date().toDateString()
      const ids = queue.filter(e => e.date === today).map(e => e.id)
      if (!ids.length) return
      const key = `tasks-${today}`
      try {
        const existing = JSON.parse(localStorage.getItem(key) || '{}')
        ids.forEach(id => { existing[id] = true })
        localStorage.setItem(key, JSON.stringify(existing))
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(existing) }))
      } catch {}
      await window.electronAPI.clearDoneQueue().catch(() => {})
      // Export updated data to widget immediately
      const data = buildWidgetData()
      if (data) window.electronAPI.exportWidgetData(data).catch(() => {})
    }

    // App → widget: export periodically (catches changes on any page)
    const exportWidget = () => {
      const data = buildWidgetData()
      if (data) window.electronAPI.exportWidgetData(data).catch(() => {})
    }

    processQueue()
    exportWidget()
    window.electronAPI.onDoneQueueChanged(processQueue)
    return () => {
      window.electronAPI.offDoneQueueChanged(processQueue)
    }
  }, [])

  // ───────── Logout
  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
  }

  const handleOnboardingComplete = (data) => {
    setSettings((prev) => ({ ...prev, ...data }))
  }

  // ───────── Loading state
  if (session === undefined || settingsLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
        }}
      >
        <p style={{ color: "var(--gray-400)", fontWeight: 600 }}>A carregar...</p>
      </div>
    )
  }

  // ───────── Login (web only)
  if (!isElectron && !session) return <LoginPage onSkip={() => setSession({})} />

  // ───────── Onboarding
  if (settings && !settings.onboardingDone) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  const today = new Date()

  const dateLabel = today.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  const appName = settings?.appName || "what should I do next?"

  return (
    <div className="app-shell">
      {cmdOpen && (
        <CommandPalette
          onClose={() => setCmdOpen(false)}
          onNavigate={(id) => { setTab(id); setCmdOpen(false) }}
        />
      )}
      {quickLog && (
        <QuickLogModal onClose={() => setQuickLog(false)} settings={settings} />
      )}
      <aside
        className="sidebar"
        onMouseDown={onSidebarMouseDown}
        style={{ cursor: dragging ? "grabbing" : "grab", width: settings?.sidebarCompact ? 64 : undefined }}
      >
        <div className="drag-region" />

        {!settings?.sidebarCompact && (
          <div className="sidebar-brand">
            <p className="sidebar-brand-name">{appName}</p>
            <p className="sidebar-brand-date">{dateLabel}</p>
          </div>
        )}

        {!settings?.sidebarCompact && <p className="sidebar-section">Menu</p>}
        {!settings?.sidebarCompact && (
          <button
            onClick={() => setCmdOpen(true)}
            style={{
              margin: '0 10px 6px', padding: '6px 10px',
              background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
              borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: 'var(--gray-400)', fontSize: '0.72rem', fontWeight: 600,
            }}
          >
            <span>Navegar...</span>
            <span style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 4, padding: '1px 5px', fontSize: '0.65rem' }}>⌘K</span>
          </button>
        )}
        <button
          onClick={() => setQuickLog(true)}
          style={{
            margin: settings?.sidebarCompact ? '0 10px 6px' : '0 10px 10px',
            padding: settings?.sidebarCompact ? '10px 0' : '9px 10px',
            background: 'var(--rose-400)', border: 'none',
            borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center',
            justifyContent: settings?.sidebarCompact ? 'center' : 'flex-start',
            gap: 8, color: '#fff', fontSize: '0.82rem', fontWeight: 700,
            width: 'calc(100% - 20px)',
          }}
          title="Registar sessão de estudo"
        >
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span>
          {!settings?.sidebarCompact && 'Registar horas'}
        </button>

        <nav className="sidebar-nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`nav-btn ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
              title={settings?.sidebarCompact ? t.label : undefined}
              style={settings?.sidebarCompact ? { justifyContent: 'center', padding: '10px 0' } : undefined}
            >
              <span className="nav-icon">{smartEmoji(t.emoji)}</span>
              {!settings?.sidebarCompact && t.label}
            </button>
          ))}
        </nav>

        {pomodoroTick && (() => {
          const isStopwatch = pomodoroTick.isStopwatch
          const secs = isStopwatch ? pomodoroTick.secondsElapsed : pomodoroTick.secondsLeft
          const mm = String(Math.floor(secs / 60)).padStart(2, '0')
          const ss = String(secs % 60).padStart(2, '0')
          return (
            <button
              onClick={() => setTab('hours')}
              style={{
                margin: '8px 10px', padding: '8px 12px',
                background: '#fdf2f4', border: '1.5px solid var(--rose-300)',
                borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 8, width: 'calc(100% - 20px)',
              }}
            >
              <span style={{ fontSize: '1rem' }}>🍅</span>
              {!settings?.sidebarCompact && (
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--rose-400)', margin: 0, letterSpacing: -0.5 }}>
                    {mm}:{ss}
                  </p>
                  <p style={{ fontSize: '0.65rem', color: 'var(--gray-400)', margin: 0, fontWeight: 600 }}>
                    {isStopwatch ? 'A contar' : 'Pomodoro a correr'}
                  </p>
                </div>
              )}
            </button>
          )
        })()}

        {todayHours > 0 && !settings?.sidebarCompact && (
          <button
            onClick={() => setTab('hours')}
            style={{
              margin: '4px 10px', padding: '8px 12px',
              background: 'var(--pink-50)', border: '1.5px solid var(--pink-100)',
              borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 8, width: 'calc(100% - 20px)',
            }}
          >
            <span style={{ fontSize: '1rem' }}>⏱️</span>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--purple-dark)', margin: 0 }}>
                {todayHours}h hoje
              </p>
              <p style={{ fontSize: '0.65rem', color: 'var(--gray-400)', margin: 0, fontWeight: 600 }}>
                horas estudadas
              </p>
            </div>
          </button>
        )}

        <div
          style={{
            marginTop: "auto",
            paddingTop: 12,
            borderTop: "1px solid var(--gray-100)",
          }}
        >
          <p
            style={{
              fontSize: "0.68rem",
              color: "var(--gray-400)",
              marginBottom: 6,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              padding: "0 10px",
            }}
          >
            {settings?.name || session?.user?.email || ''}
          </p>

          <button
            className="nav-btn"
            onClick={() => setSettings(s => ({ ...s, sidebarCompact: !s.sidebarCompact }))}
            style={{ color: "var(--gray-400)", fontSize: "0.78rem" }}
            title={settings?.sidebarCompact ? 'Expandir sidebar' : 'Compactar sidebar'}
          >
            <span className="nav-icon">{settings?.sidebarCompact ? '→' : '←'}</span> {!settings?.sidebarCompact && 'Compactar'}
          </button>
          {!isElectron && (
            <button
              className="nav-btn"
              onClick={signOut}
              style={{ color: "var(--gray-400)", fontSize: "0.78rem" }}
              title="Sair"
            >
              <span className="nav-icon">🚪</span> {!settings?.sidebarCompact && 'Sair'}
            </button>
          )}
        </div>
      </aside>

      <main className="main-content fade-in" key={tab}>
        <ErrorBoundary key={tab}>
          {tab === "dashboard" && <Dashboard onNavigate={setTab} settings={settings} />}
          {tab === "today" && <DailyView settings={settings} />}
          {tab === "schedule" && (
            <SchedulePage
              settings={settings}
              setSettings={setSettings}
              onNavigate={setTab}
              onStartPomodoro={({ subjectKey, title }) => {
                localStorage.setItem('pomodoro-prefill', JSON.stringify({ subjectKey, title }))
              }}
            />
          )}
          {tab === "projects" && <ProjectsPage settings={settings} />}
          {tab === "exams" && <ExamsView settings={settings} />}
          {tab === "hours" && <StudyHours settings={settings} />}
          {tab === "diary" && <StudyDiary />}
          {tab === "stats" && <StatsPage settings={settings} />}
          {tab === "settings" && <SettingsPage settings={settings} setSettings={setSettings} />}
        </ErrorBoundary>
      </main>
    </div>
  )
}
