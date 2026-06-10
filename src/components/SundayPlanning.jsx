import { useState } from 'react'
import { Sparkles, ChevronLeft, ChevronRight, X } from 'lucide-react'

const GROQ_MODEL = 'llama-3.3-70b-versatile'

function loadContext() {
  try {
    const settings = JSON.parse(localStorage.getItem('user-settings') || '{}')
    const sessions = JSON.parse(localStorage.getItem('study-sessions') || '[]')
    const exams    = JSON.parse(localStorage.getItem('exams') || '[]')

    const monday = new Date(); monday.setHours(0,0,0,0)
    monday.setDate(monday.getDate() - (monday.getDay() || 7) + 1)
    const weekH = parseFloat(sessions.filter(s => new Date(s.date) >= monday).reduce((a, b) => a + (b.hours || 0), 0).toFixed(1))

    const upcomingExams = exams.filter(e => {
      const diff = Math.round((new Date(e.date + 'T12:00:00') - new Date()) / 86400000)
      return diff >= 0 && diff <= 21
    }).sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(e => {
        const diff = Math.round((new Date(e.date + 'T12:00:00') - new Date()) / 86400000)
        return `${e.subject} (${e.type} em ${diff} dias)`
      })

    return {
      subjects: (settings.subjects || []).map(s => s.name),
      weekH,
      upcomingExams,
      name: settings.name || '',
    }
  } catch { return { subjects: [], weekH: 0, upcomingExams: [] } }
}

const STEPS = [
  {
    id: 'lookback',
    emoji: '🔍',
    title: 'Retrospetiva',
    question: 'O que correu bem esta semana e o que queres melhorar?',
    placeholder: 'Ex: Fui consistente com Biologia, mas negligenciei Cálculo. Quero melhorar o foco nas manhãs.',
  },
  {
    id: 'priority',
    emoji: '🎯',
    title: 'Prioridades da semana',
    question: 'Quais são as 3 prioridades de estudo para esta semana?',
    placeholder: 'Ex: 1. Preparar exame de Genética (sexta). 2. Ficha de Cálculo (quarta). 3. Rever apontamentos de Filosofia.',
  },
  {
    id: 'schedule',
    emoji: '📅',
    title: 'Planeamento de dias',
    question: 'Que dias tens mais disponibilidade? Como vais distribuir o estudo?',
    placeholder: 'Ex: Seg/Ter livres para estudo intensivo. Qua tenho aula até às 18h. Qui/Sex mais leve. Sáb manhã de revisão.',
  },
  {
    id: 'obstacle',
    emoji: '🚧',
    title: 'Obstáculos',
    question: 'O que pode dificultar o teu plano esta semana? Como vais lidar?',
    placeholder: 'Ex: Tenho jantar na quarta. Se ficar para trás, estudo de manhã cedo ao sábado.',
  },
  {
    id: 'intention',
    emoji: '✨',
    title: 'Intenção da semana',
    question: 'Qual é a tua intenção principal para esta semana? (Uma frase)',
    placeholder: 'Ex: Esta semana foco-me em qualidade, não em quantidade. Uma hora de estudo concentrado vale mais do que três distraída.',
  },
]

function savePlan(plan) {
  try {
    const plans = JSON.parse(localStorage.getItem('weekly-plans') || '[]')
    localStorage.setItem('weekly-plans', JSON.stringify([plan, ...plans.slice(0, 9)]))
  } catch {}
}

export function SundayPlanning({ onClose }) {
  const ctx = loadContext()
  const [step, setStep]       = useState(0)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [plan, setPlan]       = useState(null)

  const current = STEPS[step]
  const isLast  = step === STEPS.length - 1
  const allDone = STEPS.every(s => answers[s.id]?.trim())

  const generate = async () => {
    const apiKey = localStorage.getItem('groq-key')
    if (!apiKey) {
      alert('Adiciona a tua Groq API key nas Definições do AI Chat.')
      return
    }
    setLoading(true)

    const answersText = STEPS.map(s => `**${s.title}**: ${answers[s.id]}`).join('\n\n')
    const examsText = ctx.upcomingExams.length > 0 ? `Exames próximos: ${ctx.upcomingExams.join(', ')}` : 'Sem exames próximos.'
    const prompt = `És uma coach de estudo calorosa. Uma estudante está a fazer o planeamento semanal de domingo.

Contexto:
- Cadeiras: ${ctx.subjects.join(', ') || 'não especificadas'}
- Horas estudadas esta semana: ${ctx.weekH}h
- ${examsText}

Respostas da estudante:
${answersText}

Gera um plano semanal com EXATAMENTE esta estrutura em português:

🎯 FOCO DESTA SEMANA
[Uma frase clara sobre o objetivo principal]

📅 PLANO DIA A DIA
[Sugestão concreta para cada dia útil: Seg, Ter, Qua, Qui, Sex. Máx 1-2 frases por dia.]

⚡ TOP 3 TAREFAS
[As 3 tarefas mais importantes, numeradas, específicas]

💪 MANTRA DA SEMANA
[Uma frase motivacional personalizada baseada nas respostas]

Sê específica, prática e usa as informações que ela deu. Máx 3 frases por secção.`

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: GROQ_MODEL, max_tokens: 700, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const content = res.ok ? data.choices[0].message.content : 'Erro ao gerar plano. Verifica a tua API key.'
      const newPlan = {
        id: Date.now(),
        date: new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }),
        answers,
        content,
        weekH: ctx.weekH,
      }
      savePlan(newPlan)
      setPlan(content)
    } catch {
      setPlan('Não foi possível ligar ao servidor. Verifica a tua ligação à internet.')
    } finally {
      setLoading(false)
    }
  }

  const colors = ['var(--amber-100)', 'var(--blue-100)', 'var(--green-50)', 'var(--orange-50)', 'var(--purple-50)']
  const borderColors = ['#fde047', '#93c5fd', '#86efac', '#fdba74', '#c4b5fd']
  const textColors = ['#854d0e', '#1e40af', '#14532d', '#9a3412', '#5b21b6']

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 9990, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--white)', borderRadius: 'var(--r)', width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--gray-800)', margin: 0 }}>🗓️ Planeamento de Domingo</p>
            <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', margin: 0, marginTop: 2 }}>
              {ctx.weekH}h esta semana{ctx.upcomingExams.length > 0 ? ` · ${ctx.upcomingExams.length} exame${ctx.upcomingExams.length !== 1 ? 's' : ''} próximo${ctx.upcomingExams.length !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {plan ? (
            <>
              <div style={{ marginBottom: 20 }}>
                {plan.split('\n\n').filter(Boolean).map((section, i) => {
                  const lines = section.split('\n')
                  const title = lines[0]
                  const body = lines.slice(1).join('\n')
                  const c = { bg: colors[i % colors.length], border: borderColors[i % borderColors.length], text: textColors[i % textColors.length] }
                  return (
                    <div key={i} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 10 }}>
                      <p style={{ fontWeight: 800, fontSize: 'var(--t-body)', color: c.text, marginBottom: 4 }}>{title}</p>
                      <p style={{ fontSize: 'var(--t-body)', lineHeight: 1.6, color: c.text, margin: 0, opacity: 0.85, whiteSpace: 'pre-wrap' }}>{body}</p>
                    </div>
                  )
                })}
              </div>
              <button className="btn btn-primary" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
                Fechar e começar a semana 💪
              </button>
            </>
          ) : (
            <>
              {/* Progress bar */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                {STEPS.map((s, i) => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 50, background: i <= step ? 'var(--rose-400)' : 'var(--gray-100)', cursor: i < step ? 'pointer' : 'default', transition: 'background 0.2s' }} onClick={() => i < step && setStep(i)} />
                ))}
              </div>

              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--rose-400)', letterSpacing: 0.5, marginBottom: 6 }}>
                  {current.emoji} {current.title} · {step + 1}/{STEPS.length}
                </p>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-800)', marginBottom: 14, lineHeight: 1.4 }}>
                  {current.question}
                </p>
                {ctx.upcomingExams.length > 0 && step === 1 && (
                  <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: 10, fontSize: 'var(--t-caption)', color: '#854d0e', fontWeight: 600 }}>
                    💡 Exames próximos: {ctx.upcomingExams.join(' · ')}
                  </div>
                )}
                <textarea
                  rows={4}
                  placeholder={current.placeholder}
                  value={answers[current.id] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [current.id]: e.target.value }))}
                  autoFocus
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: 'var(--t-body)', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--r)', padding: '12px 14px', outline: 'none', background: 'var(--gray-50)', color: 'var(--gray-900)', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {step > 0 && (
                  <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>
                    <ChevronLeft size={14} /> Anterior
                  </button>
                )}
                {!isLast ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => setStep(s => s + 1)}
                    disabled={!answers[current.id]?.trim()}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Próximo <ChevronRight size={14} />
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={generate}
                    disabled={loading || !allDone}
                    style={{ flex: 1, justifyContent: 'center', background: '#8b5cf6' }}
                  >
                    {loading
                      ? <><span className="dots"><span /><span /><span /></span> A gerar plano...</>
                      : <><Sparkles size={14} /> Gerar plano da semana</>
                    }
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
