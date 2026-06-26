import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { EVENT_TYPES } from '../constants'

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback }
  catch { return fallback }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)) }

// Nota final por cadeira + notas de anos anteriores + média do curso.
// Partilha os dados ('exams', 'subject-ects', 'old-grades') com a página Exames via localStorage.
// Seguro porque o <main> usa key={tab}: trocar de separador desmonta este painel e a página
// Exames, e cada um recarrega o estado fresco do localStorage ao montar — nunca coexistem
// dois donos do mesmo 'exams' em simultâneo. Se essa remontagem deixar de existir, rever isto.
export default function GradesPanel({ settings }) {
  const [exams, setExams]             = useState(() => load('exams', []))
  const [subjectEcts, setSubjectEcts] = useState(() => load('subject-ects', {}))
  const [oldGrades, setOldGrades]     = useState(() => load('old-grades', []))
  const [newOldGrade, setNewOldGrade] = useState({ name: '', grade: '', ects: '' })
  const [compDraft, setCompDraft]     = useState(null) // { subject, type, weight, date } | null

  useEffect(() => save('exams', exams),             [exams])
  useEffect(() => save('subject-ects', subjectEcts), [subjectEcts])
  useEffect(() => save('old-grades', oldGrades),    [oldGrades])

  function updateExamWeight(id, weight) {
    setExams(prev => prev.map(e => e.id === id ? { ...e, weight: weight === '' ? null : parseFloat(weight) } : e))
  }
  function updateActualGrade(id, grade) {
    setExams(prev => prev.map(e => e.id === id ? { ...e, actualGrade: grade === '' ? null : parseFloat(grade) } : e))
  }
  function updateSubjectEcts(key, ects) {
    setSubjectEcts(prev => ({ ...prev, [key]: ects === '' ? undefined : parseFloat(ects) }))
  }
  function removeExam(id) {
    if (!window.confirm('Remover este componente?')) return
    setExams(prev => prev.filter(e => e.id !== id))
  }
  function addComponent() {
    if (!compDraft?.subject) return
    const w = compDraft.weight ? parseFloat(compDraft.weight) : null
    setExams(prev => [...prev, {
      id: Date.now(), subject: compDraft.subject, type: compDraft.type || 'Componente',
      date: compDraft.date || '', minGrade: 10, desiredGrade: null, weight: w, sheets: [],
    }])
    setCompDraft(null)
  }
  function addOldGrade() {
    const grade = parseFloat(newOldGrade.grade), ects = parseFloat(newOldGrade.ects)
    if (!newOldGrade.name.trim() || isNaN(grade) || isNaN(ects) || ects <= 0) return
    setOldGrades(prev => [...prev, { id: Date.now(), name: newOldGrade.name.trim(), grade, ects }])
    setNewOldGrade({ name: '', grade: '', ects: '' })
  }
  function removeOldGrade(id) {
    setOldGrades(prev => prev.filter(g => g.id !== id))
  }

  // Nota final por cadeira (inclui cadeiras fechadas — concluídas).
  const subjectGrades = (settings?.subjects || []).map(s => {
    const subjExams   = exams.filter(e => e.subject === s.name)
    const withWeight  = subjExams.filter(e => e.weight > 0)
    const graded      = withWeight.filter(e => e.actualGrade != null)
    const definedW    = withWeight.reduce((a, e) => a + e.weight, 0)
    const gradedW     = graded.reduce((a, e) => a + e.weight, 0)
    const weightedSum = graded.reduce((a, e) => a + e.actualGrade * e.weight, 0)
    const complete    = gradedW >= 99.5
    const finalExact  = gradedW > 0 ? weightedSum / gradedW : null
    const finalGrade  = complete ? Math.round(finalExact) : null
    const ects        = subjectEcts[s.key]
    return { key: s.key, name: s.name, emoji: s.emoji, color: s.color, closed: !!s.closed, components: subjExams, definedW, gradedW, finalExact, finalGrade, complete, ects }
  }).filter(g => g.components.length > 0 || !g.closed)

  const overallAverage = (() => {
    const current = subjectGrades.filter(g => g.finalGrade != null && g.ects > 0).map(g => ({ grade: g.finalGrade, ects: g.ects }))
    const all = [...current, ...oldGrades.filter(g => g.ects > 0)]
    if (all.length === 0) return null
    const sumEcts = all.reduce((a, g) => a + g.ects, 0)
    const sumWeighted = all.reduce((a, g) => a + g.grade * g.ects, 0)
    return { value: parseFloat((sumWeighted / sumEcts).toFixed(2)), count: all.length, ects: sumEcts }
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Média do curso */}
      {overallAverage !== null && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #fdf2f4, #fce7f3)' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--rose-400)', letterSpacing: 0.4, margin: 0 }}>Média do curso (ponderada por ECTS)</p>
              <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--gray-900)', margin: 0, lineHeight: 1.2 }}>{overallAverage.value}<span style={{ fontSize: '1rem', color: 'var(--gray-400)' }}>/20</span></p>
            </div>
            <div style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-500)', textAlign: 'right' }}>
              <p style={{ margin: 0 }}>{overallAverage.count} cadeira{overallAverage.count !== 1 ? 's' : ''} concluída{overallAverage.count !== 1 ? 's' : ''} · {overallAverage.ects} ECTS</p>
              <p style={{ margin: '2px 0 0', fontWeight: 600, color: overallAverage.value >= 10 ? '#16a34a' : '#dc2626' }}>{overallAverage.value >= 18 ? '⭐ Excelente' : overallAverage.value >= 14 ? '✅ Bom' : overallAverage.value >= 10 ? '👍 Positiva' : '⚠️ Negativa'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Nota final por cadeira */}
      {subjectGrades.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📊 Nota final por cadeira</span>
            <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 500 }}>peso de cada avaliação · ECTS da cadeira</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {subjectGrades.map(g => {
              const weightOff = g.definedW > 0 && Math.abs(g.definedW - 100) > 0.5
              return (
                <div key={g.key} style={{ border: '1px solid var(--gray-100)', borderRadius: 'var(--r)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--t-body)', fontWeight: 700, color: 'var(--gray-800)' }}>
                      {g.emoji} {g.name}
                      {g.closed && <span style={{ marginLeft: 6, fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)', background: 'var(--gray-100)', borderRadius: 99, padding: '1px 7px' }}>fechada</span>}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <label style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                        ECTS
                        <input type="number" min={0} max={60} value={g.ects ?? ''} placeholder="—" onChange={e => updateSubjectEcts(g.key, e.target.value)}
                          style={{ width: 56, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--gray-200)', fontFamily: 'inherit', fontSize: 'var(--t-caption)' }} />
                      </label>
                      {g.finalGrade != null ? (
                        <span style={{ fontSize: 'var(--t-body)', fontWeight: 800, color: g.finalGrade >= 10 ? '#16a34a' : '#dc2626' }}>{g.finalGrade}<span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 600 }}>/20</span></span>
                      ) : (
                        <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--amber-400)' }}>incompleta</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {g.components.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 'var(--t-caption)' }}>
                        <span style={{ color: 'var(--gray-500)', fontWeight: 600, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.type} · {c.date ? new Date(c.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) : '—'}
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--gray-400)', flexShrink: 0 }}>
                          <input type="number" min={0} max={100} value={c.weight ?? ''} placeholder="peso" onChange={e => updateExamWeight(c.id, e.target.value)}
                            style={{ width: 52, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--gray-200)', fontFamily: 'inherit', fontSize: 'var(--t-caption)' }} />%
                        </label>
                        <input type="number" min={0} max={20} step={0.1} value={c.actualGrade ?? ''} placeholder="nota"
                          onChange={e => updateActualGrade(c.id, e.target.value)}
                          style={{ width: 58, flexShrink: 0, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--gray-200)', fontFamily: 'inherit', fontSize: 'var(--t-caption)', fontWeight: 700, textAlign: 'center', color: c.actualGrade != null ? (c.actualGrade >= 10 ? '#16a34a' : '#dc2626') : 'var(--gray-700)' }} />
                        <button onClick={() => removeExam(c.id)} title="Remover componente"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-300)', padding: 0, flexShrink: 0, display: 'flex' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {compDraft?.subject === g.name ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                      <select value={compDraft.type} onChange={e => setCompDraft(d => ({ ...d, type: e.target.value }))}
                        style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--gray-200)', fontFamily: 'inherit', fontSize: 'var(--t-caption)' }}>
                        {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                      <input type="number" min={0} max={100} value={compDraft.weight} placeholder="peso %"
                        onChange={e => setCompDraft(d => ({ ...d, weight: e.target.value }))}
                        style={{ width: 70, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--gray-200)', fontFamily: 'inherit', fontSize: 'var(--t-caption)' }} />
                      <input type="date" value={compDraft.date} onChange={e => setCompDraft(d => ({ ...d, date: e.target.value }))}
                        style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--gray-200)', fontFamily: 'inherit', fontSize: 'var(--t-caption)' }} />
                      <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 'var(--t-caption)' }} onClick={addComponent}>Adicionar</button>
                      <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 'var(--t-caption)' }} onClick={() => setCompDraft(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setCompDraft({ subject: g.name, type: 'Teste', weight: '', date: '' })}
                      style={{ marginTop: 8, background: 'none', border: '1px dashed var(--gray-300)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--t-caption)', fontWeight: 600, color: 'var(--gray-500)' }}>
                      + adicionar componente
                    </button>
                  )}
                  <p style={{ fontSize: 'var(--t-caption)', color: weightOff ? '#dc2626' : 'var(--gray-400)', margin: '8px 0 0' }}>
                    {weightOff
                      ? `⚠️ Os pesos somam ${g.definedW}% — deviam somar 100%.`
                      : g.complete
                        ? `✅ Nota final completa (${g.gradedW}% lançado).`
                        : `Faltam lançar ${Math.max(0, Math.round(100 - g.gradedW))}% da nota para fechar a cadeira.`}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notas de anos anteriores */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🗓️ Notas de anos anteriores</span>
          <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 500 }}>entram na média do curso</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {oldGrades.map(o => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--gray-50)' }}>
              <span style={{ fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--gray-700)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
              <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', flexShrink: 0 }}>{o.ects} ECTS</span>
              <span style={{ fontSize: 'var(--t-body)', fontWeight: 800, color: o.grade >= 10 ? '#16a34a' : '#dc2626', minWidth: 44, textAlign: 'right', flexShrink: 0 }}>{o.grade}/20</span>
              <button className="btn btn-ghost" onClick={() => removeOldGrade(o.id)} style={{ padding: '4px 6px', flexShrink: 0 }}><Trash2 size={13} /></button>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px auto', gap: 8, alignItems: 'center' }}>
            <input className="form-input" placeholder="Cadeira" value={newOldGrade.name} onChange={e => setNewOldGrade(p => ({ ...p, name: e.target.value }))} />
            <input className="form-input" type="number" min={0} max={20} step={0.1} placeholder="Nota" value={newOldGrade.grade} onChange={e => setNewOldGrade(p => ({ ...p, grade: e.target.value }))} />
            <input className="form-input" type="number" min={0} max={60} placeholder="ECTS" value={newOldGrade.ects} onChange={e => setNewOldGrade(p => ({ ...p, ects: e.target.value }))} />
            <button className="btn btn-primary" onClick={addOldGrade} style={{ padding: '8px 12px' }}><Plus size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
