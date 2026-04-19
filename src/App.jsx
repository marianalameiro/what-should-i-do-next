import { useState, useEffect, useRef, Component, lazy, Suspense } from "react"

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 32, fontFamily: 'inherit' }}>
        <p style={{ fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Erro ao carregar esta página</p>
        <pre style={{ fontSize: 'var(--t-caption)', color: '#71717a', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {this.state.error.message}{'\n'}{this.state.error.stack}
        </pre>
        <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '6px 14px', borderRadius: 'var(--r)', border: '1px solid #e4e4e7', cursor: 'pointer', fontFamily: 'inherit' }}>
          Tentar novamente
        </button>
      </div>
    )
    return this.props.children
  }
}
import { BookOpen, ListTodo, CalendarDays, FolderKanban, Target, Timer, NotebookPen, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react'
import { supabase } from "./lib/supabase"
import { useUserSettings } from "./hooks/useUserSettings"
import { getTasksForDay, getSubjectsMap } from "./data/schedule"

import LoginPage from "./components/LoginPage"
import Onboarding from "./components/Onboarding"

const SettingsPage  = lazy(() => import("./components/SettingsPage"))
const Dashboard     = lazy(() => import("./components/Dashboard"))
const CadeiraPage   = lazy(() => import("./components/CadeiraPage"))
const DailyView     = lazy(() => import("./components/DailyView"))
const ExamsView     = lazy(() => import("./components/ExamsView"))
const StudyHours    = lazy(() => import("./components/StudyHours"))
const StudyDiary    = lazy(() => import("./components/StudyDiary"))
const ProjectsPage  = lazy(() => import("./components/ProjectsPage"))
const StatsPage     = lazy(() => import("./components/StatsPage"))
const SchedulePage  = lazy(() => import("./components/SchedulePage"))

const TABS = [
  { id: "dashboard", icon: BookOpen,     label: "Diário de Bordo" },
  { id: "today",     icon: ListTodo,     label: "Hoje" },
  { id: "schedule",  icon: CalendarDays, label: "Horário" },
  { id: "projects",  icon: FolderKanban, label: "Projetos" },
  { id: "exams",     icon: Target,       label: "Exames" },
  { id: "hours",     icon: Timer,        label: "Horas & Metas" },
  { id: "diary",     icon: NotebookPen,  label: "Reflexões" },
  { id: "stats",     icon: BarChart3,    label: "Estatísticas" },
  { id: "settings",  icon: Settings,     label: "Definições" },
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
      <div style={{ background: 'var(--white)', borderRadius: 'var(--r)', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-100)' }}>
          <p style={{ fontWeight: 800, fontSize: 'var(--t-body)', color: 'var(--gray-800)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Timer size={15} strokeWidth={1.5} /> Registar sessão</p>
        </div>
        {saved ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: '1.5rem' }}>✅</div>
        ) : (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {subjects.map(s => (
                <button key={s.key} onClick={() => setSubject(s.key)} style={{ padding: '5px 12px', borderRadius: 50, border: `2px solid ${subject === s.key ? s.color : 'var(--gray-200)'}`, background: subject === s.key ? s.color + '33' : 'var(--white)', fontFamily: 'inherit', fontSize: 'var(--t-body)', fontWeight: 700, cursor: 'pointer', color: subject === s.key ? s.textColor : 'var(--gray-500)' }}>
                  {s.emoji} {s.name}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)', marginBottom: 4 }}>Horas</label>
                <input type="number" min="0" max="12" step="1" placeholder="0" value={hours} onChange={e => setHours(e.target.value)} autoFocus
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 700, border: '1.5px solid var(--gray-200)', borderRadius: 'var(--r)', padding: '8px 10px', outline: 'none', background: 'var(--white)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)', marginBottom: 4 }}>Minutos</label>
                <select value={mins} onChange={e => setMins(e.target.value)}
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 700, border: '1.5px solid var(--gray-200)', borderRadius: 'var(--r)', padding: '8px 10px', outline: 'none', background: 'var(--white)', boxSizing: 'border-box' }}>
                  {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => <option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}
                </select>
              </div>
            </div>
            <input type="text" placeholder="Notas (opcional)" value={notes} onChange={e => setNotes(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()}
              style={{ fontFamily: 'inherit', fontSize: 'var(--t-body)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--r)', padding: '8px 10px', outline: 'none', background: 'var(--white)' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} disabled={!subject || (!(parseFloat(hours) > 0) && parseInt(mins) === 0)} style={{ flex: 1, padding: '10px', borderRadius: 'var(--r)', border: 'none', background: 'var(--rose-400)', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 'var(--t-body)', cursor: 'pointer', opacity: (!subject || (!(parseFloat(hours) > 0) && parseInt(mins) === 0)) ? 0.5 : 1 }}>
                Guardar
              </button>
              <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 'var(--r)', border: '1px solid var(--gray-200)', background: 'var(--white)', fontFamily: 'inherit', cursor: 'pointer', color: 'var(--gray-500)' }}>
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
          label: (e.text || '').slice(0, 50) || 'Entrada', sub: `Reflexões · ${new Date(e.id).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}`,
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

  const TYPE_LABEL = { nav: 'Páginas', session: 'Sessões', exam: 'Exames', diary: 'Reflexões' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 120 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--white)', borderRadius: 'var(--r)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: 500, maxWidth: '90vw', overflow: 'hidden' }}
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
            style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 'var(--t-body)', background: 'transparent', color: 'var(--gray-900)' }}
          />
          <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 700 }}>ESC</span>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <p style={{ padding: '20px 16px', color: 'var(--gray-400)', fontSize: 'var(--t-body)', textAlign: 'center' }}>Nenhum resultado para "{query}"</p>
          ) : (() => {
            const els = []
            let lastType = null
            filtered.forEach((item, i) => {
              if (item.type !== lastType) {
                lastType = item.type
                els.push(
                  <p key={`hd-${item.type}`} style={{ padding: '6px 16px 2px', fontSize: 'var(--t-caption)', fontWeight: 800, color: 'var(--gray-400)', letterSpacing: '0.06em', margin: 0 }}>
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
                  <span style={{ fontSize: '1rem', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {item.icon ? <item.icon size={16} strokeWidth={1.5} /> : item.emoji}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--t-body)', fontWeight: i === sel ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                    {item.sub && <span style={{ display: 'block', fontSize: 'var(--t-caption)', color: 'var(--gray-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.sub}</span>}
                  </span>
                </button>
              )
            })
            return els
          })()}
        </div>
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--gray-100)', fontSize: 'var(--t-caption)', color: 'var(--gray-400)', display: 'flex', gap: 12 }}>
          <span>↑↓ navegar</span><span>↵ abrir</span><span>esc fechar</span>
        </div>
      </div>
    </div>
  )
}

function ShortcutsModal({ onClose }) {
  const GROUPS = [
    {
      title: 'Navegação',
      items: [
        { keys: ['1–9'],    desc: 'Ir para página' },
        { keys: ['J'],      desc: 'Descer na lista' },
        { keys: ['K'],      desc: 'Subir na lista' },
        { keys: ['ESC'],    desc: 'Fechar / voltar' },
      ],
    },
    {
      title: 'Sessões & Timer',
      items: [
        { keys: ['N'],      desc: 'Nova sessão de estudo' },
        { keys: ['Space'],  desc: 'Pausar / retomar Pomodoro' },
      ],
    },
    {
      title: 'Pesquisa',
      items: [
        { keys: ['⌘', 'K'], desc: 'Pesquisa rápida' },
        { keys: ['?'],      desc: 'Esta folha de atalhos' },
      ],
    },
  ]

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--white)', borderRadius: 'var(--r)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: 460, maxWidth: '90vw' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--gray-900)', margin: 0 }}>Atalhos de teclado</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 32px' }}>
          {GROUPS.map(g => (
            <div key={g.title}>
              <p style={{ fontSize: 'var(--t-caption)', fontWeight: 800, color: 'var(--gray-400)', letterSpacing: '0.07em', marginBottom: 10 }}>{g.title.toUpperCase()}</p>
              {g.items.map(item => (
                <div key={item.desc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, gap: 12 }}>
                  <span style={{ fontSize: 'var(--t-body)', color: 'var(--gray-600)' }}>{item.desc}</span>
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {item.keys.map((k, i) => (
                      <kbd key={i} style={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700, background: 'var(--gray-100)', border: '1px solid var(--gray-300)', borderRadius: 5, padding: '3px 7px', color: 'var(--gray-700)', lineHeight: 1.4, whiteSpace: 'nowrap' }}>{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 22px', borderTop: '1px solid var(--gray-100)', fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>
          Pressiona <kbd style={{ fontFamily: 'monospace', fontSize: '0.68rem', fontWeight: 700, background: 'var(--gray-100)', border: '1px solid var(--gray-300)', borderRadius: 4, padding: '1px 5px' }}>ESC</kbd> para fechar
        </div>
      </div>
    </div>
  )
}

const isElectron = typeof window !== "undefined" && window.electronAPI

export default function App() {
  const [tab, setTab] = useState("dashboard")
  const [selectedCadeira, setSelectedCadeira] = useState(null)
  const [session, setSession] = useState(undefined)
  const [dragging, setDragging] = useState(false)
  const [pomodoroTick, setPomodoroTick] = useState(null)
  const [todayHours, setTodayHours] = useState(0)
  const [quickLog, setQuickLog] = useState(false)
  const [quickLinks, setQuickLinks] = useState([])

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

  // ───────── Keyboard navigation + shortcuts
  const [cmdOpen, setCmdOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const scrollPositions = useRef({})

  useEffect(() => {
    const handle = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(v => !v)
        return
      }
      if (e.key === 'Escape') {
        setCmdOpen(false)
        setShortcutsOpen(false)
        setSelectedCadeira(null)
        return
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // 1-9 navigation
      const map = { '1':'dashboard','2':'today','3':'schedule','4':'projects','5':'exams','6':'hours','7':'diary','8':'stats','9':'settings' }
      if (map[e.key]) { e.preventDefault(); setTab(map[e.key]); setSelectedCadeira(null); return }

      // N — nova sessão
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setQuickLog(true); return }

      // ? — shortcuts sheet
      if (e.key === '?') { e.preventDefault(); setShortcutsOpen(v => !v); return }

      // J / K — scroll main content
      if (e.key === 'j' || e.key === 'J') { e.preventDefault(); document.querySelector('.main-content')?.scrollBy({ top: 80, behavior: 'smooth' }); return }
      if (e.key === 'k' || e.key === 'K') { e.preventDefault(); document.querySelector('.main-content')?.scrollBy({ top: -80, behavior: 'smooth' }); return }

      // Space — toggle Pomodoro
      if (e.key === ' ') {
        e.preventDefault()
        try {
          const state = JSON.parse(localStorage.getItem('pomodoro-timer-state') || 'null')
          if (state) {
            const now = Date.now()
            let updated
            if (state.running) {
              const elapsed = state.savedAt ? Math.floor((now - state.savedAt) / 1000) : 0
              updated = state.isStopwatch
                ? { ...state, running: false, secondsElapsed: (state.secondsElapsed || 0) + elapsed, savedAt: now }
                : { ...state, running: false, secondsLeft: Math.max(0, (state.secondsLeft || 0) - elapsed), savedAt: now }
            } else {
              updated = { ...state, running: true, savedAt: now }
            }
            localStorage.setItem('pomodoro-timer-state', JSON.stringify(updated))
            window.dispatchEvent(new StorageEvent('storage', { key: 'pomodoro-timer-state', newValue: JSON.stringify(updated) }))
          } else {
            setTab('hours')
            setSelectedCadeira(null)
          }
        } catch {}
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])

  // ───────── Scroll position preservation
  useEffect(() => {
    const key = selectedCadeira || tab
    const el = document.querySelector('.main-content')
    if (!el) return
    const saved = scrollPositions.current[key]
    if (saved != null) requestAnimationFrame(() => { const e = document.querySelector('.main-content'); if (e) e.scrollTop = saved })
    const onScroll = () => { scrollPositions.current[key] = document.querySelector('.main-content')?.scrollTop || 0 }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [tab, selectedCadeira])

  // ───────── Broadcast channel listeners
  useEffect(() => {
    const channel = new BroadcastChannel('pomodoro-sync')
    channel.onmessage = (event) => {
      if (event.data.type === 'FOCUS_APP') {
        if (window.electronAPI?.focusMainWindow) {
          window.electronAPI.focusMainWindow()
        }
      }
    }
    return () => channel.close()
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

    // Re-exporta dados a cada 30s — garante que horas de estudo, exames, etc.
    // ficam atualizados na widget mesmo que o utilizador esteja noutras páginas
    const exportInterval = setInterval(exportWidget, 30_000)

    // Polling da queue a cada 8s como fallback — apanha escritas que o fs.watch
    // possa ter perdido (ex: substituição atómica em algumas versões do macOS)
    const queueInterval = setInterval(processQueue, 8_000)

    return () => {
      window.electronAPI.offDoneQueueChanged(processQueue)
      clearInterval(exportInterval)
      clearInterval(queueInterval)
    }
  }, [])

  // ───────── Quick links (sidebar footer)
  useEffect(() => {
    const load = () => {
      try { setQuickLinks(JSON.parse(localStorage.getItem('quick-links') || '[]')) } catch {}
    }
    load()
    window.addEventListener('storage', load)
    return () => window.removeEventListener('storage', load)
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
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--gray-100)', borderTopColor: 'var(--rose-400)', animation: 'spin 0.7s linear infinite' }} />
        <p style={{ color: 'var(--gray-400)', fontWeight: 600, fontSize: 'var(--t-caption)' }}>A carregar...</p>
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
      {shortcutsOpen && (
        <ShortcutsModal onClose={() => setShortcutsOpen(false)} />
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
              borderRadius: 'var(--r)', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: 'var(--gray-400)', fontSize: 'var(--t-caption)', fontWeight: 600,
            }}
          >
            <span>Navegar...</span>
            <span style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 4, padding: '1px 5px', fontSize: 'var(--t-caption)' }}>⌘K</span>
          </button>
        )}
        <button
          onClick={() => setQuickLog(true)}
          style={{
            margin: settings?.sidebarCompact ? '0 10px 6px' : '0 10px 10px',
            padding: settings?.sidebarCompact ? '10px 0' : '9px 10px',
            background: 'var(--rose-400)', border: 'none',
            borderRadius: 'var(--r)', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center',
            justifyContent: settings?.sidebarCompact ? 'center' : 'flex-start',
            gap: 8, color: '#fff', fontSize: 'var(--t-body)', fontWeight: 700,
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
              className={`nav-btn ${tab === t.id && !selectedCadeira ? "active" : ""}`}
              onClick={() => { setTab(t.id); setSelectedCadeira(null) }}
              title={settings?.sidebarCompact ? t.label : undefined}
              style={settings?.sidebarCompact ? { justifyContent: 'center', padding: '10px 0' } : undefined}
            >
              <t.icon size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              {!settings?.sidebarCompact && t.label}
            </button>
          ))}
        </nav>

        {/* ── Cadeiras ── */}
        {(settings?.subjects || []).length > 0 && (
          <div style={{ marginTop: 4 }}>
            {!settings?.sidebarCompact && (
              <p className="sidebar-section" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <GraduationCap size={11} strokeWidth={2} /> Cadeiras
              </p>
            )}
            {(settings?.subjects || []).map(s => (
              <button
                key={s.key}
                className={`nav-btn ${selectedCadeira === s.key ? 'active' : ''}`}
                onClick={() => setSelectedCadeira(s.key)}
                title={settings?.sidebarCompact ? s.name : undefined}
                style={{
                  ...(settings?.sidebarCompact ? { justifyContent: 'center', padding: '10px 0' } : {}),
                  borderLeft: selectedCadeira === s.key ? `3px solid ${s.color || 'var(--rose-400)'}` : '3px solid transparent',
                }}
              >
                <span style={{ fontSize: '0.95rem', lineHeight: 1, flexShrink: 0 }}>{s.emoji}</span>
                {!settings?.sidebarCompact && (
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                )}
              </button>
            ))}
          </div>
        )}

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
                background: 'var(--accent-50)', border: '1.5px solid var(--rose-300)',
                borderRadius: 'var(--r)', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 8, width: 'calc(100% - 20px)',
              }}
            >
              <span style={{ fontSize: '1rem' }}>🍅</span>
              {!settings?.sidebarCompact && (
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: 'var(--t-caption)', fontWeight: 800, color: 'var(--rose-400)', margin: 0, letterSpacing: -0.5 }}>
                    {mm}:{ss}
                  </p>
                  <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', margin: 0, fontWeight: 600 }}>
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
              borderRadius: 'var(--r)', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 8, width: 'calc(100% - 20px)',
            }}
          >
            <Timer size={16} strokeWidth={1.5} style={{ color: 'var(--purple-dark)', flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 'var(--t-caption)', fontWeight: 800, color: 'var(--purple-dark)', margin: 0 }}>
                {todayHours}h hoje
              </p>
              <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', margin: 0, fontWeight: 600 }}>
                horas estudadas
              </p>
            </div>
          </button>
        )}

        {quickLinks.length > 0 && !settings?.sidebarCompact && (
          <div style={{ margin: '4px 10px 0', borderTop: '1px solid var(--gray-100)', paddingTop: 8 }}>
            <p style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)', margin: '0 0 4px 2px', letterSpacing: '0.04em' }}>Links</p>
            {quickLinks.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '5px 8px', borderRadius: 7, marginBottom: 2,
                  color: 'var(--gray-600)', fontSize: 'var(--t-caption)', fontWeight: 600,
                  textDecoration: 'none', transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{link.emoji || '🔗'}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.label}</span>
              </a>
            ))}
          </div>
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
              fontSize: "var(--t-caption)",
              color: "var(--gray-400)",
              marginBottom: 6,
              fontWeight: 600,
              
              letterSpacing: 0.4,
              padding: "0 10px",
            }}
          >
            {settings?.name || session?.user?.email || ''}
          </p>

          <button
            className="nav-btn"
            onClick={() => setSettings(s => ({ ...s, sidebarCompact: !s.sidebarCompact }))}
            style={{ color: "var(--gray-400)", fontSize: "var(--t-caption)" }}
            title={settings?.sidebarCompact ? 'Expandir sidebar' : 'Compactar sidebar'}
          >
            {settings?.sidebarCompact
              ? <ChevronRight size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              : <ChevronLeft  size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />}
            {!settings?.sidebarCompact && 'Compactar'}
          </button>
          {!isElectron && (
            <button
              className="nav-btn"
              onClick={signOut}
              style={{ color: "var(--gray-400)", fontSize: "var(--t-caption)" }}
              title="Sair"
            >
              <LogOut size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              {!settings?.sidebarCompact && 'Sair'}
            </button>
          )}
          {!settings?.sidebarCompact && (
            <button
              onClick={() => setShortcutsOpen(true)}
              style={{
                margin: '6px 10px 2px', padding: '5px 10px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'center', width: 'calc(100% - 20px)',
              }}
            >
              <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-300)', fontWeight: 600 }}>
                Pressiona <kbd style={{ fontFamily: 'monospace', fontSize: '0.65rem', fontWeight: 700, background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: 4, padding: '1px 5px', color: 'var(--gray-500)' }}>?</kbd> para atalhos
              </span>
            </button>
          )}
        </div>
      </aside>

      <main className="main-content fade-in" key={selectedCadeira || tab}>
        <ErrorBoundary key={selectedCadeira || tab}>
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--gray-100)', borderTopColor: 'var(--rose-400)', animation: 'spin 0.7s linear infinite' }} />
            </div>
          }>
          {selectedCadeira ? (
            <CadeiraPage
              subjectKey={selectedCadeira}
              settings={settings}
              onBack={() => setSelectedCadeira(null)}
              onNavigate={(t) => { setTab(t); setSelectedCadeira(null) }}
            />
          ) : (
            <>
              {tab === "dashboard" && <Dashboard onNavigate={(t) => { setTab(t); setSelectedCadeira(null) }} settings={settings} onOpenCadeira={setSelectedCadeira} />}
              {tab === "today" && <DailyView settings={settings} />}
              {tab === "schedule" && (
                <SchedulePage
                  settings={settings}
                  setSettings={setSettings}
                  onNavigate={(t) => { setTab(t); setSelectedCadeira(null) }}
                  onStartPomodoro={({ subjectKey, title }) => {
                    localStorage.setItem('pomodoro-prefill', JSON.stringify({ subjectKey, title }))
                  }}
                />
              )}
              {tab === "projects" && <ProjectsPage settings={settings} />}
              {tab === "exams" && <ExamsView settings={settings} />}
              {tab === "hours" && <StudyHours settings={settings} />}
              {tab === "diary" && <StudyDiary />}
              {tab === "stats" && <StatsPage settings={settings} onOpenCadeira={setSelectedCadeira} />}
              {tab === "settings" && <SettingsPage settings={settings} setSettings={setSettings} />}
            </>
          )}
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}
