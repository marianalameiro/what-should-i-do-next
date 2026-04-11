import { useState } from 'react'
import { Plus, X, ChevronRight, ChevronLeft } from 'lucide-react'
import { DAY_NAMES_SHORT } from '../constants'

const USER_TYPES = [
  { id: 'student',      label: 'Estudante universitário', emoji: '🎓' },
  { id: 'selftaught',   label: 'Autodidata',              emoji: '📖' },
  { id: 'professional', label: 'Profissional',            emoji: '💼' },
  { id: 'other',        label: 'Outro',                   emoji: '✨' },
]

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

const EMOJIS = ['📚','🧠','🧬','📐','🎨','💻','🔬','📝','🎯','🌍','💡','🎵','⚡','🌱','🏛️','🔭']

const STEPS = ['Bem-vindo', 'Cadeiras', 'Plano', 'Metas', 'Aparência']

export default function Onboarding({ onComplete }) {
  const [step, setStep]   = useState(0)
  const [form, setForm]   = useState({
    name: '',
    userType: 'student',
    appName: 'what should I do next?',
    theme: 'light',
    subjects: [],
    schedule: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
    hoursGoal: 100,
    periodStart: new Date().toISOString().split('T')[0],
    periodEnd: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
  })

  const [newSubject, setNewSubject] = useState({ name: '', emoji: '📚', color: COLORS[0].color, textColor: COLORS[0].textColor, methods: '' })
  const [showSubjectForm, setShowSubjectForm] = useState(false)

  const addSubject = () => {
    if (!newSubject.name.trim()) return
    const key = newSubject.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now()
    const methods = newSubject.methods.split('\n').map(m => m.trim()).filter(Boolean)
    setForm(p => ({ ...p, subjects: [...p.subjects, { key, name: newSubject.name.trim(), emoji: newSubject.emoji, color: newSubject.color, textColor: newSubject.textColor, methods }] }))
    setNewSubject({ name: '', emoji: '📚', color: COLORS[0].color, textColor: COLORS[0].textColor, methods: '' })
    setShowSubjectForm(false)
  }

  const removeSubject = (key) => {
    setForm(p => ({ ...p, subjects: p.subjects.filter(s => s.key !== key) }))
  }

  const toggleSchedule = (day, subjectKey) => {
    setForm(p => {
      const current = p.schedule[day] || []
      const next = current.includes(subjectKey) ? current.filter(k => k !== subjectKey) : [...current, subjectKey]
      return { ...p, schedule: { ...p.schedule, [day]: next } }
    })
  }

  const handleComplete = () => {
    onComplete({
      ...form,
      onboardingDone: true,
    })
  }

  const canNext = () => {
    if (step === 0) return form.name.trim().length > 0
    if (step === 1) return form.subjects.length > 0
    return true
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32, justifyContent: 'center' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: i <= step ? 'var(--rose-400)' : 'var(--gray-200)',
                color: i <= step ? 'white' : 'var(--gray-400)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700,
              }}>{i + 1}</div>
              {i < STEPS.length - 1 && <div style={{ width: 24, height: 2, background: i < step ? 'var(--rose-400)' : 'var(--gray-200)' }} />}
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-200)', padding: '32px', boxShadow: 'var(--shadow-md)' }}>

          {/* ── STEP 0: Welcome ── */}
          {step === 0 && (
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>Bem-vinda! 👋</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-400)', marginBottom: 24 }}>Vamos configurar a app para ti. Só demora 2 minutos.</p>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>O teu nome</label>
                <input type="text" style={inputStyle} placeholder="Ex: Nome" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>O que melhor te descreve?</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {USER_TYPES.map(t => (
                    <button key={t.id} onClick={() => setForm(p => ({ ...p, userType: t.id }))} style={{
                      padding: '12px 16px', borderRadius: 'var(--radius)', textAlign: 'left',
                      border: `2px solid ${form.userType === t.id ? 'var(--rose-400)' : 'var(--gray-200)'}`,
                      background: form.userType === t.id ? 'var(--rose-50)' : 'var(--white)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>{t.emoji}</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: form.userType === t.id ? 'var(--rose-400)' : 'var(--gray-700)' }}>{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Eisenhower matrix explainer */}
              <div style={{ background: '#fefce8', border: '1.5px solid #fde047', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontWeight: 800, fontSize: '0.8rem', color: '#854d0e', marginBottom: 8 }}>💡 Como vais organizar as tuas tarefas</p>
                <p style={{ fontSize: '0.75rem', color: '#78350f', marginBottom: 10, lineHeight: 1.5 }}>
                  A app usa a <strong>Matriz de Eisenhower</strong> para te ajudar a priorizar. Cada tarefa cai num de 4 quadrantes:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    { emoji: '🔴', label: 'Q1 — Faz agora', desc: 'Urgente + Importante', bg: '#fef2f2', border: '#fca5a5', color: '#991b1b' },
                    { emoji: '🟡', label: 'Q2 — Planeia', desc: 'Importante, não urgente', bg: '#fefce8', border: '#fde047', color: '#854d0e' },
                    { emoji: '🟠', label: 'Q3 — Delega', desc: 'Urgente, não importante', bg: '#fff7ed', border: '#fdba74', color: '#9a3412' },
                    { emoji: '⚪', label: 'Q4 — Elimina', desc: 'Nem urgente nem importante', bg: '#fafafa', border: '#e4e4e7', color: '#52525b' },
                  ].map(q => (
                    <div key={q.label} style={{ background: q.bg, border: `1px solid ${q.border}`, borderRadius: 8, padding: '8px 10px' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.73rem', color: q.color, marginBottom: 2 }}>{q.emoji} {q.label}</p>
                      <p style={{ fontSize: '0.68rem', color: q.color, opacity: 0.8 }}>{q.desc}</p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '0.7rem', color: '#92400e', marginTop: 8, fontStyle: 'italic' }}>
                  A app classifica as tarefas automaticamente — e tu podes sempre mover para outro quadrante.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 1: Subjects ── */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>As tuas cadeiras 📚</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-400)', marginBottom: 20 }}>Adiciona o que estudas — cadeiras, tópicos, projetos de aprendizagem.</p>

              {form.subjects.map(s => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: s.color + '30', borderRadius: 10, marginBottom: 8, border: `1.5px solid ${s.color}` }}>
                  <span style={{ fontSize: '1.1rem' }}>{s.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.85rem', color: s.textColor, marginBottom: 1 }}>{s.name}</p>
                    {s.methods?.length > 0 && <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{s.methods.slice(0, 2).join(' · ')}{s.methods.length > 2 ? ' ...' : ''}</p>}
                  </div>
                  <button className="btn btn-ghost" onClick={() => removeSubject(s.key)}><X size={13} /></button>
                </div>
              ))}

              {showSubjectForm ? (
                <div style={{ background: 'var(--gray-50)', border: '1px dashed var(--gray-200)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 10 }}>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Nome</label>
                    <input type="text" style={inputStyle} placeholder="Ex: Matemática, Python, Marketing..." value={newSubject.name} onChange={e => setNewSubject(p => ({ ...p, name: e.target.value }))} autoFocus />
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
                    <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder={'Ex:\nLer o capítulo\nFazer resumo\nPraticar exercícios'} value={newSubject.methods} onChange={e => setNewSubject(p => ({ ...p, methods: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={addSubject}><Plus size={13} /> Adicionar</button>
                    <button className="btn btn-ghost" onClick={() => setShowSubjectForm(false)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-secondary" onClick={() => setShowSubjectForm(true)} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                  <Plus size={14} /> Adicionar cadeira
                </button>
              )}
            </div>
          )}

          {/* ── STEP 2: Schedule ── */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>Plano semanal 📅</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-400)', marginBottom: 20 }}>Para cada dia, escolhe o que estudas. Podes alterar depois nas Definições.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1,2,3,4,5,6,0].map(day => (
                  <div key={day}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-600)', marginBottom: 6 }}>{DAY_NAMES_SHORT[day]}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {form.subjects.map(s => {
                        const active = (form.schedule[day] || []).includes(s.key)
                        return (
                          <button key={s.key} onClick={() => toggleSchedule(day, s.key)} style={{
                            padding: '5px 12px', borderRadius: 50, fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                            border: `2px solid ${active ? s.color : 'var(--gray-200)'}`,
                            background: active ? s.color + '30' : 'var(--white)',
                            color: active ? s.textColor : 'var(--gray-400)',
                          }}>{s.emoji} {s.name}</button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: Goals ── */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>Metas de estudo 🎯</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-400)', marginBottom: 20 }}>Define o teu período e quantas horas queres estudar no total.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Data de início</label>
                  <input type="date" style={inputStyle} value={form.periodStart} onChange={e => setForm(p => ({ ...p, periodStart: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Data de fim</label>
                  <input type="date" style={inputStyle} value={form.periodEnd} onChange={e => setForm(p => ({ ...p, periodEnd: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Horas totais de estudo (meta): {form.hoursGoal}h</label>
                <input type="range" min="10" max="500" step="5" value={form.hoursGoal} onChange={e => setForm(p => ({ ...p, hoursGoal: parseInt(e.target.value) }))} style={{ width: '100%', marginBottom: 6 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--gray-400)' }}>
                  <span>10h</span><span>500h</span>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: Appearance ── */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>Aparência ✨</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-400)', marginBottom: 20 }}>Personaliza a app ao teu gosto.</p>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Nome da app</label>
                <input type="text" style={inputStyle} value={form.appName} onChange={e => setForm(p => ({ ...p, appName: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Tema</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[{ id: 'light', label: '☀️ Claro' }, { id: 'dark', label: '🌙 Escuro' }].map(t => (
                    <button key={t.id} onClick={() => setForm(p => ({ ...p, theme: t.id }))} style={{
                      flex: 1, padding: '12px', borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
                      border: `2px solid ${form.theme === t.id ? 'var(--rose-400)' : 'var(--gray-200)'}`,
                      background: form.theme === t.id ? 'var(--rose-50)' : 'var(--white)',
                      color: form.theme === t.id ? 'var(--rose-400)' : 'var(--gray-600)',
                    }}>{t.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
            <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>
              <ChevronLeft size={15} /> Anterior
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => onComplete({ onboardingDone: true })} style={{ background: 'none', border: 'none', fontSize: '0.78rem', color: 'var(--gray-400)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                Fazer mais tarde
              </button>
              {step < STEPS.length - 1 ? (
                <button className="btn btn-primary" onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
                  Seguinte <ChevronRight size={15} />
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handleComplete}>
                  Começar 🚀
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: '0.73rem', fontWeight: 700, color: 'var(--gray-500)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }
const inputStyle = { width: '100%', fontFamily: 'inherit', fontSize: '0.88rem', border: '1.5px solid var(--gray-200)', borderRadius: 8, padding: '9px 12px', outline: 'none', background: 'var(--white)', color: 'var(--gray-900)', boxSizing: 'border-box' }