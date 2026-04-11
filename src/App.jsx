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

const isElectron = typeof window !== "undefined" && window.electronAPI

export default function App() {
  const [tab, setTab] = useState("dashboard")
  const [session, setSession] = useState(undefined)
  const [dragging, setDragging] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [pomodoroTick, setPomodoroTick] = useState(null)

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

  // ───────── Keyboard navigation (1-9)
  useEffect(() => {
    const handle = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const map = { '1':'dashboard','2':'today','3':'schedule','4':'projects','5':'exams','6':'hours','7':'diary','8':'stats','9':'settings' }
      if (map[e.key]) { e.preventDefault(); setTab(map[e.key]) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])

  // ───────── Pomodoro sidebar ticker
  useEffect(() => {
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
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // ───────── Exam notifications (once per day)
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    const todayKey = `exam-notified-${new Date().toDateString()}`
    if (localStorage.getItem(todayKey)) return
    if (Notification.permission === 'denied') return

    const notify = () => {
      try {
        const exams = JSON.parse(localStorage.getItem('exams') || '[]')
        const today = new Date(); today.setHours(0, 0, 0, 0)
        exams.forEach(exam => {
          if (!exam.date) return
          const d = new Date(exam.date + 'T12:00:00')
          const days = Math.round((d - today) / 86400000)
          if ([1, 3, 7].includes(days)) {
            new Notification(`📅 ${exam.subject}`, {
              body: days === 1 ? `Amanhã tens ${exam.type}!` : `${exam.type} daqui a ${days} dias`,
              silent: false,
            })
          }
        })
        localStorage.setItem(todayKey, '1')
      } catch (err) { console.error('Exam notification failed', err) }
    }

    if (Notification.permission === 'granted') {
      notify()
    } else {
      Notification.requestPermission().then(p => { if (p === 'granted') notify() })
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
      {focusMode && (
        <button
          onClick={() => setFocusMode(false)}
          style={{
            position: 'fixed', top: 16, right: 16, zIndex: 1000,
            background: 'var(--white)', border: '1px solid var(--gray-200)',
            borderRadius: 50, padding: '6px 14px', fontFamily: 'inherit',
            fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-500)',
            cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
          }}
        >
          ✕ Sair do foco
        </button>
      )}
      <aside
        className="sidebar"
        onMouseDown={onSidebarMouseDown}
        style={{ cursor: dragging ? "grabbing" : "grab", display: focusMode ? 'none' : undefined }}
      >
        <div className="drag-region" />

        <div className="sidebar-brand">
          <p className="sidebar-brand-name">{appName}</p>
          <p className="sidebar-brand-date">{dateLabel}</p>
        </div>

        <p className="sidebar-section">Menu</p>

        <nav className="sidebar-nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`nav-btn ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="nav-icon">{smartEmoji(t.emoji)}</span>
              {t.label}
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
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--rose-400)', margin: 0, letterSpacing: -0.5 }}>
                  {mm}:{ss}
                </p>
                <p style={{ fontSize: '0.65rem', color: 'var(--gray-400)', margin: 0, fontWeight: 600 }}>
                  {isStopwatch ? 'A contar' : 'Pomodoro a correr'}
                </p>
              </div>
            </button>
          )
        })()}

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
            onClick={() => setFocusMode(true)}
            style={{ color: "var(--gray-400)", fontSize: "0.78rem" }}
          >
            <span className="nav-icon">🎯</span> Modo foco
          </button>
          {!isElectron && (
            <button
              className="nav-btn"
              onClick={signOut}
              style={{ color: "var(--gray-400)", fontSize: "0.78rem" }}
            >
              <span className="nav-icon">🚪</span> Sair
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
