import { useState, useEffect } from 'react'
import { Sparkles, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { getMondayOfWeek } from '../utils/dates'

const QUESTIONS = [
  { id: 'done',       label: 'O que conseguiste fazer esta semana?',                placeholder: 'Ex: Fiz as fichas de Genética, estudei 3h de Cálculo...' },
  { id: 'notdone',    label: 'O que não conseguiste fazer e porquê?',              placeholder: 'Ex: Não revi os flashcards de Filosofia porque estava cansada...' },
  { id: 'understood', label: 'O que percebeste bem esta semana?',                  placeholder: 'Ex: Finalmente percebi a matéria de transcrição...' },
  { id: 'struggling', label: 'Com o que ainda tens dificuldade?',                  placeholder: 'Ex: Ainda não percebo bem os limites em Cálculo...' },
  { id: 'feeling',    label: 'Como te sentiste esta semana em relação ao estudo?', placeholder: 'Ex: Senti-me motivada mas um pouco sobrecarregada...' },
  { id: 'nextweek',   label: 'O que queres melhorar na próxima semana?',           placeholder: 'Ex: Quero ser mais consistente com os flashcards...' },
]

function loadReviews()  { try { return JSON.parse(localStorage.getItem('weekly-reviews')) || [] } catch { return [] } }
function saveReviews(r) { localStorage.setItem('weekly-reviews', JSON.stringify(r)) }
function loadSessions() { try { return JSON.parse(localStorage.getItem('study-sessions')) || [] } catch { return [] } }
function loadDiary()    { try { return JSON.parse(localStorage.getItem('diary-entries')) || [] } catch { return [] } }

function getWeekNumber() {
  try {
    const settings = JSON.parse(localStorage.getItem('user-settings'))
    const start = settings?.periodStart ? new Date(settings.periodStart) : new Date('2026-02-03')
    return Math.max(1, Math.ceil((new Date() - start) / (7 * 86400000)))
  } catch {
    return 1
  }
}

function hoursThisWeek() {
  const monday = getMondayOfWeek(new Date())
  return loadSessions()
    .filter(s => new Date(s.date) >= monday)
    .reduce((a, b) => a + b.hours, 0)
    .toFixed(1)
}

function getDiaryThisWeek() {
  return loadDiary().slice(0, 14)
}

function todayKey() {
  return new Date().toDateString()
}

function alreadyGeneratedToday(reviews) {
  return reviews.some(r => r.generatedOn === todayKey())
}

const GROQ_MODEL = 'llama-3.3-70b-versatile'

async function callGroq(prompt) {
  const apiKey = localStorage.getItem('groq-key') || ''
  if (!apiKey) throw new Error('NO_API_KEY')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Erro na API')
  return data.choices?.[0]?.message?.content || ''
}

async function generateAutoReview(weekNum, weekHours, diaryEntries) {
  const diaryText = diaryEntries.length > 0
    ? diaryEntries.map(e => `[${e.subject || ''}] ${e.text}`).join('\n')
    : 'Sem entradas no diário esta semana.'

  const prompt = `És um coach de estudo caloroso e direto. Com base nas entradas do diário de estudo desta semana, gera uma review diária das 16h.

Semana número: ${weekNum}
Horas estudadas esta semana: ${weekHours}h
Entradas do diário desta semana:
${diaryText}

Gera uma review com EXATAMENTE esta estrutura em português:

💡 DICA PARA HOJE
[Uma dica concreta e específica para o resto do dia de hoje, com base no que foi estudado]

📅 FOCO DA SEMANA
[Uma orientação para os próximos dias desta semana]

✅ O QUE ESTÁ A CORRER BEM
[Um ponto positivo específico]

⚠️ ÁREA A MELHORAR
[Um ponto de melhoria específico e acionável]

🎯 AÇÃO PRIORITÁRIA
[A tarefa mais importante para fazer a seguir]

Sê específica, prática e encorajadora. Máx 2 frases por secção. Usa os emojis indicados.`

  return callGroq(prompt)
}

export function WeeklyReview() {
  const [reviews, setReviews]         = useState(loadReviews)
  const [autoLoading, setAutoLoading] = useState(false)
  const [autoError, setAutoError]     = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [showManual, setShowManual]   = useState(false)
  const [step, setStep]               = useState(0)
  const [answers, setAnswers]         = useState({})
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState(null)

  const weekNum   = getWeekNumber()
  const weekHours = hoursThisWeek()
  const todayReview = reviews.find(r => r.generatedOn === todayKey())
  const now = new Date()
  const isAfter4pm = now.getHours() >= 16

  useEffect(() => { saveReviews(reviews) }, [reviews])

  // Auto-generate at 16h if not already done today
  useEffect(() => {
    if (!isAfter4pm) return
    if (alreadyGeneratedToday(reviews)) return

    const generate = async () => {
      setAutoLoading(true)
      try {
        const diary = getDiaryThisWeek()
        const feedback = await generateAutoReview(weekNum, weekHours, diary)
        const review = {
          id: Date.now(),
          week: weekNum,
          type: 'auto',
          feedback,
          generatedOn: todayKey(),
          date: new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }),
          hoursThisWeek: weekHours,
        }
        setReviews(prev => [review, ...prev])
        setAutoError(null)
      } catch (e) {
        setAutoError(e.message === 'NO_API_KEY' ? 'Configura a tua chave API Groq nas Definições.' : `Erro: ${e.message}`)
      } finally { setAutoLoading(false) }
    }

    generate()
  }, [])

  const generateManualReview = async () => {
    const allAnswered = QUESTIONS.every(q => answers[q.id]?.trim())
    if (!allAnswered) return
    setManualLoading(true)

    const answersText = QUESTIONS.map(q => `${q.label}\n"${answers[q.id]}"`).join('\n\n')
    const prompt = `És um coach de estudo caloroso. Uma estudante preencheu a sua weekly review.

Semana ${weekNum} · ${weekHours}h estudadas

${answersText}

Gera uma review com EXATAMENTE esta estrutura em português:

💡 DICA PARA HOJE
[Uma dica concreta para o resto do dia]

📅 FOCO DA SEMANA
[Orientação para os próximos dias]

✅ O QUE ESTÁ A CORRER BEM
[Um ponto positivo específico das respostas dela]

⚠️ ÁREA A MELHORAR
[Um ponto de melhoria específico e acionável]

🎯 AÇÃO PRIORITÁRIA
[A tarefa mais importante para fazer a seguir]

Máx 2 frases por secção. Usa os emojis indicados. Refere as respostas dela especificamente.`

    try {
      const feedback = await callGroq(prompt)
      const review = {
        id: Date.now(),
        week: weekNum,
        type: 'manual',
        answers,
        feedback,
        generatedOn: todayKey(),
        date: new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }),
        hoursThisWeek: weekHours,
      }
      setReviews(prev => [review, ...prev])
      setShowManual(false)
      setAnswers({})
      setStep(0)
      setManualError(null)
    } catch (e) {
      setManualError(e.message === 'NO_API_KEY' ? 'Configura a tua chave API Groq nas Definições.' : `Erro: ${e.message}`)
    } finally { setManualLoading(false) }
  }

  const renderFeedback = (feedback) => {
    const sections = feedback.split('\n\n').filter(Boolean)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sections.map((section, i) => {
          const lines = section.split('\n')
          const title = lines[0]
          const body  = lines.slice(1).join('\n')
          const colors = [
            { bg: '#fefce8', border: '#fde047', text: '#854d0e' },
            { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' },
            { bg: '#f0fdf4', border: '#86efac', text: '#14532d' },
            { bg: '#fff7ed', border: '#fdba74', text: '#9a3412' },
            { bg: '#f5f3ff', border: '#c4b5fd', text: '#5b21b6' },
          ]
          const c = colors[i % colors.length]
          return (
            <div key={i} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ fontWeight: 800, fontSize: '0.82rem', color: c.text, marginBottom: 4 }}>{title}</p>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: c.text, margin: 0, opacity: 0.85 }}>{body}</p>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>🔁 Weekly Review</h1>
        <p className="subtitle">
          {isAfter4pm
            ? 'Review automática gerada com base no teu diário de estudo'
            : `Review automática disponível às 16h · agora são ${now.getHours()}h${String(now.getMinutes()).padStart(2,'0')}`}
        </p>
      </div>

      {/* Auto review of today */}
      {autoLoading && (
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 'var(--radius)', padding: '20px', marginBottom: 20, textAlign: 'center' }}>
          <p style={{ color: '#7c3aed', fontWeight: 600 }}>✨ A gerar a tua review das 16h...</p>
        </div>
      )}

      {autoError && !autoLoading && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 20 }}>
          <p style={{ fontSize: '0.83rem', color: '#dc2626', fontWeight: 600 }}>⚠️ {autoError}</p>
        </div>
      )}

      {todayReview && !autoLoading && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--gray-800)', marginBottom: 2 }}>
                ✨ Review de hoje — Semana {todayReview.week}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{todayReview.date} · {todayReview.hoursThisWeek}h estudadas</p>
            </div>
          </div>
          {renderFeedback(todayReview.feedback)}
        </div>
      )}

      {/* Manual review button */}
      {!showManual && (
        <button
          className="btn btn-secondary"
          onClick={() => setShowManual(true)}
          style={{ marginBottom: 20, width: '100%', justifyContent: 'center' }}
        >
          <Sparkles size={14} /> Fazer review manual detalhada
        </button>
      )}

      {/* Manual review form */}
      {showManual && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '24px', marginBottom: 20, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--gray-800)' }}>Review manual — Semana {weekNum}</p>
            <button className="btn btn-ghost" onClick={() => { setShowManual(false); setAnswers({}); setStep(0) }}>
              <RotateCcw size={13} /> Cancelar
            </button>
          </div>

          {/* Progress */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
            {QUESTIONS.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 50, background: i <= step ? 'var(--rose-400)' : 'var(--gray-200)', cursor: i < step ? 'pointer' : 'default', transition: 'background 0.2s' }} onClick={() => i < step && setStep(i)} />
            ))}
          </div>

          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--rose-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            {step + 1} / {QUESTIONS.length}
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-800)', marginBottom: 14, lineHeight: 1.4 }}>
            {QUESTIONS[step].label}
          </p>
          <textarea
            rows={4}
            placeholder={QUESTIONS[step].placeholder}
            value={answers[QUESTIONS[step].id] || ''}
            onChange={e => setAnswers(prev => ({ ...prev, [QUESTIONS[step].id]: e.target.value }))}
            autoFocus
            style={{ width: '100%', fontFamily: 'inherit', fontSize: '0.9rem', border: '1.5px solid var(--gray-200)', borderRadius: 10, padding: '12px 14px', outline: 'none', background: 'var(--gray-50)', color: 'var(--gray-900)', resize: 'vertical', lineHeight: 1.6, marginBottom: 14, boxSizing: 'border-box' }}
          />
          {manualError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
              <p style={{ fontSize: '0.83rem', color: '#dc2626', fontWeight: 600, margin: 0 }}>⚠️ {manualError}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>← Anterior</button>
            )}
            {step < QUESTIONS.length - 1 ? (
              <button className="btn btn-primary" onClick={() => setStep(s => s + 1)} disabled={!answers[QUESTIONS[step].id]?.trim()} style={{ flex: 1, justifyContent: 'center' }}>
                Seguinte →
              </button>
            ) : (
              <button className="btn btn-primary" onClick={generateManualReview} disabled={manualLoading || !QUESTIONS.every(q => answers[q.id]?.trim())} style={{ flex: 1, justifyContent: 'center', background: '#8b5cf6' }}>
                {manualLoading ? <><span className="dots"><span /><span /><span /></span> A gerar...</> : <><Sparkles size={14} /> Gerar review</>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {reviews.filter(r => r.generatedOn !== todayKey()).length > 0 && (
        <div>
          <button onClick={() => setShowHistory(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: 12, padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Reviews anteriores ({reviews.filter(r => r.generatedOn !== todayKey()).length})
          </button>
          {showHistory && reviews.filter(r => r.generatedOn !== todayKey()).map(review => (
            <div key={review.id} style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 12, boxShadow: 'var(--shadow-xs)' }}>
              <p style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--gray-700)', marginBottom: 2 }}>Semana {review.week} · {review.type === 'auto' ? '⚡ automática' : '✍️ manual'}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginBottom: 12 }}>{review.date} · {review.hoursThisWeek}h</p>
              {renderFeedback(review.feedback)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}