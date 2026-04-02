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

  const [entries, setEntries]     = useState(loadEntries)
  const [text, setText]           = useState('')
  const [subject, setSubject]     = useState(() => loadSubjects()[0]?.key || '')
  const [loading, setLoading]     = useState(false)
  const [expanded, setExpanded]   = useState(null)
  const [showReview, setShowReview] = useState(false)

  useEffect(() => { saveEntries(entries) }, [entries])

  const getAdvice = async (entryText, entrySubject) => {
    const apiKey = localStorage.getItem('groq-key')
    if (!apiKey) return 'Adiciona a tua Groq API key no AI Chat primeiro.'

    setLoading(true)
    const subj = SUBJECTS.find(s => s.key === entrySubject)

    const prompt = `You are a warm and practical study coach for a university student studying ${subj?.name}.

She wrote the following diary entry about her study session today:
"${entryText}"

Based on what she wrote, give her:
1. A brief empathetic acknowledgment of how she is feeling
2. 2-3 concrete and specific actions she should take next to improve or continue her progress
3. One encouraging sentence

Be warm, direct, and practical. Keep it to 5-6 sentences max. Use 1-2 emojis. Answer in Portuguese.`

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
      setLoading(false)
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

      {/* Entries list */}
      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="e-emoji">📓</div>
          <p>Sem entradas ainda. Escreve sobre o teu estudo de hoje!</p>
        </div>
      ) : (
        entries.map(entry => {
          const subj    = SUBJECTS.find(s => s.key === entry.subject)
          const isOpen  = expanded === entry.id
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
                    <p style={{ fontWeight: 700, fontSize: '0.78rem', color: '#7c3aed', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      ✨ Orientação da IA
                    </p>
                    {entry.advice}
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}