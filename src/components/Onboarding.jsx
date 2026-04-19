import { useState } from 'react'
import { Plus, X, ChevronRight, ChevronLeft } from 'lucide-react'

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

const YEARS = ['1°', '2°', '3°', '4°', '5°', '6°+']

const EXAM_TYPES = ['Exame', 'Teste', 'Trabalho', 'Projeto', 'Oral']

const STEPS = ['Eu', 'Cadeiras', 'Exames', 'Pronto']

function makeKey(name, suffix = Date.now()) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_').replace(/^_|_$/g, '') + '_' + suffix
}

function guessEmoji(name) {
  const n = name.toLowerCase()
  if (/matem|cálculo|calc|álgebra|algebra|estatíst|probabilid|anális/.test(n)) return '📐'
  if (/progr|python|java|javascript|web|software|comput|informát|algoritm|base.*dado|sistema.*inform/.test(n)) return '💻'
  if (/biolog|genét|microb|ecolog|zoolog|botân|anatom|fisiol/.test(n)) return '🧬'
  if (/quím|físic|termod|eletro|mecân|óptic|nuclear|ondas/.test(n)) return '🔬'
  if (/histór|filosof|sociol|antropol|arqueol|polít|geograf/.test(n)) return '🏛️'
  if (/inglês|portugu|franc|espanho|alemã|língua|literatur|escrita|comunicaç/.test(n)) return '📝'
  if (/música|piano|guitarra|canto|harmonia|teoria.*music/.test(n)) return '🎵'
  if (/arte|design|visual|gráf|pintura|ilustr/.test(n)) return '🎨'
  if (/gestão|marketing|econom|finanç|contab|empres|negóc/.test(n)) return '💡'
  if (/direito|lei|jurídic|constitu/.test(n)) return '🎯'
  if (/psicolog|psicoter|psiquiatr/.test(n)) return '🧠'
  if (/ambiente|sustentab|energi|renov/.test(n)) return '🌱'
  return '📚'
}

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '',
    year: '',
    course: '',
    userType: 'student',
    appName: 'what should I do next?',
    theme: 'light',
    subjects: [],
    schedule: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
    hoursGoal: 100,
    periodStart: new Date().toISOString().split('T')[0],
    periodEnd: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
  })

  // Subject form state
  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [newSubject, setNewSubject] = useState({ name: '', emoji: '📚', color: COLORS[0].color, textColor: COLORS[0].textColor })
  const [pasteText, setPasteText] = useState('')
  const [pasteMode, setPasteMode] = useState(true) // start in paste mode if no subjects yet

  // Exam state (saved to localStorage on complete)
  const [exams, setExams] = useState([])
  const [newExam, setNewExam] = useState({ subject: '', date: '', type: 'Exame' })

  const setField = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const addSubjectManual = () => {
    if (!newSubject.name.trim()) return
    const key = makeKey(newSubject.name)
    setForm(p => ({ ...p, subjects: [...p.subjects, { key, name: newSubject.name.trim(), emoji: newSubject.emoji, color: newSubject.color, textColor: newSubject.textColor, methods: [] }] }))
    setNewSubject({ name: '', emoji: '📚', color: COLORS[0].color, textColor: COLORS[0].textColor })
    setShowSubjectForm(false)
    setPasteMode(false)
  }

  const importFromPaste = () => {
    const lines = pasteText.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) return
    const existing = form.subjects.map(s => s.name.toLowerCase())
    const ts = Date.now()
    const created = lines
      .filter(name => !existing.includes(name.toLowerCase()))
      .map((name, i) => ({
        key: makeKey(name, ts + i),
        name,
        emoji: guessEmoji(name),
        color: COLORS[(form.subjects.length + i) % COLORS.length].color,
        textColor: COLORS[(form.subjects.length + i) % COLORS.length].textColor,
        methods: [],
      }))
    setForm(p => ({ ...p, subjects: [...p.subjects, ...created] }))
    setPasteText('')
    setPasteMode(false)
  }

  const removeSubject = (key) => {
    setForm(p => ({ ...p, subjects: p.subjects.filter(s => s.key !== key) }))
    setExams(e => e.filter(ex => {
      const subj = form.subjects.find(s => s.key === key)
      return !subj || ex.subject !== subj.name
    }))
  }

  const activeExamSubject = newExam.subject || form.subjects[0]?.name || ''

  const addExam = () => {
    if (!activeExamSubject || !newExam.date) return
    setExams(e => [...e, { id: Date.now(), subject: activeExamSubject, date: newExam.date, type: newExam.type, actualGrade: null }])
    setNewExam(p => ({ ...p, date: '' }))
  }

  const handleComplete = () => {
    if (exams.length > 0) {
      try {
        const existing = JSON.parse(localStorage.getItem('exams') || '[]')
        localStorage.setItem('exams', JSON.stringify([...existing, ...exams]))
      } catch {}
    }
    onComplete({ ...form, onboardingDone: true })
  }

  const canNext = () => {
    if (step === 0) return form.name.trim().length > 0
    if (step === 1) return form.subjects.length > 0
    return true
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
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
                fontSize: 'var(--t-caption)', fontWeight: 700,
              }}>{i + 1}</div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 24, height: 2, background: i < step ? 'var(--rose-400)' : 'var(--gray-200)' }} />
              )}
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--white)', borderRadius: 'var(--r)', border: '1px solid var(--gray-200)', padding: '32px', boxShadow: 'var(--shadow)' }}>

          {/* ── STEP 0: Eu ── */}
          {step === 0 && (
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>Bem-vinda! 👋</h2>
              <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-400)', marginBottom: 24 }}>Dados reais primeiro — isto leva menos de 2 minutos.</p>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>O teu nome</label>
                <input
                  type="text" style={inputStyle} placeholder="Como te chamas?"
                  value={form.name} onChange={e => setField('name', e.target.value)}
                  autoFocus onKeyDown={e => e.key === 'Enter' && canNext() && setStep(1)}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Ano do curso</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {YEARS.map(y => (
                    <button key={y} onClick={() => setField('year', y)} style={{
                      padding: '8px 14px', borderRadius: 50, fontFamily: 'inherit', fontWeight: 700,
                      fontSize: 'var(--t-body)', cursor: 'pointer',
                      border: `2px solid ${form.year === y ? 'var(--rose-400)' : 'var(--gray-200)'}`,
                      background: form.year === y ? 'var(--rose-50)' : 'var(--white)',
                      color: form.year === y ? 'var(--rose-400)' : 'var(--gray-500)',
                    }}>{y}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Que curso? <span style={{ fontWeight: 400, opacity: 0.6 }}>(opcional)</span></label>
                <input
                  type="text" style={inputStyle}
                  placeholder="Ex: Engenharia Informática, Medicina..."
                  value={form.course} onChange={e => setField('course', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── STEP 1: Cadeiras ── */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>Cadeiras deste semestre 📚</h2>
              <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-400)', marginBottom: 20 }}>
                Cola a lista ou adiciona uma a uma.
              </p>

              {/* Paste option */}
              {(pasteMode || form.subjects.length === 0) && (
                <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--r)', padding: 16, marginBottom: 12 }}>
                  <label style={labelStyle}>Cola os nomes (uma por linha)</label>
                  <textarea
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                    placeholder={'Análise Matemática\nProgramação I\nFísica Aplicada\n...'}
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    autoFocus={form.subjects.length === 0}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      className="btn btn-primary"
                      onClick={importFromPaste}
                      disabled={!pasteText.trim()}
                    >
                      Criar todas →
                    </button>
                    {form.subjects.length > 0 && (
                      <button className="btn btn-ghost" onClick={() => setPasteMode(false)}>Cancelar</button>
                    )}
                  </div>
                </div>
              )}

              {/* Added subjects */}
              {form.subjects.map(s => (
                <div key={s.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  background: s.color + '30', borderRadius: 'var(--r)', marginBottom: 8,
                  border: `1.5px solid ${s.color}`,
                }}>
                  <span style={{ fontSize: '1.1rem' }}>{s.emoji}</span>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 'var(--t-body)', color: s.textColor }}>{s.name}</span>
                  <button className="btn btn-ghost" onClick={() => removeSubject(s.key)}><X size={13} /></button>
                </div>
              ))}

              {/* Manual add form */}
              {!pasteMode && (
                <>
                  {showSubjectForm ? (
                    <div style={{ background: 'var(--gray-50)', border: '1px dashed var(--gray-200)', borderRadius: 'var(--r)', padding: 16, marginTop: 8 }}>
                      <div style={{ marginBottom: 10 }}>
                        <label style={labelStyle}>Nome</label>
                        <input
                          type="text" style={inputStyle}
                          placeholder="Ex: Matemática, Python..."
                          value={newSubject.name}
                          onChange={e => setNewSubject(p => ({ ...p, name: e.target.value, emoji: guessEmoji(e.target.value) || p.emoji }))}
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && addSubjectManual()}
                        />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={labelStyle}>Emoji</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {EMOJIS.map(e => (
                            <button key={e} onClick={() => setNewSubject(p => ({ ...p, emoji: e }))} style={{ width: 32, height: 32, borderRadius: 6, border: `2px solid ${newSubject.emoji === e ? 'var(--rose-400)' : 'var(--gray-200)'}`, background: newSubject.emoji === e ? 'var(--rose-50)' : 'var(--white)', cursor: 'pointer', fontSize: 'var(--t-body)' }}>{e}</button>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <label style={labelStyle}>Cor</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {COLORS.map(c => (
                            <button key={c.color} onClick={() => setNewSubject(p => ({ ...p, color: c.color, textColor: c.textColor }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c.color, border: `3px solid ${newSubject.color === c.color ? 'var(--gray-800)' : 'transparent'}`, cursor: 'pointer' }} />
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" onClick={addSubjectManual}><Plus size={13} /> Adicionar</button>
                        <button className="btn btn-ghost" onClick={() => setShowSubjectForm(false)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, marginTop: form.subjects.length ? 8 : 0 }}>
                      <button className="btn btn-secondary" onClick={() => setShowSubjectForm(true)} style={{ flex: 1, justifyContent: 'center' }}>
                        <Plus size={14} /> Adicionar cadeira
                      </button>
                      {form.subjects.length > 0 && (
                        <button className="btn btn-ghost" onClick={() => { setPasteMode(true); setPasteText('') }}>
                          Colar lista
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── STEP 2: Exames ── */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>Próximos exames 🎯</h2>
              <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-400)', marginBottom: 20 }}>
                A app vai lembrar-te das datas. Podes saltar e adicionar depois.
              </p>

              {/* Added exams */}
              {exams.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {exams.map((ex, i) => {
                    const subj = form.subjects.find(s => s.name === ex.subject)
                    return (
                      <div key={ex.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                        background: subj ? subj.color + '25' : 'var(--gray-50)',
                        border: `1.5px solid ${subj ? subj.color : 'var(--gray-200)'}`,
                        borderRadius: 'var(--r)', marginBottom: 6,
                      }}>
                        <span style={{ fontSize: '1rem' }}>{subj?.emoji || '🎯'}</span>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: 'var(--t-body)', color: subj?.textColor || 'var(--gray-800)' }}>{ex.subject}</span>
                        <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-500)', fontWeight: 600 }}>{ex.type}</span>
                        <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>
                          {new Date(ex.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
                        </span>
                        <button onClick={() => setExams(e => e.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-300)', fontSize: '1rem', lineHeight: 1 }}>×</button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add exam form */}
              <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--r)', padding: 16 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Cadeira</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {form.subjects.map(s => (
                      <button key={s.key} onClick={() => setNewExam(p => ({ ...p, subject: s.name }))} style={{
                        padding: '5px 12px', borderRadius: 50, fontFamily: 'inherit', fontSize: 'var(--t-caption)', fontWeight: 700, cursor: 'pointer',
                        border: `2px solid ${activeExamSubject === s.name ? s.color : 'var(--gray-200)'}`,
                        background: activeExamSubject === s.name ? s.color + '30' : 'var(--white)',
                        color: activeExamSubject === s.name ? s.textColor : 'var(--gray-400)',
                      }}>{s.emoji} {s.name}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 10, alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Data</label>
                    <input
                      type="date" style={inputStyle}
                      value={newExam.date}
                      onChange={e => setNewExam(p => ({ ...p, date: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addExam()}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo</label>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {EXAM_TYPES.map(t => (
                        <button key={t} onClick={() => setNewExam(p => ({ ...p, type: t }))} style={{
                          padding: '9px 10px', borderRadius: 'var(--r)', fontFamily: 'inherit', fontSize: 'var(--t-caption)', fontWeight: 700, cursor: 'pointer',
                          border: `2px solid ${newExam.type === t ? 'var(--rose-400)' : 'var(--gray-200)'}`,
                          background: newExam.type === t ? 'var(--rose-50)' : 'var(--white)',
                          color: newExam.type === t ? 'var(--rose-400)' : 'var(--gray-500)',
                        }}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={addExam}
                  disabled={!activeExamSubject || !newExam.date}
                >
                  <Plus size={13} /> Adicionar exame
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Pronto ── */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>
                {form.subjects.length > 0
                  ? `Pronto, ${form.name.split(' ')[0]}! ✨`
                  : 'Quase lá! ✨'}
              </h2>
              <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-400)', marginBottom: 20 }}>
                Escolhe o tema — podes mudar tudo depois nas Definições.
              </p>

              {/* Summary */}
              {(form.subjects.length > 0 || exams.length > 0) && (
                <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-100)', borderRadius: 'var(--r)', padding: '12px 16px', marginBottom: 20 }}>
                  {form.subjects.length > 0 && (
                    <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-600)', marginBottom: exams.length ? 4 : 0 }}>
                      <strong>{form.subjects.length}</strong> cadeira{form.subjects.length !== 1 ? 's' : ''}: {form.subjects.map(s => s.emoji + ' ' + s.name).join(', ')}
                    </p>
                  )}
                  {exams.length > 0 && (
                    <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-600)' }}>
                      <strong>{exams.length}</strong> exame{exams.length !== 1 ? 's' : ''} registado{exams.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label style={labelStyle}>Tema</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[{ id: 'light', label: '☀️ Claro' }, { id: 'dark', label: '🌙 Escuro' }].map(t => (
                    <button key={t.id} onClick={() => setField('theme', t.id)} style={{
                      flex: 1, padding: '12px', borderRadius: 'var(--r)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 'var(--t-body)',
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
            <button
              className="btn btn-secondary"
              onClick={() => setStep(s => s - 1)}
              style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
            >
              <ChevronLeft size={15} /> Anterior
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {step === 2 && (
                <button
                  onClick={() => setStep(3)}
                  style={{ background: 'none', border: 'none', fontSize: 'var(--t-caption)', color: 'var(--gray-400)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                >
                  Saltar
                </button>
              )}
              {step === 0 && (
                <button
                  onClick={() => onComplete({ onboardingDone: true })}
                  style={{ background: 'none', border: 'none', fontSize: 'var(--t-caption)', color: 'var(--gray-400)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                >
                  Fazer mais tarde
                </button>
              )}
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

const labelStyle = { display: 'block', fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-500)', marginBottom: 5, letterSpacing: 0.4 }
const inputStyle = { width: '100%', fontFamily: 'inherit', fontSize: 'var(--t-body)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--r)', padding: '9px 12px', outline: 'none', background: 'var(--white)', color: 'var(--gray-900)', boxSizing: 'border-box' }
