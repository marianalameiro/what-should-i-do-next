import { useState, useMemo } from 'react'
import { CheckCircle, Clock, Flame, ChevronRight, Target, TrendingUp, TrendingDown, Minus, AlertTriangle, FolderKanban, Plus } from 'lucide-react'
import { getTasksForDay } from '../data/schedule'
import { getMondayOfWeek, daysUntil } from '../utils/dates'
import { SundayPlanning } from './SundayPlanning'

function saveSessions(s) { localStorage.setItem('study-sessions', JSON.stringify(s)) }

const TODAY = new Date()

const QUOTES = [
  // 1–31: um por cada dia do mês
  { text: 'O sucesso é a soma de pequenos esforços repetidos dia após dia.', author: 'Robert Collier' },
  { text: 'Não contes os dias, faz os dias contarem.', author: 'Muhammad Ali' },
  { text: 'A disciplina é a ponte entre os objetivos e as conquistas.', author: 'Jim Rohn' },
  { text: 'Cada hora de estudo hoje é um investimento na versão que queres ser amanhã.', author: '' },
  { text: 'O teu futuro eu vai agradecer o que fizeres hoje.', author: '' },
  { text: 'Consistência bate talento quando o talento não é consistente.', author: 'Tim Notke' },
  { text: 'Não é preciso ser grande para começar, mas é preciso começar para ser grande.', author: 'Zig Ziglar' },
  { text: 'A educação é a arma mais poderosa que podes usar para mudar o mundo.', author: 'Nelson Mandela' },
  { text: 'O segredo de avançar é começar.', author: 'Mark Twain' },
  { text: 'Aprende como se fosses viver para sempre, vive como se fosses morrer amanhã.', author: 'Mahatma Gandhi' },
  { text: 'A única maneira de fazer um grande trabalho é amar o que fazes.', author: 'Steve Jobs' },
  { text: 'Não tens de ser perfeito, tens de ser persistente.', author: '' },
  { text: 'Uma hora de estudo concentrado vale mais do que três horas de distração.', author: '' },
  { text: 'O esforço de hoje é o resultado de amanhã.', author: '' },
  { text: 'Quanto mais sua, mais sorte pareces ter.', author: 'Séneca' },
  { text: 'A mente que se abre a uma nova ideia nunca volta ao seu tamanho original.', author: 'Albert Einstein' },
  { text: 'Cai sete vezes, levanta oito.', author: 'Provérbio japonês' },
  { text: 'O conhecimento é o único bem que cresce quando é partilhado.', author: '' },
  { text: 'Pequenos progressos diários somam grandes resultados.', author: '' },
  { text: 'A dificuldade de hoje é a competência de amanhã.', author: '' },
  { text: 'Não compares o teu capítulo 1 com o capítulo 20 de outra pessoa.', author: '' },
  { text: 'A fadiga que sentes hoje é a força que terás amanhã.', author: '' },
  { text: 'Estuda não para saber mais do que os outros, mas para saber mais do que ontem.', author: '' },
  { text: 'Mesmo que sejas lento, não pares.', author: 'Confúcio' },
  { text: 'O único lugar onde o sucesso vem antes do trabalho é no dicionário.', author: 'Vidal Sassoon' },
  { text: 'Cada dia é uma nova oportunidade de melhorar.', author: '' },
  { text: 'A concentração de hoje constrói a liberdade de amanhã.', author: '' },
  { text: 'Não é o mais forte que sobrevive, mas o mais adaptável.', author: 'Charles Darwin' },
  { text: 'O teu único limite és tu mesmo.', author: '' },
  { text: 'Vai devagar mas não voltes atrás.', author: 'Abraham Lincoln' },
  { text: 'Termina o mês mais forte do que o começaste.', author: '' },
]

function loadSessions()      { try { return JSON.parse(localStorage.getItem('study-sessions')) || [] } catch { return [] } }
function loadExams()         { try { return JSON.parse(localStorage.getItem('exams')) || [] } catch { return [] } }
function loadDone()          { try { return JSON.parse(localStorage.getItem(`tasks-${TODAY.toDateString()}`)) || {} } catch { return {} } }
function loadProjects()      { try { return JSON.parse(localStorage.getItem('projects-v2')) || [] } catch { return [] } }
function loadTargets()       { try { return JSON.parse(localStorage.getItem('subject-targets')) || {} } catch { return {} } }
function loadWeeklyTargets() { try { return JSON.parse(localStorage.getItem('weekly-targets')) || {} } catch { return {} } }
function loadLinks()         { try { return JSON.parse(localStorage.getItem('quick-links')) || [] } catch { return [] } }
function loadDiary()         { try { return JSON.parse(localStorage.getItem('diary-entries')) || [] } catch { return [] } }

const MOODS = [
  { emoji: '😴', label: 'Cansada' },
  { emoji: '😐', label: 'Normal' },
  { emoji: '😊', label: 'Bem' },
  { emoji: '🔥', label: 'Flow' },
]

function weekDayNumber() {
  const dow = TODAY.getDay()
  return dow === 0 ? 7 : dow
}

function shouldShowBehind() { return weekDayNumber() > 1 }


function currentStreak(sessions) {
  const days = new Set(sessions.map(s => s.date))
  let streak = 0
  const d = new Date(TODAY)
  d.setHours(0, 0, 0, 0)
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1)
  while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1) }
  return streak
}

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

function trackLabel(done, target) {
  const s = trackStatus(done, target)
  if (s === 'green') return 'No bom caminho'
  if (s === 'amber') return 'Atenção'
  return 'Atrasada'
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

function examAlert(exam, sessions, subjects) {
  const days = daysUntil(exam.date)
  if (days < 0) return null
  const subjectSessions = sessions.filter(s => {
    const key = subjects.find(sub => sub.name.toLowerCase() === exam.subject.toLowerCase() || sub.key === exam.subject)?.key
    return s.subject === key
  })
  const totalHours = subjectSessions.reduce((a, b) => a + (b.hours || 0), 0)
  const avgGrade = exam.sheets?.length > 0 ? exam.sheets.reduce((a, b) => a + b.grade, 0) / exam.sheets.length : null
  const recommendedTotal = days <= 7 ? days * 2 : days * 0.8
  const onTrack = totalHours >= recommendedTotal * 0.6
  if (onTrack && (avgGrade === null || avgGrade >= exam.minGrade)) return null
  const issues = []
  if (!onTrack) issues.push(`Faltam ~${Math.max(0, recommendedTotal - totalHours).toFixed(1)}h de estudo para chegar ao exame preparada`)
  if (avgGrade !== null && avgGrade < exam.minGrade) issues.push(`Média das fichas (${avgGrade.toFixed(1)}/20) abaixo da meta (${exam.minGrade}/20)`)
  return { exam, days, issues }
}

const ACHIEVEMENTS = [
  { id: 'first_session',   emoji: '🌱', title: 'Primeira sessão',      desc: 'Registaste a tua primeira sessão de estudo',  check: (s) => s.length >= 1 },
  { id: 'first_exam',      emoji: '🎯', title: 'Primeiro exame',        desc: 'Adicionaste o teu primeiro exame',             check: (_s, e) => e.length >= 1 },
  { id: 'first_diary',     emoji: '📓', title: 'Primeira entrada',      desc: 'Escreveste a tua primeira entrada no diário',  check: (_s, _e, d) => d.length >= 1 },
  { id: 'streak_3',        emoji: '🔥', title: '3 dias seguidos',       desc: 'Estudaste 3 dias consecutivos',               check: (_s, _e, _d, streak) => streak >= 3 },
  { id: 'streak_7',        emoji: '⚡', title: 'Semana completa',        desc: 'Estudaste 7 dias seguidos',                   check: (_s, _e, _d, streak) => streak >= 7 },
  { id: 'streak_14',       emoji: '💫', title: '2 semanas seguidas',    desc: 'Estudaste 14 dias consecutivos',              check: (_s, _e, _d, streak) => streak >= 14 },
  { id: 'streak_30',       emoji: '🏆', title: 'Mês sem falhar',        desc: '30 dias de estudo consecutivos!',             check: (_s, _e, _d, streak) => streak >= 30 },
  { id: 'hours_10',        emoji: '📚', title: '10 horas',              desc: 'Registaste 10 horas de estudo no total',      check: (s) => s.reduce((a,b) => a+(b.hours||0),0) >= 10 },
  { id: 'hours_50',        emoji: '🎓', title: '50 horas',              desc: 'Chegaste às 50 horas de estudo!',             check: (s) => s.reduce((a,b) => a+(b.hours||0),0) >= 50 },
  { id: 'hours_100',       emoji: '💯', title: '100 horas',             desc: 'Centenária do estudo — 100 horas!',           check: (s) => s.reduce((a,b) => a+(b.hours||0),0) >= 100 },
  { id: 'hours_200',       emoji: '🚀', title: '200 horas',             desc: '200 horas de dedicação pura',                 check: (s) => s.reduce((a,b) => a+(b.hours||0),0) >= 200 },
  { id: 'marathon',        emoji: '🏃', title: 'Maratona',              desc: 'Uma sessão de 3h ou mais de seguida',         check: (s) => s.some(x => x.hours >= 3) },
  { id: 'flow_queen',      emoji: '🌊', title: 'Flow Queen',            desc: '5 sessões em modo Flow 🔥',                   check: (s) => s.filter(x => x.mood === '🔥').length >= 5 },
  { id: 'all_subjects',    emoji: '🌈', title: 'Polivalente',           desc: 'Estudaste todas as cadeiras na mesma semana', check: (s, _e, _d, _st, subjects) => {
    if (subjects.length < 2) return false
    const monday = getMondayOfWeek(new Date())
    const wk = new Set(s.filter(x => new Date(x.date) >= monday).map(x => x.subject))
    return subjects.every(sub => wk.has(sub.key))
  }},
  { id: 'early_bird',      emoji: '🌅', title: 'Madrugadora',           desc: 'Sessão iniciada antes das 8h da manhã',       check: (s) => s.some(x => x.startTime && new Date(x.startTime).getHours() < 8) },
  { id: 'night_owl',       emoji: '🌙', title: 'Coruja Noturna',        desc: 'Sessão iniciada depois das 22h',              check: (s) => s.some(x => x.startTime && new Date(x.startTime).getHours() >= 22) },
]

function computeAchievements(sessions, exams, diary, streak, subjects) {
  const saved = (() => { try { return JSON.parse(localStorage.getItem('achievements') || '{}') } catch { return {} } })()
  const now = {}
  ACHIEVEMENTS.forEach(a => {
    if (saved[a.id]?.earned) { now[a.id] = saved[a.id]; return }
    if (a.check(sessions, exams, diary, streak, subjects)) {
      now[a.id] = { earned: true, ts: Date.now() }
    }
  })
  try { localStorage.setItem('achievements', JSON.stringify(now)) } catch {}
  return now
}


export default function Dashboard({ onNavigate, settings }) {
  const subjects        = settings?.subjects || []
  const [quickLog, setQuickLog]     = useState(false)
  const [quickForm, setQuickForm]   = useState({ subject: subjects[0]?.key || '', hours: '', mood: '😊' })
  const [quickSaved, setQuickSaved] = useState(false)
  const [notes, setNotes]           = useState(() => localStorage.getItem('dashboard-notes') || '')
  const [weeklyTargets, setWeeklyTargets] = useState(loadWeeklyTargets)
  const [editTarget, setEditTarget] = useState(null)
  const [targetDraft, setTargetDraft] = useState('')
  const [editingLinks, setEditingLinks] = useState(false)
  const [links, setLinks] = useState(loadLinks)
  const [newLink, setNewLink] = useState({ label: '', url: '', emoji: '🔗' })
  const [showSundayPlanning, setShowSundayPlanning] = useState(false)

  const isSunday = TODAY.getDay() === 0

  const saveLinks = (updated) => {
    setLinks(updated)
    localStorage.setItem('quick-links', JSON.stringify(updated))
  }
  const addLink = () => {
    if (!newLink.label.trim() || !newLink.url.trim()) return
    saveLinks([...links, { ...newLink }])
    setNewLink({ label: '', url: '', emoji: '🔗' })
  }
  const removeLink = (i) => saveLinks(links.filter((_, idx) => idx !== i))

  const saveQuickSession = () => {
    const h = parseFloat(quickForm.hours)
    if (!h || h <= 0 || !quickForm.subject) return
    const all = loadSessions()
    saveSessions([{ id: Date.now(), subject: quickForm.subject, hours: h, notes: '', mood: quickForm.mood, date: TODAY.toDateString() }, ...all])
    setQuickForm(f => ({ ...f, hours: '' }))
    setQuickLog(false)
    setQuickSaved(true)
    setTimeout(() => setQuickSaved(false), 2500)
  }
  const SEMESTER_END    = settings?.periodEnd ? new Date(settings.periodEnd) : new Date(Date.now() + 120 * 86400000)
  const DAYS_REMAINING  = Math.max(0, Math.round((SEMESTER_END - TODAY) / 86400000))
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
  const diary    = loadDiary()
  const done     = loadDone()
  const projects = loadProjects()

  const streak       = currentStreak(sessions)
  const achievements = useMemo(() => computeAchievements(sessions, exams, diary, streak, subjects), [sessions, exams, diary, streak, subjects])
  const weekHrs  = hoursThisWeek(sessions)
  const totalHrs = sessions.reduce((a, b) => a + (b.hours || 0), 0)
  const quote    = QUOTES[(new Date().getDate() - 1) % QUOTES.length]

  const todaySchedule = getTasksForDay(TODAY.getDay())
  const todayTasks    = todaySchedule.flatMap(g => g.tasks)
  const todayDone     = todayTasks.filter(t => done[t.id]).length
  const todayPct      = todayTasks.length === 0 ? 100 : Math.round((todayDone / todayTasks.length) * 100)

  const nextExam = exams.filter(e => daysUntil(e.date) >= 0).sort((a, b) => new Date(a.date) - new Date(b.date))[0]
  const urgency  = nextExam ? (() => {
    const d = daysUntil(nextExam.date)
    if (d <= 7)  return { color: 'var(--red-400)',   label: 'Urgente' }
    if (d <= 21) return { color: 'var(--amber-400)', label: 'Em breve' }
    return { color: 'var(--green-500)', label: 'Com tempo' }
  })() : null

  const alerts          = exams.map(e => examAlert(e, sessions, subjects)).filter(Boolean).slice(0, 3)
  const activeProjects  = projects.filter(p => p.status !== 'completed')

  // Most studied subject this week
  const topSubject = subjects.length > 0 ? subjects.reduce((best, s) => {
    const h = hoursForSubjectThisWeek(sessions, s.key)
    return h > (hoursForSubjectThisWeek(sessions, best.key) || 0) ? s : best
  }, subjects[0]) : null
  const topSubjectHours = topSubject ? hoursForSubjectThisWeek(sessions, topSubject.key) : 0
  // Weekly trend vs last week
  const lastWeekHrs = (() => {
    const monday = getMondayOfWeek(TODAY)
    const lastMonday = new Date(monday); lastMonday.setDate(monday.getDate() - 7)
    return sessions.filter(s => {
      const d = new Date(s.date)
      return d >= lastMonday && d < monday
    }).reduce((a, b) => a + (b.hours || 0), 0)
  })()
  const isWeekend = TODAY.getDay() === 0 || TODAY.getDay() === 6
  const trendPct = isWeekend && lastWeekHrs > 0 ? Math.round((weekHrs - lastWeekHrs) / lastWeekHrs * 100) : null

  const urgentDeadlines = projects
    .flatMap(p => (p.milestones || []).map(m => ({ ...m, projectName: p.name })))
    .filter(m => !m.done && daysUntil(m.date) >= 0 && daysUntil(m.date) <= 7)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  return (
    <div className="fade-in">
      {showSundayPlanning && <SundayPlanning onClose={() => setShowSundayPlanning(false)} />}

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: -0.8, color: 'var(--gray-900)', marginBottom: 2 }}>
          {greetingText()} 👋
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--gray-400)', fontWeight: 500 }}>
          {TODAY.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Quote */}
      <div className="quote-card" style={{ marginBottom: 14 }}>
        <div className="quote-mark">"</div>
        <p className="quote-text">{quote.text}</p>
        {quote.author && (
          <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 600, marginTop: 6, textAlign: 'right' }}>
            — {quote.author}
          </p>
        )}
      </div>

      {/* Quick Links */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {links.map((link, i) => (
            <div key={i} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <a href={link.url} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 50,
                background: 'var(--white)', border: '1.5px solid var(--gray-200)',
                fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-700)',
                textDecoration: 'none', boxShadow: 'var(--shadow-xs)',
                paddingRight: editingLinks ? 28 : 14,
              }}>
                {link.emoji || '🔗'} {link.label}
              </a>
              {editingLinks && (
                <button onClick={() => removeLink(i)} style={{
                  position: 'absolute', right: 6, background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--gray-400)', fontSize: '0.75rem', lineHeight: 1, padding: 2,
                }}>✕</button>
              )}
            </div>
          ))}
          <button onClick={() => setEditingLinks(v => !v)} style={{
            padding: '5px 10px', borderRadius: 50, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: '0.72rem', fontWeight: 700, border: '1.5px dashed var(--gray-300)',
            background: editingLinks ? 'var(--rose-50)' : 'transparent', color: editingLinks ? 'var(--rose-400)' : 'var(--gray-400)',
          }}>{editingLinks ? '✓ Feito' : '+ Links'}</button>
        </div>
        {editingLinks && (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <input value={newLink.emoji} onChange={e => setNewLink(p => ({ ...p, emoji: e.target.value }))}
              style={{ width: 36, textAlign: 'center', fontFamily: 'inherit', fontSize: '1rem', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '4px' }} />
            <input placeholder="Nome" value={newLink.label} onChange={e => setNewLink(p => ({ ...p, label: e.target.value }))}
              style={{ flex: 1, minWidth: 90, fontFamily: 'inherit', fontSize: '0.82rem', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '5px 8px' }} />
            <input placeholder="URL" value={newLink.url} onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addLink()}
              style={{ flex: 2, minWidth: 140, fontFamily: 'inherit', fontSize: '0.82rem', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '5px 8px' }} />
            <button className="btn btn-primary" onClick={addLink} style={{ fontSize: '0.78rem', padding: '5px 12px' }}>+ Adicionar</button>
          </div>
        )}
      </div>

      {/* Exam alerts */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map(({ exam, days, issues }) => (
            <div key={exam.id} style={{
              background: 'var(--orange-50)', border: '1.5px solid var(--orange-100)',
              borderRadius: 'var(--radius)', padding: '12px 16px',
              display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer',
            }} onClick={() => onNavigate('exams')}>
              <AlertTriangle size={16} color="var(--amber-400)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.83rem', color: 'var(--amber-400)', marginBottom: 3 }}>{exam.subject} · {days} dias</p>
                {issues.map((issue, i) => <p key={i} style={{ fontSize: '0.78rem', color: 'var(--amber-400)', margin: 0 }}>• {issue}</p>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top stats */}
      <div className="dashboard-grid" style={{ marginBottom: 14 }}>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('hours')}>
          <div className="stat-label"><Clock size={12} /> Esta semana</div>
          <div className="stat-value">{weekHrs.toFixed(1)}<span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-400)' }}>h</span></div>
          <div className="stat-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {totalHrs.toFixed(0)}h no total
            {trendPct !== null && (
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '1px 5px', borderRadius: 50,
                background: trendPct >= 0 ? '#f0fdf4' : '#fef2f2',
                color: trendPct >= 0 ? 'var(--green-500)' : 'var(--red-400)',
              }}>
                {trendPct >= 0 ? '↑' : '↓'}{Math.abs(trendPct)}% vs semana passada
              </span>
            )}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Flame size={12} /> Streak</div>
          <div className="stat-value">{streak}<span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-400)' }}>d</span></div>
          <div className="stat-sub">{streak === 0 ? 'Começa hoje!' : streak === 1 ? '1 dia seguido' : `${streak} dias seguidos`}</div>
        </div>
      </div>


      {/* Sunday planning banner */}
      {isSunday ? (
        <div style={{
          background: 'linear-gradient(135deg, var(--purple-50) 0%, var(--rose-50) 100%)',
          border: '2px solid var(--purple-200)', borderRadius: 'var(--radius)',
          padding: '14px 16px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        }} onClick={() => setShowSundayPlanning(true)}>
          <span style={{ fontSize: '1.5rem' }}>🗓️</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--purple-dark)', margin: 0 }}>É domingo — hora de planear a semana!</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--purple-500)', margin: 0, marginTop: 2 }}>5 minutos de planeamento = semana muito mais produtiva</p>
          </div>
          <button className="btn btn-primary" style={{ background: 'var(--purple-500)', fontSize: '0.8rem' }} onClick={e => { e.stopPropagation(); setShowSundayPlanning(true) }}>
            Planear
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSundayPlanning(true)}
          className="btn btn-ghost"
          style={{ marginBottom: 14, fontSize: '0.78rem', color: 'var(--gray-400)' }}
        >
          🗓️ Planeamento semanal
        </button>
      )}

      {/* Stats mini-widget */}
      {topSubject && topSubjectHours > 0 && (
        <div
          onClick={() => onNavigate('stats')}
          style={{
            background: 'var(--white)', border: '1px solid var(--gray-100)',
            borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>{topSubject.emoji}</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: 1 }}>
              Cadeira mais estudada esta semana
            </p>
            <p style={{ fontSize: '0.73rem', color: 'var(--gray-400)' }}>
              {topSubject.name} · {topSubjectHours.toFixed(1)}h
            </p>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--rose-400)', fontWeight: 700 }}>Ver stats →</span>
        </div>
      )}

      {/* Next exam */}
      {nextExam && (
        <div className="exam-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('exams')}>
          <div className="exam-countdown">
            <div className="exam-countdown-num" style={{ color: urgency.color }}>{daysUntil(nextExam.date)}</div>
            <div className="exam-countdown-label">dias</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <p className="exam-info-title">{nextExam.subject}</p>
              <span className={`status-pill status-${daysUntil(nextExam.date) <= 7 ? 'red' : daysUntil(nextExam.date) <= 21 ? 'amber' : 'green'}`}>{urgency.label}</span>
            </div>
            <p className="exam-info-sub">
              {nextExam.type} · {new Date(nextExam.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })} · Meta: {nextExam.minGrade}/20
            </p>
          </div>
          <ChevronRight size={16} color="var(--gray-300)" />
        </div>
      )}

      {/* On track */}
      {subjects.length > 0 && (
        <div className="card dashboard-full">
          <div className="card-header">
            <span className="card-title">
              <Target size={12} style={{ display: 'inline', marginRight: 4 }} />
              On Track — esperado até hoje
            </span>
            <button onClick={() => onNavigate('hours')} style={{ fontSize: '0.75rem', color: 'var(--rose-400)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
              Ver detalhes
            </button>
          </div>
          <div className="card-body" style={{ padding: '12px 20px' }}>
            {subjects.map(s => {
              const hrs           = hoursForSubjectThisWeek(sessions, s.key)
              const totalHrsSubj  = sessions.filter(x => x.subject === s.key).reduce((a, b) => a + (b.hours || 0), 0)
              const semesterGoal  = getTarget(s.key)
              const weeklyGoal    = weeklyTargets[s.key] !== undefined ? parseFloat(weeklyTargets[s.key]) : semesterGoal / WEEKS_REMAINING
              const tNow          = weeklyGoal * (weekDayNumber() / 7)
              const pct           = Math.min(100, tNow < 0.1 ? 100 : Math.round(hrs / tNow * 100))
              const semPct        = Math.min(100, semesterGoal > 0 ? Math.round(totalHrsSubj / semesterGoal * 100) : 0)
              const status        = trackStatus(hrs, tNow)
              return (
                <div key={s.key} style={{ marginBottom: 14 }}>
                  <div className="track-row" style={{ marginBottom: 5 }}>
                    <span className="track-emoji">{s.emoji}</span>
                    <span className="track-name">{s.name}</span>
                    <div style={{ flex: 2, margin: '0 12px' }}>
                      <div className="progress-wrap">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: status === 'green' ? 'var(--green-400)' : status === 'amber' ? '#f59e0b' : 'var(--red-400)' }} />
                      </div>
                    </div>
                    <span className={`status-pill status-${status}`} style={{ marginRight: 8 }}>{trackIcon(status)} {trackLabel(hrs, tNow)}</span>
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
                          style={{ width: 46, fontSize: '0.72rem', border: '1px solid var(--rose-300)', borderRadius: 5, padding: '2px 4px', textAlign: 'center', fontFamily: 'inherit' }}
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>h/sem</span>
                      </span>
                    ) : (
                      <span className="track-hours" title="Clica para editar meta semanal" onClick={() => { setEditTarget(s.key); setTargetDraft(weeklyGoal.toFixed(1)) }} style={{ cursor: 'pointer' }}>
                        {hrs.toFixed(1)}h / {weeklyGoal.toFixed(1)}h
                      </span>
                    )}
                  </div>
                  {semesterGoal > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 28 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'var(--gray-100)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${semPct}%`, background: s.color || 'var(--rose-300)', borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--gray-400)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {totalHrsSubj.toFixed(0)}h / {semesterGoal}h semestre ({semPct}%)
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Projects widget */}
      <div className="card dashboard-full" style={{ marginTop: 14, cursor: 'pointer' }} onClick={() => onNavigate('projects')}>
        <div className="card-header">
          <span className="card-title">
            <FolderKanban size={12} style={{ display: 'inline', marginRight: 4 }} />
            Projetos
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--rose-400)', fontWeight: 600 }}>
            Ver todos →
          </span>
        </div>
        <div className="card-body" style={{ padding: '12px 20px' }}>
          {activeProjects.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '0.83rem', color: 'var(--gray-400)' }}>Sem projetos ativos. Clica para adicionar!</p>
              <span style={{ fontSize: '1.5rem' }}>🗂</span>
            </div>
          ) : (
            <>
              {urgentDeadlines.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {urgentDeadlines.slice(0, 2).map((m, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', background: 'var(--red-50)',
                      border: '1px solid var(--red-100)', borderRadius: 8, marginBottom: 5,
                    }}>
                      <span style={{ fontSize: '0.8rem' }}>🚩</span>
                      <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, color: 'var(--red-500)' }}>{m.label}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--red-400)' }}>
                        {daysUntil(m.date) === 0 ? 'Hoje!' : `${daysUntil(m.date)}d`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {activeProjects.slice(0, 3).map(p => {
                const doneTasks  = (p.tasks || []).filter(t => t.done).length
                const totalTasks = (p.tasks || []).length
                const prog = p.progressManual !== undefined
                  ? p.progressManual
                  : totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0
                const days = daysUntil(p.deadline)
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '9px 0', borderBottom: '1px solid var(--gray-50)',
                  }}>
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{p.emoji || '📁'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <p style={{ fontWeight: 700, fontSize: '0.83rem', color: 'var(--gray-800)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                        {days !== null && days <= 14 && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: days <= 7 ? '#dc2626' : '#d97706', flexShrink: 0 }}>
                            {days === 0 ? 'hoje' : `${days}d`}
                          </span>
                        )}
                      </div>
                      <div className="progress-wrap">
                        <div className="progress-fill" style={{ width: `${prog}%`, background: prog === 100 ? 'var(--green-400)' : 'var(--blue-400)' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-400)', flexShrink: 0 }}>{prog}%</span>
                  </div>
                )
              })}
              {activeProjects.length > 3 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', paddingTop: 8, fontWeight: 500 }}>
                  +{activeProjects.length - 3} projetos ativos
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Achievements */}
      {(() => {
        const earned = ACHIEVEMENTS.filter(a => achievements[a.id]?.earned)
        const locked = ACHIEVEMENTS.filter(a => !achievements[a.id]?.earned)
        if (earned.length === 0) return null
        return (
          <div className="card dashboard-full" style={{ marginTop: 14 }}>
            <div className="card-header">
              <span className="card-title">🏅 Conquistas — {earned.length}/{ACHIEVEMENTS.length}</span>
            </div>
            <div className="card-body" style={{ paddingTop: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {earned.map(a => (
                  <div key={a.id} title={a.desc} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 50,
                    background: 'var(--rose-50)', border: '1.5px solid var(--rose-200)',
                    fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-700)',
                  }}>
                    <span style={{ fontSize: '1rem' }}>{a.emoji}</span> {a.title}
                  </div>
                ))}
                {locked.slice(0, 3).map(a => (
                  <div key={a.id} title={`Bloqueada: ${a.desc}`} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 50,
                    background: 'var(--gray-50)', border: '1.5px solid var(--gray-200)',
                    fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-400)',
                    opacity: 0.7, filter: 'grayscale(1)',
                  }}>
                    <span style={{ fontSize: '1rem' }}>{a.emoji}</span> {a.title}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={() => onNavigate('hours')} style={{ borderRadius: 50, fontSize: '0.8rem' }}>🍅 Iniciar Pomodoro</button>
        <button className="btn btn-secondary" onClick={() => setQuickLog(v => !v)} style={{ borderRadius: 50, fontSize: '0.8rem', background: quickLog ? 'var(--rose-50)' : undefined, borderColor: quickLog ? 'var(--rose-300)' : undefined }}>
          <Plus size={13} /> Registar horas
        </button>
        <button className="btn btn-secondary" onClick={() => onNavigate('diary')} style={{ borderRadius: 50, fontSize: '0.8rem' }}>📓 Escrever no diário</button>
        <button className="btn btn-secondary" onClick={() => onNavigate('exams')} style={{ borderRadius: 50, fontSize: '0.8rem' }}>🎯 Ver exames</button>
      </div>

      {quickSaved && (
        <p style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--green-500)', fontWeight: 700 }}>✓ Sessão guardada!</p>
      )}

      {quickLog && (
        <div style={{ marginTop: 10, background: 'var(--white)', border: '1.5px solid var(--rose-200)', borderRadius: 'var(--radius)', padding: '14px 16px', display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 4 }}>Cadeira</label>
            <select className="form-input" style={{ fontSize: '0.83rem' }} value={quickForm.subject} onChange={e => setQuickForm(f => ({ ...f, subject: e.target.value }))}>
              {subjects.map(s => <option key={s.key} value={s.key}>{s.emoji} {s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 4 }}>Horas</label>
            <input type="number" min="0.25" max="12" step="0.25" placeholder="1.5" className="form-input" style={{ width: 80, fontSize: '0.83rem' }}
              value={quickForm.hours} onChange={e => setQuickForm(f => ({ ...f, hours: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && saveQuickSession()} autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 4 }}>Humor</label>
            <div style={{ display: 'flex', gap: 5 }}>
              {MOODS.map(m => (
                <button key={m.emoji} onClick={() => setQuickForm(f => ({ ...f, mood: m.emoji }))} title={m.label} style={{
                  width: 34, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: '1rem',
                  border: `2px solid ${quickForm.mood === m.emoji ? 'var(--rose-300)' : 'var(--gray-200)'}`,
                  background: quickForm.mood === m.emoji ? 'var(--rose-50)' : 'var(--white)',
                }}>{m.emoji}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={saveQuickSession} style={{ fontSize: '0.83rem' }}>Guardar</button>
        </div>
      )}

      {/* Widgets row: Week heatmap + Tasks today */}
      {(() => {
        const monday = getMondayOfWeek(TODAY)
        const DOW_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
        const weekDays = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(monday)
          d.setDate(monday.getDate() + i)
          return d
        })
        const dayHours = weekDays.map(d =>
          sessions.filter(s => s.date === d.toDateString()).reduce((a, b) => a + (b.hours || 0), 0)
        )
        const maxH = Math.max(...dayHours, 0.1)
        const todayIdx = TODAY.getDay() === 0 ? 6 : TODAY.getDay() - 1

        // Today's extra tasks
        const allExtra = (() => {
          try { return JSON.parse(localStorage.getItem('extra-tasks')) || [] } catch { return [] }
        })()
        const pendingExtra = allExtra.filter(t => !done[t.id])
        const extraDone = allExtra.length - pendingExtra.length
        const allTodayTasks = todayTasks.length + allExtra.length
        const allTodayDone  = todayDone + extraDone
        const allTodayPct   = allTodayTasks === 0 ? 100 : Math.round(allTodayDone / allTodayTasks * 100)

        // Days with incomplete schedule tasks in last 7 days
        let overdueDays = 0
        for (let i = 1; i <= 7; i++) {
          const d = new Date(TODAY); d.setDate(TODAY.getDate() - i)
          try {
            const sched = getTasksForDay(d.getDay())
            const hasTasks = sched.some(g => g.tasks.length > 0)
            if (!hasTasks) continue
            const doneMap = JSON.parse(localStorage.getItem(`tasks-${d.toDateString()}`)) || {}
            const allIds = sched.flatMap(g => g.tasks.map(t => t.id))
            const notDone = allIds.filter(id => !doneMap[id])
            if (notDone.length > 0) overdueDays++
          } catch {}
        }

        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14, marginBottom: 0 }}>
            {/* Week hours bar */}
            {sessions.length > 0 && (
              <div style={{ background: 'var(--white)', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', padding: '12px 14px', boxShadow: 'var(--shadow-xs)', cursor: 'pointer' }} onClick={() => onNavigate('stats')}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Horas — esta semana</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 52 }}>
                  {weekDays.map((d, i) => {
                    const h = dayHours[i]
                    const isToday = i === todayIdx
                    const isFuture = d > TODAY
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div style={{
                          width: '100%', borderRadius: 3,
                          background: isFuture ? 'var(--gray-100)' : h > 0 ? (isToday ? 'var(--rose-400)' : 'var(--rose-300)') : 'var(--gray-100)',
                          height: Math.max(3, h / maxH * 40),
                          outline: isToday ? '2px solid var(--rose-400)' : 'none',
                          outlineOffset: 1,
                        }} title={`${DOW_SHORT[i]}: ${h.toFixed(1)}h`} />
                        <span style={{ fontSize: '0.58rem', fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--rose-400)' : 'var(--gray-400)' }}>{DOW_SHORT[i]}</span>
                      </div>
                    )
                  })}
                </div>
                <p style={{ fontSize: '0.68rem', color: 'var(--gray-500)', fontWeight: 700, marginTop: 6 }}>{weekHrs.toFixed(1)}h esta semana</p>
              </div>
            )}

            {/* Tasks today + overdue */}
            <div style={{ background: 'var(--white)', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius)', padding: '12px 14px', boxShadow: 'var(--shadow-xs)', cursor: 'pointer' }} onClick={() => onNavigate('today')}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Tarefas</p>
              {allTodayTasks > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-700)' }}>Hoje</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: allTodayPct === 100 ? 'var(--green-500)' : 'var(--gray-500)' }}>
                      {allTodayDone}/{allTodayTasks} {allTodayPct === 100 ? '🎉' : ''}
                    </span>
                  </div>
                  <div style={{ height: 5, background: 'var(--gray-100)', borderRadius: 50, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${allTodayPct}%`, background: allTodayPct === 100 ? 'var(--green-400)' : 'var(--rose-300)', borderRadius: 50 }} />
                  </div>
                </div>
              )}
              {pendingExtra.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  {pendingExtra.slice(0, 2).map(t => (
                    <p key={t.id} style={{ fontSize: '0.72rem', color: 'var(--gray-600)', margin: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      · {t.label}
                    </p>
                  ))}
                  {pendingExtra.length > 2 && <p style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>+{pendingExtra.length - 2} mais</p>}
                </div>
              )}
              {overdueDays > 0 && (
                <div style={{ padding: '5px 8px', background: 'var(--red-50)', borderRadius: 6, border: '1px solid var(--red-100)' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--red-400)' }}>⚠️ {overdueDays} dia{overdueDays !== 1 ? 's' : ''} com tarefas incompletas</p>
                </div>
              )}
              {allTodayTasks === 0 && overdueDays === 0 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>Nenhuma tarefa pendente 🎉</p>
              )}
            </div>
          </div>
        )
      })()}

      {/* Quick notes */}
      <div style={{ marginTop: 24 }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>📝 Notas rápidas</p>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); localStorage.setItem('dashboard-notes', e.target.value) }}
          placeholder="Rabiscos, links, lembretes soltos..."
          style={{
            width: '100%', minHeight: 90, fontFamily: 'inherit', fontSize: '0.85rem',
            border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius)',
            padding: '10px 12px', resize: 'vertical', outline: 'none',
            background: 'var(--white)', color: 'var(--gray-800)', lineHeight: 1.6,
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  )
}
