import { useState, useEffect } from 'react'
import { Plus, Trash2, Check, Edit3, ChevronDown, ChevronUp, X } from 'lucide-react'
import { CalendarEmoji, smartEmoji } from './CalendarEmoji'
import { daysUntil } from '../utils/dates'


const STATUSES = [
  { id: 'active',    label: 'Em curso',  color: '#2563eb', bg: '#dbeafe', dot: '#3b82f6' },
  { id: 'paused',    label: 'Pausado',   color: '#d97706', bg: '#fef3c7', dot: '#f59e0b' },
  { id: 'completed', label: 'Concluído', color: '#16a34a', bg: '#dcfce7', dot: '#22c55e' },
]

const PRIORITIES = [
  { id: 'high',   label: 'Alta',  color: '#dc2626', bg: '#fee2e2' },
  { id: 'medium', label: 'Média', color: '#d97706', bg: '#fef3c7' },
  { id: 'low',    label: 'Baixa', color: '#16a34a', bg: '#dcfce7' },
]

const PROJECT_TYPES = ['Investigação','Manuscrito/Livro','Startup/Produto','Blog/Newsletter','Projeto académico','Estágio','Projeto pessoal','Outro']
const EMOJIS = ['🚀','💡','📖','🔬','🎨','💻','📊','🌱','⚡','🏗️','🎯','📝','🌍','🎵','💼','🔭']

const COLORS = [
  { hex: '#6366f1' }, { hex: '#ec4899' }, { hex: '#f59e0b' }, { hex: '#10b981' },
  { hex: '#3b82f6' }, { hex: '#8b5cf6' }, { hex: '#ef4444' }, { hex: '#14b8a6' },
  { hex: '#f97316' }, { hex: '#84cc16' },
]

const NOTE_TYPES = [
  { id: 'note',       label: 'Nota',     emoji: '📝' },
  { id: 'reflection', label: 'Reflexão', emoji: '💭' },
  { id: 'link',       label: 'Link',     emoji: '🔗' },
  { id: 'resource',   label: 'Recurso',  emoji: '📎' },
]

const PHASES_BY_TYPE = {
  'Investigação':      ['Planeamento', 'Lit. Review', 'Recolha Dados', 'Análise', 'Redação', 'Submissão'],
  'Manuscrito/Livro':  ['Ideia / Outline', 'Rascunho', 'Revisão', 'Beta Readers', 'Polimento', 'Publicação'],
  'Startup/Produto':   ['Ideia', 'Prototipagem', 'MVP', 'Beta', 'Lançamento'],
  'Blog/Newsletter':   ['Planeamento', 'Conteúdo', 'Revisão', 'Publicação'],
  'Estágio':           ['Integração', 'Formação', 'Execução', 'Avaliação', 'Entrega'],
  'Projeto académico': ['Planeamento', 'Pesquisa', 'Desenvolvimento', 'Escrita', 'Submissão'],
  '_default':          ['Início', 'Em curso', 'Revisão', 'Concluído'],
}

function loadProjects() { try { return JSON.parse(localStorage.getItem('projects-v2')) || [] } catch { return [] } }
function saveProjects(p) { localStorage.setItem('projects-v2', JSON.stringify(p)) }
function loadSessions() { try { return JSON.parse(localStorage.getItem('study-sessions')) || [] } catch { return [] } }


function calcProgress(project) {
  const ms = project.milestones || []
  if (ms.length > 0) return Math.round(ms.filter(m => m.done).length / ms.length * 100)
  const tasks = project.tasks || []
  if (!tasks.length) return 0
  return Math.round(tasks.filter(t => t.done).length / tasks.length * 100)
}

function getNextAction(project) {
  const pending = (project.tasks || []).filter(t => !t.done)
  if (!pending.length) return null
  const order = { high: 0, medium: 1, low: 2 }
  return [...pending].sort((a, b) => {
    const pd = (order[a.priority] ?? 1) - (order[b.priority] ?? 1)
    if (pd !== 0) return pd
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })[0]
}

function addLog(project, text) {
  const entry = {
    id: Date.now(),
    text,
    date: new Date().toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  }
  return [...(project.activityLog || []), entry].slice(-50)
}

// ── PhaseBar ──────────────────────────────────────────────────────────────────
function PhaseBar({ project, color, onUpdate }) {
  const phases = PHASES_BY_TYPE[project.type] || PHASES_BY_TYPE['_default']
  const current = Math.min(project.phase ?? 0, phases.length - 1)
  return (
    <div>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        Fase do projeto <span style={{ fontWeight: 400, textTransform: 'none' }}>(clica para avançar)</span>
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
        {phases.map((p, i) => {
          const done = i < current, active = i === current
          return (
            <div key={i} onClick={() => onUpdate({ ...project, phase: i })}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative', cursor: 'pointer' }}>
              {i > 0 && <div style={{ position: 'absolute', right: '50%', top: 10, width: '100%', height: 2, background: i <= current ? color : 'var(--gray-200)', zIndex: 0 }} />}
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${done || active ? color : 'var(--gray-200)'}`, background: done ? color : active ? `${color}22` : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, fontSize: '0.6rem', color: done ? 'white' : active ? color : 'var(--gray-400)', fontWeight: 700 }}>
                {done ? <Check size={10} strokeWidth={3} /> : i + 1}
              </div>
              <span style={{ fontSize: '0.62rem', textAlign: 'center', color: active ? color : done ? 'var(--gray-500)' : 'var(--gray-300)', fontWeight: active ? 700 : 400, lineHeight: 1.2, maxWidth: 52 }}>{p}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Timeline ──────────────────────────────────────────────────────────────────
function Timeline({ milestones }) {
  const sorted = [...milestones].sort((a, b) => new Date(a.date) - new Date(b.date))
  if (!sorted.length) return (
    <div className="empty-state"><div className="e-emoji"><CalendarEmoji size="2em" /></div><p>Sem milestones. Adiciona na tab Milestones.</p></div>
  )
  return (
    <div style={{ paddingLeft: 24, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: 'var(--gray-200)', borderRadius: 1 }} />
      {sorted.map(ms => {
        const d = daysUntil(ms.date)
        const dotColor = ms.done ? '#22c55e' : d !== null && d < 0 ? '#ef4444' : d !== null && d <= 7 ? '#f59e0b' : 'var(--gray-300)'
        return (
          <div key={ms.id} style={{ position: 'relative', marginBottom: 20, paddingLeft: 20 }}>
            <div style={{ position: 'absolute', left: -4, top: 4, width: 14, height: 14, borderRadius: '50%', background: ms.done ? dotColor : 'var(--white)', border: `2px solid ${dotColor}` }} />
            <p style={{ fontWeight: 700, fontSize: '0.85rem', color: ms.done ? 'var(--gray-400)' : 'var(--gray-800)', textDecoration: ms.done ? 'line-through' : 'none', margin: 0, marginBottom: 2 }}>{ms.label}</p>
            <p style={{ fontSize: '0.72rem', color: d !== null && d < 0 && !ms.done ? '#ef4444' : 'var(--gray-400)', fontWeight: 600, margin: 0 }}>
              {ms.date ? new Date(ms.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' }) : ''}
              {d !== null && !ms.done && ` · ${d < 0 ? `${Math.abs(d)}d em atraso` : d === 0 ? 'Hoje' : `${d}d`}`}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ── ProjectCard ───────────────────────────────────────────────────────────────
function ProjectCard({ project, onClick, onDelete, allSubjects = [], sessions = [] }) {
  const progress   = calcProgress(project)
  const status     = STATUSES.find(s => s.id === project.status) || STATUSES[0]
  const days       = daysUntil(project.deadline)
  const color      = project.color || '#6366f1'
  const ms         = project.milestones || []
  const nextAction = getNextAction(project)
  const studyHrs   = sessions.filter(s => s.projectId === project.id).reduce((a, b) => a + (b.hours || 0), 0)

  return (
    <div
      onClick={onClick}
      style={{ background: 'var(--white)', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s', boxShadow: 'var(--shadow-xs)', borderLeft: `4px solid ${color}` }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-xs)'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{project.emoji || '📁'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <p style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--gray-900)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</p>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 50, background: status.bg, color: status.color, flexShrink: 0 }}>{status.label}</span>
          </div>
          {project.description && <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.description}</p>}
        </div>
        <button className="btn btn-ghost" style={{ flexShrink: 0 }} onClick={e => { e.stopPropagation(); onDelete(project.id) }}><Trash2 size={13} /></button>
      </div>

      {(project.tags || []).length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {project.tags.map(tag => (
            <span key={tag} style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 50, background: `${color}18`, color }}># {tag}</span>
          ))}
        </div>
      )}

      {nextAction && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '5px 10px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-100)' }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>→</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--gray-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextAction.label}</span>
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--gray-400)', fontWeight: 600 }}>
            {ms.length > 0 ? `${ms.filter(m=>m.done).length}/${ms.length} milestones` : `${(project.tasks||[]).filter(t=>t.done).length}/${(project.tasks||[]).length} tarefas`}
          </span>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: progress === 100 ? '#16a34a' : 'var(--gray-500)' }}>{progress}%</span>
        </div>
        <div style={{ background: 'var(--gray-100)', borderRadius: 50, height: 5, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#22c55e' : color, borderRadius: 50, transition: 'width 0.4s' }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.7rem', color: 'var(--gray-400)', fontWeight: 600 }}>
        {project.deadline && (
          <span style={{ color: days !== null && days <= 7 ? '#dc2626' : days !== null && days <= 30 ? '#d97706' : 'var(--gray-400)' }}>
            <CalendarEmoji /> {days === null ? project.deadline : days < 0 ? `${Math.abs(days)}d em atraso` : days === 0 ? 'Hoje' : `${days}d`}
          </span>
        )}
        {(project.subjects || []).length > 0 && (
          <span>{project.subjects.map(sk => allSubjects.find(s => s.key === sk)?.emoji).join(' ')}</span>
        )}
        {studyHrs > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color }}>⏱️ {studyHrs.toFixed(1)}h</span>
        )}
        {project.type && <span style={{ marginLeft: 'auto' }}>{project.type}</span>}
      </div>
    </div>
  )
}

// ── ProjectDetail ─────────────────────────────────────────────────────────────
function ProjectDetail({ project, onUpdate, onBack, allSubjects = [] }) {
  const [activeTab, setActiveTab]     = useState('tasks')
  const [editingField, setEditingField] = useState(null)
  const [editName, setEditName]       = useState(project.name)
  const [editDesc, setEditDesc]       = useState(project.description || '')
  const [editWhy, setEditWhy]         = useState(project.why || '')
  const [newTask, setNewTask]         = useState({ label: '', priority: 'medium', dueDate: '', estimatedHours: '' })
  const [newMs, setNewMs]             = useState({ label: '', date: '' })
  const [newNote, setNewNote]         = useState({ text: '', type: 'note', url: '' })
  const [newBlocker, setNewBlocker]   = useState('')
  const [newTag, setNewTag]           = useState('')
  const [newDiary, setNewDiary]       = useState({ date: new Date().toISOString().split('T')[0], text: '' })
  const [showDiaryForm, setShowDiaryForm] = useState(false)
  const [showTaskForm, setShowTaskForm]   = useState(false)
  const [showMsForm, setShowMsForm]       = useState(false)
  const [showNoteForm, setShowNoteForm]   = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const sessions = loadSessions()
  const color    = project.color || '#6366f1'
  const status   = STATUSES.find(s => s.id === project.status) || STATUSES[0]
  const days     = daysUntil(project.deadline)
  const ms       = project.milestones || []
  const tasks    = project.tasks || []
  const notes    = project.notes || []
  const blockers = project.blockers || []
  const tags     = project.tags || []
  const subjects = project.subjects || []
  const progress = calcProgress(project)
  const nextAction = getNextAction(project)

  const totalEstimated = tasks.reduce((a, t) => a + (parseFloat(t.estimatedHours) || 0), 0)
  const projectSessions = sessions.filter(s => s.projectId === project.id)
  const subjectSessions = subjects.length > 0 ? sessions.filter(s => subjects.includes(s.subject) && !s.projectId) : []
  const realHours = projectSessions.reduce((a, s) => a + (s.hours || 0), 0) +
    (subjects.length > 0 ? subjectSessions.reduce((a, s) => a + (s.hours || 0), 0) : 0)
  const hasHours = projectSessions.length > 0 || subjectSessions.length > 0

  const inputStyle = { fontFamily: 'inherit', fontSize: '0.85rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', padding: '7px 10px', outline: 'none', background: 'var(--white)', color: 'var(--gray-900)', width: '100%' }

  const update = (key, val, logMsg) => {
    const updated = { ...project, [key]: val }
    if (logMsg) updated.activityLog = addLog(project, logMsg)
    onUpdate(updated)
  }

  // Tasks
  const toggleTask = (id) => {
    const task = tasks.find(t => t.id === id)
    const done = !task.done
    update('tasks', tasks.map(t => t.id === id ? { ...t, done } : t), done ? `✅ "${task.label}" concluída` : `↩️ "${task.label}" reaberta`)
  }
  const addTask = () => {
    if (!newTask.label.trim()) return
    update('tasks', [...tasks, { id: Date.now(), ...newTask, label: newTask.label.trim(), done: false }], `➕ Tarefa "${newTask.label.trim()}" adicionada`)
    setNewTask({ label: '', priority: 'medium', dueDate: '', estimatedHours: '' })
    setShowTaskForm(false)
  }
  const removeTask = (id) => {
    const task = tasks.find(t => t.id === id)
    update('tasks', tasks.filter(t => t.id !== id), `🗑️ Tarefa "${task.label}" removida`)
  }

  // Milestones
  const toggleMs = (id) => {
    const m = ms.find(m => m.id === id)
    const done = !m.done
    update('milestones', ms.map(m => m.id === id ? { ...m, done } : m), done ? `🚩 Milestone "${m.label}" concluído` : `↩️ Milestone "${m.label}" reaberto`)
  }
  const addMs = () => {
    if (!newMs.label.trim() || !newMs.date) return
    update('milestones', [...ms, { id: Date.now(), ...newMs, done: false }], `➕ Milestone "${newMs.label}" adicionado`)
    setNewMs({ label: '', date: '' })
    setShowMsForm(false)
  }
  const removeMs = (id) => {
    const m = ms.find(m => m.id === id)
    update('milestones', ms.filter(m => m.id !== id), `🗑️ Milestone "${m.label}" removido`)
  }

  // Notes
  const addNote = () => {
    if (!newNote.text.trim()) return
    update('notes', [...notes, { id: Date.now(), ...newNote, createdAt: new Date().toLocaleDateString('pt-PT') }], `📝 Nota adicionada`)
    setNewNote({ text: '', type: 'note', url: '' })
    setShowNoteForm(false)
  }
  const removeNote = (id) => update('notes', notes.filter(n => n.id !== id))

  // Blockers
  const addBlocker = () => {
    if (!newBlocker.trim()) return
    update('blockers', [...blockers, { id: Date.now(), text: newBlocker.trim(), createdAt: new Date().toLocaleDateString('pt-PT'), resolved: false }], `🚧 Bloqueio: "${newBlocker.trim()}"`)
    setNewBlocker('')
  }
  const toggleBlocker = (id) => {
    const b = blockers.find(b => b.id === id)
    update('blockers', blockers.map(b => b.id === id ? { ...b, resolved: !b.resolved } : b), b.resolved ? `↩️ Bloqueio reaberto` : `✅ Bloqueio resolvido: "${b.text}"`)
  }
  const removeBlocker = (id) => update('blockers', blockers.filter(b => b.id !== id))

  // Diary
  const diary = project.diary || []
  const addDiaryEntry = () => {
    if (!newDiary.text.trim()) return
    update('diary', [...diary, { id: Date.now(), date: newDiary.date, text: newDiary.text.trim() }])
    setNewDiary({ date: new Date().toISOString().split('T')[0], text: '' })
    setShowDiaryForm(false)
  }
  const removeDiaryEntry = (id) => update('diary', diary.filter(d => d.id !== id))

  // Metrics
  const metrics = project.metrics || {}
  const updateMetric = (key, val) => update('metrics', { ...metrics, [key]: val })

  // Tags
  const addTag = () => {
    const t = newTag.trim().toLowerCase().replace(/\s+/g, '-')
    if (!t || tags.includes(t)) return
    update('tags', [...tags, t])
    setNewTag('')
  }

  // Subjects
  const toggleSubject = (key) => {
    const next = subjects.includes(key) ? subjects.filter(s => s !== key) : [...subjects, key]
    update('subjects', next)
  }

  const TABS = [
    { id: 'tasks',      label: '✅ Tarefas',   count: tasks.filter(t => !t.done).length },
    { id: 'milestones', label: '🚩 Milestones', count: ms.filter(m => !m.done).length },
    { id: 'timeline',   label: 'Timeline',      count: null, icon: <CalendarEmoji /> },
    { id: 'notes',      label: '📝 Notas',      count: notes.length },
    { id: 'blockers',   label: '🚧 Bloqueios',  count: blockers.filter(b => !b.resolved).length },
    { id: 'diary',      label: '📔 Diário',     count: null },
    { id: 'metrics',    label: '📊 Métricas',   count: null },
    { id: 'activity',   label: '📋 Atividade',  count: null },
  ]

  return (
    <div className="fade-in">
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', color: 'var(--gray-400)', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
        ← Todos os projetos
      </button>

      {/* Header card */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: 16, boxShadow: 'var(--shadow-sm)', borderTop: `4px solid ${color}` }}>

        {/* Emoji + color + name */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => { setShowEmojiPicker(v => !v); setShowColorPicker(false) }} style={{ fontSize: '2rem', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 12, padding: '8px 10px', cursor: 'pointer', lineHeight: 1 }}>
              {project.emoji || '📁'}
            </button>
            {showEmojiPicker && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 20, background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 10, boxShadow: 'var(--shadow-md)', display: 'flex', flexWrap: 'wrap', gap: 4, width: 220 }}>
                {EMOJIS.map(e => <button key={e} onClick={() => { update('emoji', e); setShowEmojiPicker(false) }} style={{ fontSize: '1.2rem', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6 }}>{e}</button>)}
              </div>
            )}
          </div>

          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => { setShowColorPicker(v => !v); setShowEmojiPicker(false) }} style={{ width: 36, height: 36, borderRadius: '50%', background: color, border: '3px solid var(--white)', boxShadow: '0 0 0 1.5px var(--gray-200)', cursor: 'pointer' }} title="Cor do projeto" />
            {showColorPicker && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 20, background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 10, boxShadow: 'var(--shadow-md)', display: 'flex', flexWrap: 'wrap', gap: 6, width: 160 }}>
                {COLORS.map(c => <button key={c.hex} onClick={() => { update('color', c.hex); setShowColorPicker(false) }} style={{ width: 26, height: 26, borderRadius: '50%', background: c.hex, border: color === c.hex ? '3px solid var(--gray-900)' : '2px solid transparent', cursor: 'pointer' }} />)}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {editingField === 'name' ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={inputStyle} autoFocus onKeyDown={e => { if (e.key === 'Enter') { update('name', editName, `✏️ Renomeado para "${editName}"`); setEditingField(null) }}} />
                <button className="btn btn-primary" onClick={() => { update('name', editName, `✏️ Renomeado para "${editName}"`); setEditingField(null) }}><Check size={13} /></button>
              </div>
            ) : (
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)', letterSpacing: -0.5, marginBottom: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setEditingField('name')}>
                {project.name} <Edit3 size={14} color="var(--gray-300)" />
              </h1>
            )}
            {editingField === 'desc' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)} style={inputStyle} placeholder="Descrição..." autoFocus onKeyDown={e => { if (e.key === 'Enter') { update('description', editDesc); setEditingField(null) }}} />
                <button className="btn btn-primary" onClick={() => { update('description', editDesc); setEditingField(null) }}><Check size={13} /></button>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-400)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, margin: 0 }} onClick={() => setEditingField('desc')}>
                {project.description || 'Adiciona uma descrição...'} <Edit3 size={11} color="var(--gray-300)" />
              </p>
            )}
          </div>
        </div>

        {/* Why */}
        <div style={{ background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>💡 Porquê este projeto?</p>
          {editingField === 'why' ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea value={editWhy} onChange={e => setEditWhy(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', flex: 1 }} autoFocus />
              <button className="btn btn-primary" onClick={() => { update('why', editWhy); setEditingField(null) }}><Check size={13} /></button>
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color, cursor: 'pointer', margin: 0, opacity: 0.85 }} onClick={() => setEditingField('why')}>
              {project.why || 'Clica para adicionar a tua motivação...'}
            </p>
          )}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <select value={project.status} onChange={e => update('status', e.target.value, `🔄 Status → "${STATUSES.find(s=>s.id===e.target.value)?.label}"`)} style={{ ...inputStyle, width: 'auto', padding: '5px 10px', background: status.bg, color: status.color, fontWeight: 700, fontSize: '0.78rem' }}>
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={project.type || ''} onChange={e => update('type', e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '5px 10px', fontSize: '0.78rem' }}>
            <option value="">Tipo...</option>
            {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <input type="date" value={project.startDate || ''} onChange={e => update('startDate', e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: '0.78rem' }} title="Início" />
          <input type="date" value={project.deadline || ''} onChange={e => update('deadline', e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: '0.78rem', color: days !== null && days <= 7 ? '#dc2626' : 'var(--gray-900)' }} title="Prazo" />
          {days !== null && (
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: days < 0 ? '#dc2626' : days <= 7 ? '#dc2626' : days <= 30 ? '#d97706' : '#16a34a' }}>
              {days < 0 ? `${Math.abs(days)}d em atraso` : days === 0 ? 'Hoje!' : `${days}d restantes`}
            </span>
          )}
        </div>

        {/* Subjects */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Disciplinas associadas</p>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {allSubjects.map(s => (
              <button key={s.key} onClick={() => toggleSubject(s.key)} style={{ padding: '4px 10px', borderRadius: 50, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${subjects.includes(s.key) ? color : 'var(--gray-200)'}`, background: subjects.includes(s.key) ? `${color}15` : 'var(--white)', color: subjects.includes(s.key) ? color : 'var(--gray-500)' }}>
                {s.emoji} {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Tags</p>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {tags.map(tag => (
              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: 50, background: `${color}15`, color }}>
                #{tag}
                <button onClick={() => update('tags', tags.filter(t => t !== tag))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color }}><X size={10} /></button>
              </span>
            ))}
            <div style={{ display: 'flex', gap: 4 }}>
              <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="nova tag..." style={{ ...inputStyle, width: 100, padding: '3px 8px', fontSize: '0.75rem' }} />
              <button className="btn btn-secondary" onClick={addTag} style={{ padding: '3px 8px' }}><Plus size={11} /></button>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: totalEstimated > 0 || hasHours ? 14 : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-500)' }}>
              Progresso {ms.length > 0 ? `— ${ms.filter(m=>m.done).length}/${ms.length} milestones` : `— ${tasks.filter(t=>t.done).length}/${tasks.length} tarefas`}
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: progress === 100 ? '#16a34a' : 'var(--gray-700)' }}>{progress}%</span>
          </div>
          <div style={{ background: 'var(--gray-100)', borderRadius: 50, height: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#22c55e' : color, borderRadius: 50, transition: 'width 0.4s' }} />
          </div>
        </div>

        {/* Hours */}
        {(totalEstimated > 0 || hasHours) && (
          <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
            {totalEstimated > 0 && (
              <div>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--gray-900)', letterSpacing: -0.5, margin: 0 }}>{totalEstimated.toFixed(1)}h</p>
                <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.4, margin: 0 }}>Estimado</p>
              </div>
            )}
            {hasHours && (
              <div>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color, letterSpacing: -0.5, margin: 0 }}>{realHours.toFixed(1)}h</p>
                <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.4, margin: 0 }}>Registadas</p>
              </div>
            )}
            {projectSessions.length > 0 && (
              <div>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--gray-500)', letterSpacing: -0.5, margin: 0 }}>{projectSessions.length}</p>
                <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.4, margin: 0 }}>Sessões</p>
              </div>
            )}
          </div>
        )}

        {/* Phase bar */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--gray-100)' }}>
          <PhaseBar project={project} color={color} onUpdate={onUpdate} />
        </div>

        {/* Next action */}
        {nextAction && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: `${color}10`, border: `1px solid ${color}25`, borderRadius: 10 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>→ Próxima ação</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--gray-700)', fontWeight: 600 }}>{nextAction.label}</span>
            {nextAction.dueDate && <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginLeft: 'auto', flexShrink: 0 }}>{new Date(nextAction.dueDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '7px 14px', borderRadius: 50, fontFamily: 'inherit', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap', border: `2px solid ${activeTab === t.id ? color : 'var(--gray-200)'}`, background: activeTab === t.id ? `${color}15` : 'var(--white)', color: activeTab === t.id ? color : 'var(--gray-500)' }}>
            {t.icon ? <>{t.icon} {t.label}</> : t.label}{t.count !== null && t.count > 0 ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* ── TASKS ── */}
      {activeTab === 'tasks' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Tarefas</span>
            <button className="btn btn-primary" onClick={() => setShowTaskForm(v => !v)} style={{ fontSize: '0.78rem', padding: '5px 12px' }}><Plus size={13} /> Tarefa</button>
          </div>
          <div className="card-body">
            {showTaskForm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)' }}>
                <input value={newTask.label} onChange={e => setNewTask({...newTask, label: e.target.value})} placeholder="Descrição da tarefa..." style={inputStyle} autoFocus onKeyDown={e => e.key === 'Enter' && addTask()} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})} style={{ ...inputStyle, width: 'auto' }}>
                    {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label} prioridade</option>)}
                  </select>
                  <input type="date" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} style={{ ...inputStyle, width: 'auto' }} title="Prazo" />
                  <input type="number" step="0.5" min="0" value={newTask.estimatedHours} onChange={e => setNewTask({...newTask, estimatedHours: e.target.value})} placeholder="horas estimadas" style={{ ...inputStyle, width: 130 }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={addTask} style={{ flex: 1, justifyContent: 'center' }}>Adicionar</button>
                  <button className="btn btn-secondary" onClick={() => setShowTaskForm(false)}>Cancelar</button>
                </div>
              </div>
            )}

            {tasks.filter(t => !t.done).map(task => {
              const pri = PRIORITIES.find(p => p.id === task.priority) || PRIORITIES[1]
              const td  = daysUntil(task.dueDate)
              return (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--gray-50)' }}>
                  <button onClick={() => toggleTask(task.id)} style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${color}`, background: 'var(--white)', cursor: 'pointer', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--gray-700)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.label}</p>
                    <div style={{ display: 'flex', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 50, background: pri.bg, color: pri.color }}>{pri.label}</span>
                      {task.dueDate && <span style={{ fontSize: '0.65rem', color: td !== null && td <= 0 ? '#dc2626' : 'var(--gray-400)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}><CalendarEmoji /> {td === 0 ? 'Hoje' : td < 0 ? `${Math.abs(td)}d atraso` : `${td}d`}</span>}
                      {task.estimatedHours && <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)', fontWeight: 600 }}>⏱ {task.estimatedHours}h</span>}
                    </div>
                  </div>
                  <button className="btn btn-ghost" onClick={() => removeTask(task.id)} style={{ padding: '4px 6px' }}><Trash2 size={12} /></button>
                </div>
              )
            })}

            {tasks.length === 0 && <div className="empty-state"><div className="e-emoji">✅</div><p>Sem tarefas. Adiciona a primeira!</p></div>}

            {tasks.filter(t => t.done).length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--gray-100)' }}>
                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Concluídas ({tasks.filter(t => t.done).length})</p>
                {tasks.filter(t => t.done).map(task => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--gray-50)' }}>
                    <button onClick={() => toggleTask(task.id)} style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#22c55e', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={11} color="white" />
                    </button>
                    <p style={{ fontSize: '0.82rem', color: 'var(--gray-400)', textDecoration: 'line-through', flex: 1, margin: 0 }}>{task.label}</p>
                    <button className="btn btn-ghost" onClick={() => removeTask(task.id)} style={{ padding: '4px 6px' }}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MILESTONES ── */}
      {activeTab === 'milestones' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Milestones</span>
            <button className="btn btn-primary" onClick={() => setShowMsForm(v => !v)} style={{ fontSize: '0.78rem', padding: '5px 12px' }}><Plus size={13} /> Milestone</button>
          </div>
          <div className="card-body">
            {showMsForm && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <input value={newMs.label} onChange={e => setNewMs({...newMs, label: e.target.value})} placeholder="Nome do milestone..." style={{ ...inputStyle, flex: 1 }} autoFocus />
                <input type="date" value={newMs.date} onChange={e => setNewMs({...newMs, date: e.target.value})} style={{ ...inputStyle, width: 'auto' }} />
                <button className="btn btn-primary" onClick={addMs}>Adicionar</button>
                <button className="btn btn-secondary" onClick={() => setShowMsForm(false)}>Cancelar</button>
              </div>
            )}
            {ms.length === 0 && <div className="empty-state"><div className="e-emoji">🚩</div><p>Sem milestones ainda.</p></div>}
            {[...ms].sort((a,b) => new Date(a.date)-new Date(b.date)).map(m => {
              const md = daysUntil(m.date)
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--gray-50)' }}>
                  <button onClick={() => toggleMs(m.id)} style={{ width: 20, height: 20, borderRadius: '50%', border: m.done ? 'none' : `2px solid ${color}`, background: m.done ? '#22c55e' : 'var(--white)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {m.done && <Check size={11} color="white" />}
                  </button>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: m.done ? 'var(--gray-400)' : 'var(--gray-800)', textDecoration: m.done ? 'line-through' : 'none', margin: 0 }}>{m.label}</p>
                    {m.date && <p style={{ fontSize: '0.72rem', color: md !== null && md < 0 && !m.done ? '#dc2626' : 'var(--gray-400)', fontWeight: 600, margin: 0 }}>
                      {new Date(m.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
                      {md !== null && !m.done && ` · ${md < 0 ? `${Math.abs(md)}d em atraso` : md === 0 ? 'Hoje' : `${md}d`}`}
                    </p>}
                  </div>
                  <button className="btn btn-ghost" onClick={() => removeMs(m.id)} style={{ padding: '4px 6px' }}><Trash2 size={12} /></button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TIMELINE ── */}
      {activeTab === 'timeline' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Timeline</span></div>
          <div className="card-body">
            <Timeline milestones={ms} startDate={project.startDate} deadline={project.deadline} />
          </div>
        </div>
      )}

      {/* ── NOTES ── */}
      {activeTab === 'notes' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Notas & Reflexões</span>
            <button className="btn btn-primary" onClick={() => setShowNoteForm(v => !v)} style={{ fontSize: '0.78rem', padding: '5px 12px' }}><Plus size={13} /> Nota</button>
          </div>
          <div className="card-body">
            {showNoteForm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)' }}>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {NOTE_TYPES.map(t => (
                    <button key={t.id} onClick={() => setNewNote({...newNote, type: t.id})} style={{ padding: '4px 10px', borderRadius: 50, fontFamily: 'inherit', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', border: `1.5px solid ${newNote.type === t.id ? color : 'var(--gray-200)'}`, background: newNote.type === t.id ? `${color}15` : 'var(--white)', color: newNote.type === t.id ? color : 'var(--gray-500)' }}>
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
                <textarea value={newNote.text} onChange={e => setNewNote({...newNote, text: e.target.value})} rows={3} placeholder="Escreve aqui..." style={{ ...inputStyle, resize: 'vertical' }} autoFocus />
                {newNote.type === 'link' && <input value={newNote.url} onChange={e => setNewNote({...newNote, url: e.target.value})} placeholder="URL..." style={inputStyle} />}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={addNote}>Guardar</button>
                  <button className="btn btn-secondary" onClick={() => setShowNoteForm(false)}>Cancelar</button>
                </div>
              </div>
            )}
            {notes.length === 0 && <div className="empty-state"><div className="e-emoji">📝</div><p>Sem notas ainda.</p></div>}
            {notes.map(n => {
              const nt = NOTE_TYPES.find(t => t.id === n.type) || NOTE_TYPES[0]
              return (
                <div key={n.id} style={{ padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-100)', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-400)' }}>{nt.emoji} {nt.label} · {n.createdAt}</span>
                    <button className="btn btn-ghost" onClick={() => removeNote(n.id)} style={{ padding: '2px 5px' }}><Trash2 size={11} /></button>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray-700)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{n.text}</p>
                  {n.url && <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color, marginTop: 4, display: 'block' }}>{n.url}</a>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── BLOCKERS ── */}
      {activeTab === 'blockers' && (
        <div className="card">
          <div className="card-header"><span className="card-title">🚧 Bloqueios</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input value={newBlocker} onChange={e => setNewBlocker(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBlocker()} placeholder="O que está a bloquear o progresso?" style={inputStyle} />
              <button className="btn btn-primary" onClick={addBlocker}><Plus size={14} /></button>
            </div>
            {blockers.length === 0 && <div className="empty-state"><div className="e-emoji">🚧</div><p>Nenhum bloqueio registado.</p></div>}
            {blockers.filter(b => !b.resolved).map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 'var(--radius-sm)', marginBottom: 6 }}>
                <button onClick={() => toggleBlocker(b.id)} style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #f59e0b', background: 'var(--white)', cursor: 'pointer', flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 500, margin: 0 }}>{b.text}</p>
                  <p style={{ fontSize: '0.68rem', color: '#b45309', margin: 0 }}>{b.createdAt}</p>
                </div>
                <button className="btn btn-ghost" onClick={() => removeBlocker(b.id)} style={{ padding: '2px 5px' }}><Trash2 size={11} /></button>
              </div>
            ))}
            {blockers.filter(b => b.resolved).length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--gray-100)' }}>
                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Resolvidos</p>
                {blockers.filter(b => b.resolved).map(b => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-50)' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#22c55e', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={10} color="white" />
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--gray-400)', textDecoration: 'line-through', flex: 1, margin: 0 }}>{b.text}</p>
                    <button className="btn btn-ghost" onClick={() => removeBlocker(b.id)} style={{ padding: '2px 5px' }}><Trash2 size={11} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DIARY ── */}
      {activeTab === 'diary' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Diário de bordo</span>
            <button className="btn btn-primary" onClick={() => setShowDiaryForm(v => !v)} style={{ fontSize: '0.78rem', padding: '5px 12px' }}><Plus size={13} /> Entrada</button>
          </div>
          <div className="card-body">
            {showDiaryForm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)' }}>
                <input type="date" value={newDiary.date} onChange={e => setNewDiary(d => ({ ...d, date: e.target.value }))} style={inputStyle} />
                <textarea value={newDiary.text} onChange={e => setNewDiary(d => ({ ...d, text: e.target.value }))} rows={4} placeholder="O que aconteceu? Que progresso fizeste? Que decisões tomaste?" style={{ ...inputStyle, resize: 'vertical' }} autoFocus />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={addDiaryEntry} style={{ flex: 1, justifyContent: 'center' }}>Guardar</button>
                  <button className="btn btn-secondary" onClick={() => setShowDiaryForm(false)}>Cancelar</button>
                </div>
              </div>
            )}
            {diary.length === 0 && <div className="empty-state"><div className="e-emoji">📔</div><p>Sem entradas ainda. Regista o teu progresso!</p></div>}
            {[...diary].reverse().map(entry => (
              <div key={entry.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--gray-50)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: color }}>
                    {new Date(entry.date).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                  <button className="btn btn-ghost" onClick={() => removeDiaryEntry(entry.id)} style={{ padding: '2px 5px' }}><Trash2 size={11} /></button>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-700)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{entry.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── METRICS ── */}
      {activeTab === 'metrics' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Métricas</span></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { key: 'words',  label: 'Palavras escritas', emoji: '✍️', show: ['Manuscrito/Livro', 'Blog/Newsletter', 'Investigação'] },
                { key: 'refs',   label: 'Referências',       emoji: '📚', show: ['Investigação', 'Projeto académico'] },
                { key: 'hours',  label: 'Horas registadas',  emoji: '⏱️', show: null },
                { key: 'custom', label: 'Métrica personalizada', emoji: '📌', show: null },
              ].filter(m => m.show === null || m.show.includes(project.type)).map(m => (
                <div key={m.key} style={{ background: 'var(--gray-50)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--gray-100)' }}>
                  <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{m.emoji} {m.label}</p>
                  <input type="number" min="0" value={metrics[m.key] || ''} onChange={e => updateMetric(m.key, parseFloat(e.target.value) || 0)} placeholder="0" style={{ ...inputStyle, fontSize: '1.4rem', fontWeight: 800, color, padding: '4px 0', border: 'none', background: 'transparent', outline: 'none' }} />
                </div>
              ))}
            </div>
            {(project.type === 'Manuscrito/Livro') && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-500)' }}>Progresso do manuscrito</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color }}>
                    {(metrics.words || 0).toLocaleString('pt-PT')} / {(metrics.targetWords || 80000).toLocaleString('pt-PT')} palavras
                  </span>
                </div>
                <div style={{ background: 'var(--gray-100)', borderRadius: 50, height: 8, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', width: `${Math.min(100, Math.round((metrics.words || 0) / (metrics.targetWords || 80000) * 100))}%`, background: color, borderRadius: 50, transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>Meta:</span>
                  <input type="number" min="1000" step="1000" value={metrics.targetWords || 80000} onChange={e => updateMetric('targetWords', parseInt(e.target.value) || 80000)} style={{ ...inputStyle, width: 120, padding: '3px 8px', fontSize: '0.8rem' }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>palavras</span>
                </div>
              </div>
            )}
            {hasHours && (
              <div style={{ padding: '12px 14px', background: `${color}10`, borderRadius: 10, border: `1px solid ${color}20` }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>⏱️ Horas de estudo registadas</p>
                <p style={{ fontSize: '1.6rem', fontWeight: 800, color, margin: 0 }}>{realHours.toFixed(1)}h</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', margin: 0 }}>
                  {projectSessions.length > 0 ? `${projectSessions.length} sess. ligadas · ` : ''}{subjects.length > 0 ? 'nas disciplinas associadas' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ACTIVITY ── */}
      {activeTab === 'activity' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Histórico de Atividade</span></div>
          <div className="card-body">
            {(project.activityLog || []).length === 0 && <div className="empty-state"><div className="e-emoji">📋</div><p>Sem atividade registada ainda.</p></div>}
            {[...(project.activityLog || [])].reverse().map(entry => (
              <div key={entry.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-50)', alignItems: 'flex-start' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 6 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--gray-700)', margin: 0 }}>{entry.text}</p>
                  <p style={{ fontSize: '0.68rem', color: 'var(--gray-400)', margin: 0 }}>{entry.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProjectsPage({ settings }) {
  const allSubjects = settings?.subjects || []
  const [projects, setProjects]           = useState(loadProjects)
  const [selected, setSelected]           = useState(null)
  const allSessions = loadSessions()
  const [showForm, setShowForm]           = useState(false)
  const [filterTag, setFilterTag]         = useState(null)
  const [collapsedGroups, setCollapsedGroups] = useState({ paused: true, completed: true })
  const [newProject, setNewProject]       = useState({ name: '', emoji: '🚀', color: COLORS[0].hex, type: '', description: '' })

  useEffect(() => saveProjects(projects), [projects])

  const selectedProject = projects.find(p => p.id === selected)

  const updateProject = (updated) => setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))

  const addProject = () => {
    if (!newProject.name.trim()) return
    const p = { id: Date.now(), ...newProject, name: newProject.name.trim(), status: 'active', tasks: [], milestones: [], notes: [], blockers: [], activityLog: [], tags: [], subjects: [], diary: [], phase: 0, metrics: {} }
    setProjects(prev => [p, ...prev])
    setShowForm(false)
    setNewProject({ name: '', emoji: '🚀', color: COLORS[0].hex, type: '', description: '' })
    setSelected(p.id)
  }

  const deleteProject = (id) => {
    if (!window.confirm('Apagar projeto? Esta ação não pode ser desfeita.')) return
    setProjects(prev => prev.filter(p => p.id !== id))
    if (selected === id) setSelected(null)
  }

  const allTags  = [...new Set(projects.flatMap(p => p.tags || []))]
  const filtered = filterTag ? projects.filter(p => (p.tags || []).includes(filterTag)) : projects
  const grouped  = { active: filtered.filter(p => p.status === 'active'), paused: filtered.filter(p => p.status === 'paused'), completed: filtered.filter(p => p.status === 'completed') }

  const inputStyle = { fontFamily: 'inherit', fontSize: '0.85rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', padding: '7px 10px', outline: 'none', background: 'var(--white)', color: 'var(--gray-900)', width: '100%' }

  if (selectedProject) return <ProjectDetail project={selectedProject} onUpdate={updateProject} onBack={() => setSelected(null)} allSubjects={allSubjects} />

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1>🗂 Projetos</h1>
          <p className="subtitle">{projects.filter(p=>p.status==='active').length} em curso · {projects.filter(p=>p.status==='completed').length} concluídos</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={14} /> Novo projeto</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <span className="card-title">Novo projeto</span>
            <button className="btn btn-ghost btn" onClick={() => setShowForm(false)}><X size={14} /></button>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={newProject.emoji} onChange={e => setNewProject({...newProject, emoji: e.target.value})} style={{ ...inputStyle, width: 'auto', fontSize: '1.1rem', padding: '5px 8px' }}>
                {EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 4 }}>
                {COLORS.map(c => <button key={c.hex} onClick={() => setNewProject({...newProject, color: c.hex})} style={{ width: 22, height: 22, borderRadius: '50%', background: c.hex, border: newProject.color === c.hex ? '3px solid var(--gray-900)' : '2px solid transparent', cursor: 'pointer' }} />)}
              </div>
              <input value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder="Nome do projeto" style={{ ...inputStyle, flex: 1 }} autoFocus onKeyDown={e => e.key === 'Enter' && addProject()} />
            </div>
            <input value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} placeholder="Descrição breve (opcional)" style={inputStyle} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addProject} disabled={!newProject.name.trim()}>Criar projeto</button>
            </div>
          </div>
        </div>
      )}

      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
          {[null, ...allTags].map(tag => (
            <button key={tag ?? '__all'} onClick={() => setFilterTag(tag)} style={{ padding: '4px 10px', borderRadius: 50, fontFamily: 'inherit', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', border: `1.5px solid ${filterTag === tag ? 'var(--gray-900)' : 'var(--gray-200)'}`, background: filterTag === tag ? 'var(--gray-900)' : 'var(--white)', color: filterTag === tag ? 'var(--white)' : 'var(--gray-500)' }}>
              {tag === null ? 'Todos' : `#${tag}`}
            </button>
          ))}
        </div>
      )}

      {projects.length === 0 && (
        <div className="card"><div className="empty-state">
          <div className="e-emoji">🗂</div>
          <p style={{ fontWeight: 700, color: 'var(--gray-700)', marginBottom: 4 }}>Ainda sem projetos</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginBottom: 12 }}>Cria um projeto para acompanhar trabalhos, dissertações ou qualquer projeto académico</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={14} /> Criar primeiro projeto</button>
        </div></div>
      )}

      {(['active', 'paused', 'completed']).map(groupId => {
        const group = grouped[groupId]
        if (!group.length) return null
        const labels = { active: 'Em curso', paused: 'Pausados', completed: 'Concluídos' }
        const collapsed = collapsedGroups[groupId]
        return (
          <div key={groupId} style={{ marginBottom: 20 }}>
            <button onClick={() => groupId !== 'active' && setCollapsedGroups(prev => ({...prev, [groupId]: !prev[groupId]}))} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: groupId !== 'active' ? 'pointer' : 'default', fontFamily: 'inherit', marginBottom: 10, padding: 0 }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 1 }}>{labels[groupId]} ({group.length})</span>
              {groupId !== 'active' && (collapsed ? <ChevronDown size={13} color="var(--gray-400)" /> : <ChevronUp size={13} color="var(--gray-400)" />)}
            </button>
            {!collapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.map(p => <ProjectCard key={p.id} project={p} onClick={() => setSelected(p.id)} onDelete={deleteProject} allSubjects={allSubjects} sessions={allSessions} />)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
