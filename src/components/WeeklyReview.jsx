import { useState, useEffect } from 'react'
import { Sparkles, ChevronDown, ChevronUp, RotateCcw, Mail } from 'lucide-react'
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
function loadPlans()    { try { return JSON.parse(localStorage.getItem('weekly-plans')) || [] } catch { return [] } }
function loadSettings() { try { return JSON.parse(localStorage.getItem('user-settings')) || {} } catch { return {} } }

function loadDoubtsContext() {
  try {
    const settings = loadSettings()
    const subjects = settings.subjects || []
    const topics = JSON.parse(localStorage.getItem('topics') || '{}')
    const lines = []
    for (const s of subjects) {
      const subTopics = topics[s.key] || topics[s.name] || []
      const withDoubts = subTopics.filter(t => {
        const d = t.doubts
        if (!d) return false
        if (typeof d === 'string') return d.trim().length > 0
        return d.length > 0
      })
      if (withDoubts.length === 0) continue
      lines.push(`${s.emoji || ''} ${s.name}:`)
      for (const t of withDoubts) {
        const doubts = typeof t.doubts === 'string'
          ? [t.doubts]
          : t.doubts.map(d => d.text || d)
        lines.push(`  Tópico "${t.name}": ${doubts.map(d => `"${d}"`).join(', ')}`)
      }
    }
    if (lines.length === 0) return ''
    return `\nDÚVIDAS EM ABERTO POR TÓPICO:\n${lines.join('\n')}`
  } catch { return '' }
}

function getWeekNumber() {
  try {
    const settings = loadSettings()
    const start = settings?.periodStart ? new Date(settings.periodStart) : new Date('2026-02-03')
    return Math.max(1, Math.ceil((new Date() - start) / (7 * 86400000)))
  } catch {
    return 1
  }
}

function getWeeklyStats() {
  const monday = getMondayOfWeek(new Date())
  const sessions = loadSessions()
  const weekSessions = sessions.filter(s => new Date(s.date) >= monday)
  const totalHours = weekSessions.reduce((a, b) => a + (b.hours || 0), 0).toFixed(1)
  const bySubject = {}
  for (const s of weekSessions) {
    bySubject[s.subject] = (bySubject[s.subject] || 0) + (s.hours || 0)
  }
  return { totalHours, bySubject }
}

function getDiaryThisWeek() {
  const monday = getMondayOfWeek(new Date())
  return loadDiary().filter(e => new Date(e.date || e.createdAt) >= monday).slice(0, 20)
}

function getSessionNotesThisWeek() {
  const monday = getMondayOfWeek(new Date())
  const notes = loadSessions()
    .filter(s => new Date(s.date) >= monday && s.notes?.trim())
    .map(s => `[${s.subject} · ${s.hours}h] ${s.notes.trim()}`)
  if (notes.length === 0) return ''
  return `\nNOTAS DAS SESSÕES DESTA SEMANA:\n${notes.join('\n')}`
}

function todayKey() {
  return new Date().toDateString()
}

function alreadyGeneratedToday(reviews) {
  return reviews.some(r => r.generatedOn === todayKey())
}

function openEmail(to, subject, body) {
  const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url)
  } else {
    window.location.href = url
  }
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
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Erro na API')
  return data.choices?.[0]?.message?.content || ''
}

function buildPlanContext(plan) {
  if (!plan) return ''
  return `
PLANO DA SEMANA (feito no domingo):
🔍 Retrospetiva: ${plan.answers?.lookback || '—'}
🎯 Prioridades: ${plan.answers?.priority || '—'}
📅 Distribuição: ${plan.answers?.schedule || '—'}
🚧 Obstáculos: ${plan.answers?.obstacle || '—'}
✨ Intenção: ${plan.answers?.intention || '—'}`
}

async function generateAutoReview(weekNum, weekStats, diaryEntries, latestPlan) {
  const diaryText = diaryEntries.length > 0
    ? diaryEntries.map(e => `[${e.subject || 'geral'}] ${e.text}`).join('\n')
    : 'Sem entradas no diário esta semana.'

  const subjectStats = Object.entries(weekStats.bySubject)
    .map(([k, h]) => `${k}: ${h.toFixed(1)}h`)
    .join(', ') || 'Sem registos por cadeira'

  const planContext = buildPlanContext(latestPlan)
  const doubtsCtx = loadDoubtsContext()
  const sessionNotes = getSessionNotesThisWeek()

  const prompt = `És um coach de estudo caloroso e direto. Com base no plano semanal e no diário de estudo, gera uma review de fim de dia.

Semana número: ${weekNum}
Horas estudadas esta semana: ${weekStats.totalHours}h
Por cadeira: ${subjectStats}
${planContext}

Entradas do diário desta semana:
${diaryText}
${sessionNotes}
${doubtsCtx}

${latestPlan ? 'Compara o que foi planeado com o que foi realmente feito.' : ''}
${doubtsCtx ? 'Considera as dúvidas em aberto por tópico ao dar conselhos — menciona-as se forem relevantes para a ação prioritária ou área a melhorar.' : ''}

Gera uma review com EXATAMENTE esta estrutura em português:

💡 DICA PARA HOJE
[Uma dica concreta e específica para o resto do dia de hoje]

📅 FOCO DA SEMANA
[Uma orientação para os próximos dias, considerando o plano]

✅ O QUE ESTÁ A CORRER BEM
[Um ponto positivo específico]

⚠️ ÁREA A MELHORAR
[Um ponto de melhoria específico e acionável]

🎯 AÇÃO PRIORITÁRIA
[A tarefa mais importante para fazer a seguir]

Sê específica, prática e encorajadora. Máx 2 frases por secção.`

  return callGroq(prompt)
}

async function generateEmailReport(weekNum, weekStats, diaryEntries, latestPlan, manualAnswers) {
  const diaryBySubject = {}
  for (const e of diaryEntries) {
    const key = e.subject || 'Geral'
    if (!diaryBySubject[key]) diaryBySubject[key] = []
    diaryBySubject[key].push(e.text)
  }
  const diaryText = Object.entries(diaryBySubject)
    .map(([subj, entries]) => `${subj}:\n${entries.map(t => `  - ${t}`).join('\n')}`)
    .join('\n\n') || 'Sem entradas no diário.'

  const subjectStats = Object.entries(weekStats.bySubject)
    .map(([k, h]) => `${k}: ${h.toFixed(1)}h`)
    .join(', ') || 'Sem registos'

  const planContext = buildPlanContext(latestPlan)
  const doubtsCtx = loadDoubtsContext()
  const sessionNotes = getSessionNotesThisWeek()

  const reviewAnswers = manualAnswers
    ? QUESTIONS.map(q => `${q.label}\n"${manualAnswers[q.id] || '—'}"`).join('\n\n')
    : ''

  const prompt = `És um coach de estudo. Gera um relatório semanal completo e detalhado em português.

Semana ${weekNum} · ${weekStats.totalHours}h estudadas
Por cadeira: ${subjectStats}
${planContext}

Entradas do diário por cadeira:
${diaryText}
${sessionNotes}
${doubtsCtx}

${reviewAnswers ? `Reflexão da estudante:\n${reviewAnswers}` : ''}
${doubtsCtx ? 'Inclui as dúvidas em aberto na análise por cadeira e nas ações para a próxima semana.' : ''}

Gera um relatório com EXATAMENTE esta estrutura (em português, sem markdown extra):

📊 RESUMO DA SEMANA ${weekNum}
[2-3 frases a resumir a semana com dados concretos de horas e cadeiras]

🎯 PLANO VS REALIDADE
[Compara as prioridades planeadas com o que foi feito. Sê honesta e específica.]

✅ CONQUISTAS
[2-3 pontos positivos concretos desta semana]

⚠️ ÁREAS DE MELHORIA
[2-3 pontos de melhoria específicos e acionáveis]

📈 ANÁLISE POR CADEIRA
[Para cada cadeira com horas registadas: progresso, tendência, recomendação]

🎯 PLANO PARA A PRÓXIMA SEMANA
[3-4 ações concretas baseadas na análise]

✨ MENSAGEM DE ENCORAJAMENTO
[Uma frase inspiradora personalizada]

Sê específica, usa os dados reais, e dá conselhos acionáveis.`

  return callGroq(prompt)
}

export function WeeklyReview() {
  const [reviews, setReviews]             = useState(loadReviews)
  const [autoLoading, setAutoLoading]     = useState(false)
  const [autoError, setAutoError]         = useState(null)
  const [showHistory, setShowHistory]     = useState(false)
  const [showManual, setShowManual]       = useState(false)
  const [step, setStep]                   = useState(0)
  const [answers, setAnswers]             = useState({})
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError]     = useState(null)
  const [emailLoading, setEmailLoading]   = useState(null)

  const weekNum    = getWeekNumber()
  const weekStats  = getWeeklyStats()
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
        const latestPlan = loadPlans()[0] || null
        const feedback = await generateAutoReview(weekNum, weekStats, diary, latestPlan)
        const review = {
          id: Date.now(),
          week: weekNum,
          type: 'auto',
          feedback,
          generatedOn: todayKey(),
          date: new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }),
          hoursThisWeek: weekStats.totalHours,
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

    const latestPlan = loadPlans()[0] || null
    const planContext = buildPlanContext(latestPlan)
    const answersText = QUESTIONS.map(q => `${q.label}\n"${answers[q.id]}"`).join('\n\n')
    const doubtsCtx = loadDoubtsContext()
    const sessionNotes = getSessionNotesThisWeek()

    const prompt = `És um coach de estudo caloroso. Uma estudante preencheu a sua weekly review.

Semana ${weekNum} · ${weekStats.totalHours}h estudadas
${planContext}

Reflexão da estudante:
${answersText}
${sessionNotes}
${doubtsCtx}

${latestPlan ? 'Compara as prioridades planeadas no domingo com as respostas da estudante.' : ''}
${doubtsCtx ? 'Considera as dúvidas em aberto por tópico — se forem relevantes para a ação prioritária ou área a melhorar, menciona-as explicitamente.' : ''}

Gera uma review com EXATAMENTE esta estrutura em português:

💡 DICA PARA HOJE
[Uma dica concreta para o resto do dia]

📅 FOCO DA SEMANA
[Orientação para os próximos dias, considerando o plano e as respostas]

✅ O QUE ESTÁ A CORRER BEM
[Um ponto positivo específico das respostas dela]

⚠️ ÁREA A MELHORAR
[Um ponto de melhoria específico e acionável]

🎯 AÇÃO PRIORITÁRIA
[A tarefa mais importante para fazer a seguir]

Máx 2 frases por secção. Refere as respostas dela especificamente.`

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
        hoursThisWeek: weekStats.totalHours,
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

  const handleSendEmail = async (review) => {
    const settings = loadSettings()
    const { reviewEmail = '', smtpUser = '', smtpPass = '' } = settings
    if (!reviewEmail) { alert('Configura o email de destino nas Definições.'); return }

    setEmailLoading(review.id)
    try {
      const diary = getDiaryThisWeek()
      const latestPlan = loadPlans()[0] || null
      const report = await generateEmailReport(weekNum, weekStats, diary, latestPlan, review.answers)
      const subject = `Weekly Review — Semana ${review.week} (${review.date})`

      if (window.electronAPI?.sendEmail && smtpUser && smtpPass) {
        await window.electronAPI.sendEmail({ to: reviewEmail, subject, body: report, smtpUser, smtpPass })
        alert('Email enviado!')
      } else {
        openEmail(reviewEmail, subject, report)
      }
    } catch (e) {
      const isSmtpError = smtpUser && smtpPass
      if (isSmtpError) {
        alert(`Erro ao enviar email: ${e.message}\n\nVerifica as credenciais nas Definições.`)
      } else {
        const fallbackBody = `Weekly Review — Semana ${review.week}\n${review.date} · ${review.hoursThisWeek}h estudadas\n\n${review.feedback}`
        openEmail(reviewEmail, `Weekly Review — Semana ${review.week}`, fallbackBody)
      }
    } finally {
      setEmailLoading(null)
    }
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
            { bg: 'var(--amber-50)',  border: '#fde047', text: '#854d0e' },
            { bg: 'var(--blue-100)', border: '#93c5fd', text: '#1e40af' },
            { bg: 'var(--green-50)', border: '#86efac', text: '#14532d' },
            { bg: 'var(--orange-50)',border: '#fdba74', text: '#9a3412' },
            { bg: 'var(--purple-50)',border: '#c4b5fd', text: '#5b21b6' },
          ]
          const c = colors[i % colors.length]
          return (
            <div key={i} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 'var(--r)', padding: '12px 14px' }}>
              <p style={{ fontWeight: 800, fontSize: 'var(--t-body)', color: c.text, marginBottom: 4 }}>{title}</p>
              <p style={{ fontSize: 'var(--t-body)', lineHeight: 1.6, color: c.text, margin: 0, opacity: 0.85 }}>{body}</p>
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
            ? 'Review automática gerada com base no teu plano e diário de estudo'
            : `Review automática disponível às 16h · agora são ${now.getHours()}h${String(now.getMinutes()).padStart(2,'0')}`}
        </p>
      </div>

      {/* Auto review of today */}
      {autoLoading && (
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 'var(--r)', padding: '20px', marginBottom: 20, textAlign: 'center' }}>
          <p style={{ color: '#7c3aed', fontWeight: 600 }}>✨ A gerar a tua review das 16h...</p>
        </div>
      )}

      {autoError && !autoLoading && (
        <div style={{ background: 'var(--red-50)', border: '1px solid #fecaca', borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 20 }}>
          <p style={{ fontSize: 'var(--t-body)', color: '#dc2626', fontWeight: 600 }}>⚠️ {autoError}</p>
        </div>
      )}

      {todayReview && !autoLoading && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--r)', padding: '20px', marginBottom: 20, boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: 'var(--t-body)', color: 'var(--gray-800)', marginBottom: 2 }}>
                ✨ Review de hoje — Semana {todayReview.week}
              </p>
              <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>{todayReview.date} · {todayReview.hoursThisWeek}h estudadas</p>
            </div>
            <button
              className="btn btn-secondary"
              style={{ flexShrink: 0, fontSize: 'var(--t-caption)', display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={() => handleSendEmail(todayReview)}
              disabled={emailLoading === todayReview.id}
            >
              <Mail size={13} />
              {emailLoading === todayReview.id ? 'A enviar...' : 'Enviar relatório'}
            </button>
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
        <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--r)', padding: '24px', marginBottom: 20, boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p style={{ fontWeight: 700, fontSize: 'var(--t-body)', color: 'var(--gray-800)' }}>Review manual — Semana {weekNum}</p>
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

          <p style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--rose-400)', letterSpacing: 0.5, marginBottom: 8 }}>
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
            style={{ width: '100%', fontFamily: 'inherit', fontSize: 'var(--t-body)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--r)', padding: '12px 14px', outline: 'none', background: 'var(--gray-50)', color: 'var(--gray-900)', resize: 'vertical', lineHeight: 1.6, marginBottom: 14, boxSizing: 'border-box' }}
          />
          {manualError && (
            <div style={{ background: 'var(--red-50)', border: '1px solid #fecaca', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 12 }}>
              <p style={{ fontSize: 'var(--t-body)', color: '#dc2626', fontWeight: 600, margin: 0 }}>⚠️ {manualError}</p>
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
          <button onClick={() => setShowHistory(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 'var(--t-body)', color: 'var(--gray-500)', marginBottom: 12, padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Reviews anteriores ({reviews.filter(r => r.generatedOn !== todayKey()).length})
          </button>
          {showHistory && reviews.filter(r => r.generatedOn !== todayKey()).map(review => (
            <div key={review.id} style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--r)', padding: '16px 20px', marginBottom: 12, boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 'var(--t-body)', color: 'var(--gray-700)', marginBottom: 2 }}>Semana {review.week} · {review.type === 'auto' ? '⚡ automática' : '✍️ manual'}</p>
                  <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)' }}>{review.date} · {review.hoursThisWeek}h</p>
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 'var(--t-caption)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => handleSendEmail(review)}
                  disabled={emailLoading === review.id}
                >
                  <Mail size={12} />
                  {emailLoading === review.id ? 'A gerar...' : 'Enviar'}
                </button>
              </div>
              {renderFeedback(review.feedback)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
