import { useState, useEffect } from 'react'
import { Sparkles, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { WeeklyReview } from './WeeklyReview'

const GROQ_MODEL = 'llama-3.3-70b-versatile'

function loadSubjects() {
  try {
    const s = JSON.parse(localStorage.getItem('user-settings'))
    return s?.subjects || []
  } catch { return [] }
}

function loadEntries() {
  try { return JSON.parse(localStorage.getItem('diary-entries')) || [] }
  catch { return [] }
}

function saveEntries(e) {
  localStorage.setItem('diary-entries', JSON.stringify(e))
}

export default function StudyDiary() {
  const SUBJECTS = loadSubjects()

  const [entries, setEntries]       = useState(loadEntries)
  const [text, setText]             = useState('')
  const [subject, setSubject]       = useState(() => loadSubjects()[0]?.key || '')
  const [loading, setLoading]       = useState(false)
  const [reanalysing, setReanalysing] = useState(null)
  const [expanded, setExpanded]     = useState(null)
  const [showReview, setShowReview] = useState(false)
  const [filterSubject, setFilterSubject] = useState('')
  const [filterText, setFilterText] = useState('')
  const PAGE_SIZE = 10
  const [page, setPage]             = useState(0)

  useEffect(() => { saveEntries(entries) }, [entries])

  const getAdvice = async (entryText, entrySubject, skipGlobalLoading = false) => {
    const apiKey = localStorage.getItem('groq-key')
    if (!apiKey) return 'Adiciona a tua Groq API key no AI Chat primeiro.'

    if (!skipGlobalLoading) setLoading(true)
    const subj = SUBJECTS.find(s => s.key === entrySubject)

    const pendingTasks = (() => {
      try {
        const settings = JSON.parse(localStorage.getItem('user-settings')) || {}
        const dow = new Date().getDay()
        const schedule = (settings.subjects || []).flatMap(s =>
          (settings.schedule?.[dow] || []).includes(s.key)
            ? (s.tasks || []).map(t => t.label).filter(Boolean)
            : []
        )
        const extras = (JSON.parse(localStorage.getItem('extra-tasks')) || []).map(t => t.label)
        const done = JSON.parse(localStorage.getItem(`tasks-${new Date().toDateString()}`)) || {}
        return [...schedule, ...extras].filter(l => !Object.values(done).includes(l)).slice(0, 5)
      } catch { return [] }
    })()
    const pendingCtx = pendingTasks.length
      ? `\nTarefas ainda por fazer hoje: ${pendingTasks.map(t => `"${t}"`).join(', ')}.`
      : ''

    const safeEntry = entryText.trim().slice(0, 2000).replace(/"/g, '\\"')
    const prompt = `És uma coach de estudo prática e empática para uma estudante universitária a estudar ${subj?.name || 'a cadeira'}.

Ela escreveu o seguinte sobre a sessão de estudo de hoje:
"${safeEntry}"${pendingCtx}

Com base no que ela escreveu, dá-lhe:
1. Um reconhecimento empático breve do que está a sentir
2. 2-3 ações concretas e específicas para melhorar ou continuar o progresso
3. Uma frase de encorajamento

Sê direta, prática e calorosa. Máximo 5-6 frases. Usa 1-2 emojis. Responde em português de Portugal.`

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      if (!res.ok) return 'Erro ao obter conselho. Verifica a tua API key.'
      return data.choices[0].message.content
    } catch {
      return 'Erro de ligacao. Verifica a tua internet.'
    } finally {
      if (!skipGlobalLoading) setLoading(false)
    }
  }

  const addEntry = async () => {
    if (!text.trim()) return
    setLoading(true)
    const advice = await getAdvice(text, subject)
    const entry = {
      id: Date.now(),
      subject,
      text: text.trim(),
      advice,
      date: new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }),
      time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
    }
    setEntries(prev => [entry, ...prev])
    setText('')
    setExpanded(entry.id)
    setLoading(false)
  }

  const removeEntry = (id) => setEntries(prev => prev.filter(e => e.id !== id))

  const reanalyseEntry = async (entry) => {
    setReanalysing(entry.id)
    const advice = await getAdvice(entry.text, entry.subject, true)
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, advice } : e))
    setReanalysing(null)
  }

  const filtered = entries
    .filter(e => !filterSubject || e.subject === filterSubject)
    .filter(e => !filterText || e.text.toLowerCase().includes(filterText.toLowerCase()) || (e.advice || '').toLowerCase().includes(filterText.toLowerCase()))
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1>📓 Diário de Estudo</h1>
          <p className="subtitle">Escreve como correu o estudo — a IA orienta-te com base no que escreveste</p>
        </div>
        <button className={showReview ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setShowReview(v => !v)}>
          🔁 Weekly Review
        </button>
      </div>

      {showReview && (
        <div style={{ marginBottom: 24 }}>
          <WeeklyReview />
        </div>
      )}

      {/* Entry form */}
      <div style={{
        background: 'var(--white)', border: '1px solid var(--gray-200)',
        borderRadius: 'var(--radius)', padding: '20px',
        marginBottom: 24, boxShadow: 'var(--shadow-xs)',
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {SUBJECTS.map(s => (
            <button
              key={s.key}
              onClick={() => setSubject(s.key)}
              style={{
                padding: '5px 12px', borderRadius: 50,
                border: `2px solid ${subject === s.key ? '#c0455a' : 'var(--gray-200)'}`,
                background: subject === s.key ? '#fff0f3' : 'var(--white)',
                color: subject === s.key ? '#c0455a' : 'var(--gray-500)',
                fontFamily: 'inherit', fontWeight: 700,
                fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {s.emoji} {s.name}
            </button>
          ))}
        </div>

        <textarea
          rows={4}
          placeholder="Como correu o estudo hoje? O que percebeste bem? O que foi difícil? Como te sentiste?..."
          value={text}
          onChange={e => setText(e.target.value)}
          style={{
            width: '100%', fontFamily: 'inherit', fontSize: '0.9rem',
            border: '1px solid var(--gray-200)', borderRadius: 10,
            padding: '12px 14px', outline: 'none',
            background: 'var(--gray-50)', color: 'var(--gray-900)',
            resize: 'vertical', lineHeight: 1.6,
            transition: 'border-color 0.15s',
            marginBottom: 12,
          }}
          onFocus={e => e.target.style.borderColor = '#c0455a'}
          onBlur={e => e.target.style.borderColor = 'var(--gray-200)'}
        />

        <button
          className="btn btn-primary"
          onClick={addEntry}
          disabled={loading || !text.trim()}
          style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
        >
          {loading
            ? <><span className="dots"><span /><span /><span /></span> A analisar...</>
            : <><Sparkles size={15} /> Guardar e obter orientação</>
          }
        </button>
      </div>

      {/* Filter bar */}
      {entries.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <select
            value={filterSubject}
            onChange={e => { setFilterSubject(e.target.value); setPage(0) }}
            style={{
              fontFamily: 'inherit', fontSize: '0.82rem', padding: '6px 10px',
              border: '1px solid var(--gray-200)', borderRadius: 8,
              background: 'var(--white)', color: 'var(--gray-700)', cursor: 'pointer',
            }}
          >
            <option value="">Todas as cadeiras</option>
            {SUBJECTS.map(s => <option key={s.key} value={s.key}>{s.emoji} {s.name}</option>)}
          </select>
          <input
            type="search"
            value={filterText}
            onChange={e => { setFilterText(e.target.value); setPage(0) }}
            placeholder="Pesquisar entradas…"
            style={{
              flex: 1, minWidth: 160, fontFamily: 'inherit', fontSize: '0.82rem',
              padding: '6px 10px', border: '1px solid var(--gray-200)',
              borderRadius: 8, background: 'var(--white)', color: 'var(--gray-700)',
            }}
          />
        </div>
      )}

      {/* Entries list */}
      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="e-emoji">📓</div>
          <p>Sem entradas ainda. Escreve sobre o teu estudo de hoje!</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="e-emoji">🔍</div>
          <p>Nenhuma entrada corresponde à pesquisa.</p>
        </div>
      ) : (
        <>
          {paginated.map(entry => {
            const subj    = SUBJECTS.find(s => s.key === entry.subject)
            const isOpen  = expanded === entry.id
            const isReanalysing = reanalysing === entry.id
            return (
              <div key={entry.id} style={{
                background: 'var(--white)', border: '1px solid var(--gray-200)',
                borderRadius: 'var(--radius)', marginBottom: 12,
                boxShadow: 'var(--shadow-xs)', overflow: 'hidden',
              }}>
                {/* Header */}
                <div
                  style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                >
                  <span style={{ fontSize: '1.1rem' }}>{subj?.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--gray-800)' }}>
                      {subj?.name}
                    </span>
                    <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', margin: 0 }}>
                      {entry.date} às {entry.time}
                    </p>
                  </div>
                  <p style={{
                    fontSize: '0.82rem', color: 'var(--gray-500)',
                    flex: 2, margin: 0, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.text}
                  </p>
                  <button className="btn btn-ghost" onClick={e => { e.stopPropagation(); removeEntry(entry.id) }}>
                    <Trash2 size={13} />
                  </button>
                  {isOpen ? <ChevronUp size={16} color="var(--gray-400)" /> : <ChevronDown size={16} color="var(--gray-400)" />}
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--gray-100)', padding: '16px' }}>
                    <div style={{
                      background: 'var(--gray-50)', borderRadius: 8,
                      padding: '12px 14px', marginBottom: 14,
                      fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--gray-700)',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {entry.text}
                    </div>

                    <div style={{
                      background: '#f5f3ff', border: '1px solid #ddd6fe',
                      borderRadius: 10, padding: '14px 16px',
                      fontSize: '0.88rem', lineHeight: 1.65,
                      color: 'var(--gray-700)', whiteSpace: 'pre-wrap',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <p style={{ fontWeight: 700, fontSize: '0.78rem', color: '#7c3aed', margin: 0, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                          ✨ Orientação da IA
                        </p>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#7c3aed' }}
                          onClick={() => reanalyseEntry(entry)}
                          disabled={isReanalysing}
                        >
                          {isReanalysing
                            ? <><span className="dots"><span /><span /><span /></span> A re-analisar...</>
                            : <><Sparkles size={11} /> Re-analisar</>
                          }
                        </button>
                      </div>
                      {entry.advice}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                ‹ Anterior
              </button>
              <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                {page + 1} / {totalPages}
              </span>
              <button
                className="btn btn-secondary"
                style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Seguinte ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}