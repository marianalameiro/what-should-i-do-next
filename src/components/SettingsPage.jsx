import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { smartEmoji } from './CalendarEmoji'

const COLORS = [
  { color: '#f9a8d4', textColor: '#9d174d' },
  { color: '#c4b5fd', textColor: '#5b21b6' },
  { color: '#fdba74', textColor: '#92400e' },
  { color: '#86efac', textColor: '#14532d' },
  { color: '#93c5fd', textColor: '#1e3a8a' },
  { color: '#fde68a', textColor: '#92400e' },
  { color: '#a5f3fc', textColor: '#164e63' },
  { color: '#d9f99d', textColor: '#365314' },
]
const EMOJIS   = ['📚','🧠','🧬','📐','🎨','💻','🔬','📝','🎯','🌍','💡','🎵','⚡','🌱','🏛️','🔭']
const DAY_NAMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

const ACCENT_COLORS = [
  { name: 'Rosa',    h: 340, s: '52%', l: '56%' },
  { name: 'Roxo',   h: 265, s: '60%', l: '55%' },
  { name: 'Azul',   h: 210, s: '70%', l: '50%' },
  { name: 'Verde',  h: 150, s: '55%', l: '42%' },
  { name: 'Laranja',h: 25,  s: '80%', l: '52%' },
  { name: 'Teal',   h: 180, s: '55%', l: '42%' },
  { name: 'Coral',  h: 10,  s: '75%', l: '58%' },
]

function applyAccent(h, s, l) {
  document.documentElement.style.setProperty('--accent-h', h)
  document.documentElement.style.setProperty('--accent-s', s)
  document.documentElement.style.setProperty('--accent-l', l)
}
const USER_TYPES = [
  { id: 'student',      label: 'Estudante universitário', emoji: '🎓' },
  { id: 'selftaught',   label: 'Autodidata',              emoji: '📖' },
  { id: 'professional', label: 'Profissional',            emoji: '💼' },
  { id: 'other',        label: 'Outro',                   emoji: '✨' },
]

export default function SettingsPage({ settings, setSettings }) {
  const [section, setSection]         = useState('profile')
  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [editingSubject, setEditingSubject]   = useState(null)
  const [newSubject, setNewSubject]    = useState({ name: '', emoji: '📚', color: COLORS[0].color, textColor: COLORS[0].textColor, methods: '' })

  const update = (key, val) => setSettings(p => ({ ...p, [key]: val }))

  const addSubject = () => {
    if (!newSubject.name.trim()) return
    const key = newSubject.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now()
    const methods = newSubject.methods.split('\n').map(m => m.trim()).filter(Boolean)
    update('subjects', [...settings.subjects, { key, name: newSubject.name.trim(), emoji: newSubject.emoji, color: newSubject.color, textColor: newSubject.textColor, methods }])
    setNewSubject({ name: '', emoji: '📚', color: COLORS[0].color, textColor: COLORS[0].textColor, methods: '' })
    setShowSubjectForm(false)
  }

  const updateSubjectMethods = (key, methodsText) => {
    const methods = methodsText.split('\n').map(m => m.trim()).filter(Boolean)
    update('subjects', settings.subjects.map(s => s.key === key ? { ...s, methods } : s))
  }

  const toggleSchedule = (day, subjectKey) => {
    const current = settings.schedule[day] || []
    const next    = current.includes(subjectKey) ? current.filter(k => k !== subjectKey) : [...current, subjectKey]
    update('schedule', { ...settings.schedule, [day]: next })
  }

  const [subjectTargets, setSubjectTargets] = useState(() => { try { return JSON.parse(localStorage.getItem('subject-targets')) || {} } catch { return {} } })
  const saveSubjectTargets = (updated) => { setSubjectTargets(updated); localStorage.setItem('subject-targets', JSON.stringify(updated)) }
  const getTarget = (key) => {
    const val = subjectTargets[key]
    const num = parseFloat(val)
    if (val !== undefined && val !== '' && !isNaN(num) && num > 0) return num
    return settings.hoursGoal / Math.max(1, settings.subjects?.length || 1)
  }

  const [links, setLinksState] = useState(() => { try { return JSON.parse(localStorage.getItem('quick-links')) || [] } catch { return [] } })
  const [newLink, setNewLink] = useState({ label: '', url: '', emoji: '🔗' })
  const saveLinks = (updated) => { setLinksState(updated); localStorage.setItem('quick-links', JSON.stringify(updated)) }

  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem('groq-key') || '')

  const saveApiKey = (val) => {
    setApiKeyState(val)
    localStorage.setItem('groq-key', val)
  }

  const exportData = () => {
    const staticKeys = [
      'study-sessions', 'exams', 'projects-v2', 'diary-entries',
      'weekly-reviews', 'subject-targets', 'user-settings',
      'calendar-events', 'extra-tasks', 'eisenhower-overrides',
      'energy-levels', 'gcal-config', 'gcal-events', 'groq-key',
    ]
    const data = {}
    staticKeys.forEach(k => {
      const raw = localStorage.getItem(k)
      if (raw !== null) data[k] = k === 'groq-key' ? raw : JSON.parse(raw)
    })
    // include per-day task completion (tasks-Mon Mar 21 2026 …)
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k.startsWith('tasks-')) {
        try { data[k] = JSON.parse(localStorage.getItem(k)) } catch {}
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wsidnx-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (typeof data !== 'object' || Array.isArray(data) || data === null)
          throw new Error('Estrutura inválida')
        const ALLOWED_KEYS = new Set([
          'study-sessions','exams','topics','exam-schedule','extra-tasks',
          'diary-entries','weekly-reviews','projects-v2','household-tasks',
          'subject-targets','eisenhower-overrides','energy-levels','show-matrix',
          'groq-key','user-settings','calendar-events','gcal-events',
          'quick-links','schedule-blocks','daily-study-targets',
        ])
        Object.entries(data).forEach(([key, value]) => {
          const allowed = ALLOWED_KEYS.has(key)
            || key.startsWith('schedule-blocks-')
            || key.startsWith('tasks-')
            || key.startsWith('schedule-done-')
            || key.startsWith('schedule-snoozed-')
          if (!allowed) return
          if (value === null || value === undefined) return
          if (key === 'groq-key') localStorage.setItem(key, String(value))
          else localStorage.setItem(key, JSON.stringify(value))
        })
        window.alert('Dados importados! A app vai recarregar.')
        window.location.reload()
      } catch {
        window.alert('Ficheiro inválido.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const removeSubject = (key) => {
    if (!window.confirm(`Remover cadeira? Esta ação não pode ser desfeita.`)) return
    update('subjects', settings.subjects.filter(s => s.key !== key))
    const newSchedule = {}
    Object.entries(settings.schedule).forEach(([day, keys]) => {
      newSchedule[day] = keys.filter(k => k !== key)
    })
    update('schedule', newSchedule)
  }

  const SECTIONS = [
    { id: 'profile',    label: 'Perfil',        emoji: '👤' },
    { id: 'subjects',   label: 'Cadeiras',      emoji: '📚' },
    { id: 'schedule',   label: 'Plano diário',  emoji: '📅' },
    { id: 'goals',      label: 'Metas',         emoji: '🎯' },
    { id: 'links',      label: 'Links rápidos', emoji: '🔗' },
    { id: 'appearance', label: 'Aparência',      emoji: '✨' },
    { id: 'accent',     label: 'Cor de acento', emoji: '🎨' },
    { id: 'data',       label: 'Dados & API',   emoji: '🔧' },
  ]

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>⚙️ Definições</h1>
        <p className="subtitle">Personaliza a app ao teu gosto</p>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            padding: '7px 14px', borderRadius: 50, fontFamily: 'inherit', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
            border: `2px solid ${section === s.id ? 'var(--rose-400)' : 'var(--gray-200)'}`,
            background: section === s.id ? 'var(--rose-50)' : 'var(--white)',
            color: section === s.id ? 'var(--rose-400)' : 'var(--gray-500)',
          }}>{smartEmoji(s.emoji)} {s.label}</button>
        ))}
      </div>

      {/* ── PROFILE ── */}
      {section === 'profile' && (
        <div className="card">
          <div className="card-body">
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>O teu nome</label>
              <input type="text" style={inputStyle} value={settings.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Tipo de utilizador</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {USER_TYPES.map(t => (
                  <button key={t.id} onClick={() => update('userType', t.id)} style={{
                    padding: '10px 14px', borderRadius: 'var(--radius)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    border: `2px solid ${settings.userType === t.id ? 'var(--rose-400)' : 'var(--gray-200)'}`,
                    background: settings.userType === t.id ? 'var(--rose-50)' : 'var(--white)',
                  }}>
                    <span style={{ fontSize: '1rem', marginRight: 8 }}>{t.emoji}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: settings.userType === t.id ? 'var(--rose-400)' : 'var(--gray-700)' }}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBJECTS ── */}
      {section === 'subjects' && (
        <div>
          {settings.subjects.map(s => (
            <div key={s.key} style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderLeft: `4px solid ${s.color}` }}>
                <span style={{ fontSize: '1.2rem' }}>{s.emoji}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: '0.88rem', color: s.textColor }}>{s.name}</p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{s.methods?.length || 0} métodos</p>
                </div>
                <button onClick={() => setEditingSubject(editingSubject === s.key ? null : s.key)} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--rose-400)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {editingSubject === s.key ? 'Fechar' : 'Editar'}
                </button>
                <button className="btn btn-ghost" onClick={() => removeSubject(s.key)}><Trash2 size={13} /></button>
              </div>
              {editingSubject === s.key && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}>
                  <label style={labelStyle}>Métodos de estudo (um por linha)</label>
                  <textarea
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    value={(s.methods || []).join('\n')}
                    onChange={e => updateSubjectMethods(s.key, e.target.value)}
                    placeholder={'Ex:\nLer o capítulo\nFazer resumo\nPraticar exercícios'}
                  />
                </div>
              )}
            </div>
          ))}

          {showSubjectForm ? (
            <div style={{ background: 'var(--gray-50)', border: '1px dashed var(--gray-200)', borderRadius: 'var(--radius)', padding: 16 }}>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Nome</label>
                <input type="text" style={inputStyle} placeholder="Ex: Matemática, Python..." value={newSubject.name} onChange={e => setNewSubject(p => ({ ...p, name: e.target.value }))} autoFocus />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Emoji</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => setNewSubject(p => ({ ...p, emoji: e }))} style={{ width: 32, height: 32, borderRadius: 6, border: `2px solid ${newSubject.emoji === e ? 'var(--rose-400)' : 'var(--gray-200)'}`, background: newSubject.emoji === e ? 'var(--rose-50)' : 'var(--white)', cursor: 'pointer', fontSize: '0.95rem' }}>{e}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Cor</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {COLORS.map(c => (
                    <button key={c.color} onClick={() => setNewSubject(p => ({ ...p, color: c.color, textColor: c.textColor }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c.color, border: `3px solid ${newSubject.color === c.color ? 'var(--gray-800)' : 'transparent'}`, cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Métodos de estudo (um por linha)</label>
                <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder={'Ex:\nLer o capítulo\nFazer resumo'} value={newSubject.methods} onChange={e => setNewSubject(p => ({ ...p, methods: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={addSubject}><Plus size={13} /> Adicionar</button>
                <button className="btn btn-ghost" onClick={() => setShowSubjectForm(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={() => setShowSubjectForm(true)} style={{ width: '100%', justifyContent: 'center' }}>
              <Plus size={14} /> Adicionar cadeira
            </button>
          )}
        </div>
      )}

      {/* ── SCHEDULE ── */}
      {section === 'schedule' && (
        <div className="card">
          <div className="card-body">
            <p style={{ fontSize: '0.83rem', color: 'var(--gray-500)', marginBottom: 16 }}>Define o que estudas em cada dia da semana. Isto gera as tarefas automaticamente.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[1,2,3,4,5,6,0].map(day => (
                <div key={day}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-600)', marginBottom: 6 }}>{DAY_NAMES[day]}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {settings.subjects.map(s => {
                      const active = (settings.schedule[day] || []).includes(s.key)
                      return (
                        <button key={s.key} onClick={() => toggleSchedule(day, s.key)} style={{
                          padding: '5px 12px', borderRadius: 50, fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                          border: `2px solid ${active ? s.color : 'var(--gray-200)'}`,
                          background: active ? s.color + '30' : 'var(--white)',
                          color: active ? s.textColor : 'var(--gray-400)',
                        }}>{s.emoji} {s.name}</button>
                      )
                    })}
                    {settings.subjects.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>Adiciona cadeiras primeiro</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── GOALS ── */}
      {section === 'goals' && (() => {
        const today = new Date(); today.setHours(0,0,0,0)
        const start = settings.periodStart ? new Date(settings.periodStart) : null
        const end   = settings.periodEnd   ? new Date(settings.periodEnd)   : null
        const totalDays     = start && end ? Math.round((end - start) / 86400000) : null
        const daysElapsed   = start ? Math.max(0, Math.round((today - start) / 86400000)) : null
        const daysRemaining = end   ? Math.max(0, Math.round((end - today) / 86400000)) : null
        const weeksRemaining = daysRemaining ? Math.max(1, daysRemaining / 7) : 1
        const periodPct = totalDays && daysElapsed !== null ? Math.min(100, Math.round(daysElapsed / totalDays * 100)) : 0
        const totalHours = (() => { try { return (JSON.parse(localStorage.getItem('study-sessions')) || []).reduce((a,b) => a + b.hours, 0) } catch { return 0 } })()
        const hoursPct = settings.hoursGoal > 0 ? Math.min(100, Math.round(totalHours / settings.hoursGoal * 100)) : 0
        const totalTarget = settings.subjects?.reduce((a, s) => a + getTarget(s.key), 0) || 0

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Period */}
            <div className="card">
              <div className="card-body">
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 5 }}>{smartEmoji('📅')} Período letivo</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={labelStyle}>Início</label>
                    <input type="date" style={inputStyle} value={settings.periodStart || ''} onChange={e => update('periodStart', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Fim</label>
                    <input type="date" style={inputStyle} value={settings.periodEnd || ''} onChange={e => update('periodEnd', e.target.value)} />
                  </div>
                </div>
                {totalDays && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-600)', marginBottom: 6 }}>
                      <span>{daysElapsed}d passados</span>
                      <span style={{ color: 'var(--rose-400)' }}>{daysRemaining}d restantes · {weeksRemaining.toFixed(1)} semanas</span>
                    </div>
                    <div className="progress-wrap" style={{ height: 8 }}>
                      <div className="progress-fill" style={{ width: `${periodPct}%`, height: '100%', background: 'var(--rose-300)' }} />
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 5 }}>{periodPct}% do semestre concluído</p>
                  </>
                )}
              </div>
            </div>

            {/* Wake / sleep times */}
            <div className="card">
              <div className="card-body">
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 }}>🌅 Horário do dia (Horário)</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Acordar às</label>
                    <input type="time" style={inputStyle} value={settings.wakeTime || '08:00'} onChange={e => update('wakeTime', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Dormir às</label>
                    <input type="time" style={inputStyle} value={settings.sleepTime || '23:00'} onChange={e => update('sleepTime', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Total hours goal */}
            <div className="card">
              <div className="card-body">
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 }}>⏱️ Meta global de horas</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--gray-900)', letterSpacing: -1 }}>{settings.hoursGoal}</span>
                  <span style={{ fontSize: '0.88rem', color: 'var(--gray-400)', fontWeight: 600 }}>horas no semestre</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 700, color: hoursPct >= 80 ? 'var(--green-500)' : 'var(--rose-400)' }}>
                    {totalHours.toFixed(1)}h feitas ({hoursPct}%)
                  </span>
                </div>
                <input type="range" min="10" max="600" step="5" value={settings.hoursGoal}
                  onChange={e => update('hoursGoal', parseInt(e.target.value))}
                  style={{ width: '100%', marginBottom: 4, accentColor: 'var(--rose-400)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--gray-400)' }}>
                  <span>10h</span>
                  <span style={{ color: 'var(--gray-500)', fontWeight: 600 }}>~{(settings.hoursGoal / weeksRemaining).toFixed(1)}h/semana necessárias</span>
                  <span>600h</span>
                </div>
              </div>
            </div>

            {/* Per-subject targets */}
            {settings.subjects?.length > 0 && (
              <div className="card">
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.4 }}>📚 Metas por cadeira</p>
                    <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>Total: {totalTarget.toFixed(0)}h</span>
                  </div>
                  {settings.subjects.map(s => {
                    const target = getTarget(s.key)
                    const weeklyNeeded = (target / weeksRemaining).toFixed(1)
                    const done = (() => { try { return (JSON.parse(localStorage.getItem('study-sessions')) || []).filter(x => x.subject === s.key).reduce((a,b) => a + b.hours, 0) } catch { return 0 } })()
                    const pct = Math.min(100, target > 0 ? Math.round(done / target * 100) : 0)
                    return (
                      <div key={s.key} style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: '1.1rem' }}>{s.emoji}</span>
                          <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 700, color: 'var(--gray-800)' }}>{s.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <input
                              type="number" min="0" max="600" step="5"
                              value={subjectTargets[s.key] !== undefined ? subjectTargets[s.key] : Math.round(target)}
                              onChange={e => {
                                const val = parseFloat(e.target.value)
                                const updated = { ...subjectTargets, [s.key]: isNaN(val) ? e.target.value : val }
                                saveSubjectTargets(updated)
                              }}
                              style={{ width: 70, fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 700, border: '1.5px solid var(--gray-200)', borderRadius: 8, padding: '5px 8px', outline: 'none', background: 'var(--white)', color: 'var(--gray-900)', textAlign: 'center' }}
                              onFocus={e => e.target.style.borderColor = 'var(--rose-300)'}
                              onBlur={e => e.target.style.borderColor = 'var(--gray-200)'}
                            />
                            <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)', fontWeight: 600 }}>h</span>
                          </div>
                        </div>
                        <div className="progress-wrap" style={{ height: 6 }}>
                          <div className="progress-fill" style={{ width: `${pct}%`, height: '100%', background: s.color || 'var(--rose-300)' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--gray-400)', marginTop: 3 }}>
                          <span>{done.toFixed(1)}h feitas de {target.toFixed(0)}h ({pct}%)</span>
                          <span>~{weeklyNeeded}h/semana</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })()}


      {/* ── LINKS ── */}
      {section === 'links' && (
        <div>
          {links.map((link, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', marginBottom: 8 }}>
              <span style={{ fontSize: '1.1rem' }}>{link.emoji}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gray-800)', margin: 0 }}>{link.label}</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', margin: 0 }}>{link.url}</p>
              </div>
              <button className="btn btn-ghost" onClick={() => saveLinks(links.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
            </div>
          ))}
          <div style={{ background: 'var(--gray-50)', border: '1px dashed var(--gray-200)', borderRadius: 'var(--radius)', padding: 16, marginTop: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 10, marginBottom: 10, alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Emoji</label>
                <input type="text" style={{ ...inputStyle, width: 56, textAlign: 'center' }} maxLength={2} value={newLink.emoji} onChange={e => setNewLink(p => ({ ...p, emoji: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Nome</label>
                <input type="text" style={inputStyle} placeholder="Ex: Moodle" value={newLink.label} onChange={e => setNewLink(p => ({ ...p, label: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>URL</label>
                <input type="url" style={inputStyle} placeholder="https://..." value={newLink.url} onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => {
              if (!newLink.label.trim() || !newLink.url.trim()) return
              saveLinks([...links, { ...newLink }])
              setNewLink({ label: '', url: '', emoji: '🔗' })
            }}><Plus size={13} /> Adicionar link</button>
          </div>
        </div>
      )}

      {/* ── DATA & API ── */}
      {section === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-body">
              <label style={labelStyle}>Chave API Groq (Weekly Review + Auto-agendamento com IA)</label>
              <input
                type="password"
                style={inputStyle}
                placeholder="gsk_..."
                value={apiKey}
                onChange={e => saveApiKey(e.target.value)}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 6 }}>
                Guardada localmente. Usada para reviews automáticas e auto-agendamento inteligente.
              </p>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <p style={{ fontSize: '0.83rem', color: 'var(--gray-600)', fontWeight: 600, marginBottom: 6 }}>Exportar dados</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginBottom: 12 }}>
                Descarrega uma cópia de todos os teus dados (sessões, exames, projetos, diário).
              </p>
              <button className="btn btn-secondary" onClick={exportData}>
                💾 Exportar JSON
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <p style={{ fontSize: '0.83rem', color: 'var(--gray-600)', fontWeight: 600, marginBottom: 6 }}>Importar dados</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginBottom: 12 }}>
                Restaura um backup exportado anteriormente. Os dados existentes serão substituídos.
              </p>
              <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                📂 Importar JSON
                <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ── ACCENT COLOR ── */}
      {section === 'accent' && (
        <div className="card">
          <div className="card-body">
            <p style={{ fontSize: '0.83rem', color: 'var(--gray-500)', marginBottom: 16 }}>
              Escolhe a cor de acento da app — afeta botões, links e elementos ativos.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {ACCENT_COLORS.map(c => {
                const isActive = settings.accentH === c.h
                return (
                  <button
                    key={c.name}
                    onClick={() => {
                      applyAccent(c.h, c.s, c.l)
                      update('accentH', c.h)
                      update('accentS', c.s)
                      update('accentL', c.l)
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      background: 'none', border: 'none', cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: `hsl(${c.h}, ${c.s}, ${c.l})`,
                      border: isActive ? '3px solid var(--gray-800)' : '3px solid transparent',
                      boxShadow: isActive ? '0 0 0 2px white inset' : 'none',
                      transition: 'all 0.15s',
                    }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isActive ? 'var(--gray-800)' : 'var(--gray-400)' }}>{c.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── APPEARANCE ── */}
      {section === 'appearance' && (
        <div className="card">
          <div className="card-body">
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Nome da app</label>
              <input type="text" style={inputStyle} value={settings.appName} onChange={e => update('appName', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Tema</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ id: 'light', label: '☀️ Claro' }, { id: 'dark', label: '🌙 Escuro' }].map(t => (
                  <button key={t.id} onClick={() => update('theme', t.id)} style={{
                    flex: 1, padding: '12px', borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.88rem',
                    border: `2px solid ${settings.theme === t.id ? 'var(--rose-400)' : 'var(--gray-200)'}`,
                    background: settings.theme === t.id ? 'var(--rose-50)' : 'var(--white)',
                    color: settings.theme === t.id ? 'var(--rose-400)' : 'var(--gray-600)',
                  }}>{t.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-500)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }
const inputStyle = { width: '100%', fontFamily: 'inherit', fontSize: '0.88rem', border: '1.5px solid var(--gray-200)', borderRadius: 8, padding: '9px 12px', outline: 'none', background: 'var(--white)', color: 'var(--gray-900)', boxSizing: 'border-box' }