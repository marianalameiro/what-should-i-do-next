import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Key, X, Trash2 } from 'lucide-react'

const GROQ_MODEL = 'llama-3.3-70b-versatile'
const HISTORY_KEY = 'ai-chat-history'
const MAX_HISTORY = 40 // messages to persist

const WELCOME = {
  role: 'assistant',
  content: 'Olá! Sou a tua assistente de estudo. Posso ajudar-te a estudar qualquer matéria, explicar conceitos, motivar-te, ou criar planos de estudo. O que precisas? 🌸',
}

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return saved.length > 0 ? saved : [WELCOME]
  } catch { return [WELCOME] }
}

function saveHistory(msgs) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY))) } catch {}
}

function buildSystemPrompt() {
  try {
    const settings = JSON.parse(localStorage.getItem('user-settings') || '{}')
    const sessions = JSON.parse(localStorage.getItem('study-sessions') || '[]')
    const exams = JSON.parse(localStorage.getItem('exams') || '[]')
    const pdfContext = localStorage.getItem('ai-pdf-context') || ''

    const todayStr = new Date().toDateString()
    const todayH = parseFloat(sessions.filter(s => s.date === todayStr).reduce((a,b) => a + (b.hours||0), 0).toFixed(1))

    const monday = new Date(); monday.setHours(0,0,0,0)
    monday.setDate(monday.getDate() - (monday.getDay() || 7) + 1)
    const weekH = parseFloat(sessions.filter(s => new Date(s.date) >= monday).reduce((a,b) => a + (b.hours||0), 0).toFixed(1))

    const days = new Set(sessions.map(s => s.date))
    let streak = 0; const d = new Date(); d.setHours(0,0,0,0)
    if (!days.has(d.toDateString())) d.setDate(d.getDate()-1)
    while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate()-1) }

    const upcomingExams = exams.filter(e => {
      const diff = Math.round((new Date(e.date+'T12:00:00') - new Date()) / 86400000)
      return diff >= 0 && diff <= 30
    }).sort((a,b) => new Date(a.date)-new Date(b.date)).slice(0,3)
      .map(e => `${e.subject} (${e.type} em ${new Date(e.date+'T12:00:00').toLocaleDateString('pt-PT', {day:'numeric',month:'short'})})`).join(', ')

    const subjectList = (settings.subjects || []).map(s => s.name).join(', ')
    const methodLines = (settings.subjects || []).filter(s => s.methods?.length).map(s => `${s.name}: ${s.methods.join(', ')}`).join('; ')
    const name = settings.name ? `O nome da estudante é ${settings.name}.` : ''

    let prompt = `És uma assistente de estudo pessoal calorosa, prática e encorajadora para uma estudante universitária. ${name}
Cadeiras: ${subjectList || 'não especificadas'}.${methodLines ? ` Métodos de estudo — ${methodLines}.` : ''}

CONTEXTO ATUAL (hoje ${new Date().toLocaleDateString('pt-PT')}):
- Horas estudadas hoje: ${todayH}h
- Horas esta semana: ${weekH}h
- Streak atual: ${streak} dia${streak !== 1 ? 's' : ''}${upcomingExams ? `\n- Próximos exames: ${upcomingExams}` : ''}
`
    if (pdfContext) {
      prompt += `\nCONTEXTO DE PDF ANALISADO:\n${pdfContext.slice(0, 1500)}\n`
    }
    prompt += `\nSê concisa, calorosa e usa 1-2 emojis. Responde no idioma em que a estudante escrever.`
    return prompt
  } catch {}
  return 'És uma assistente de estudo pessoal calorosa e encorajadora para uma estudante universitária. Sê concisa, prática e usa 1-2 emojis. Responde no idioma em que a estudante escrever.'
}

const QUICK_PROMPTS = [
  { label: '📊 Progresso', msg: 'Analisa o meu progresso de estudo e diz-me como estou a sair com base nas minhas horas e streak.' },
  { label: '🎯 O que estudar hoje?', msg: 'Com base nos meus exames e progresso, o que devo priorizar para estudar hoje?' },
  { label: '💡 Motivação', msg: 'Preciso de motivação para estudar. Dá-me 3 dicas concretas para manter o foco hoje.' },
  { label: '📅 Plano da semana', msg: 'Ajuda-me a criar um plano de estudo para esta semana com base nos meus exames próximos.' },
  { label: '🧠 Explicar conceito', msg: 'Explica-me um conceito que estou a estudar. Qual tema queres que explique?' },
]

export default function AIChat() {
  const [apiKey, setApiKey]     = useState(() => localStorage.getItem('groq-key') || '')
  const [keyInput, setKeyInput] = useState('')
  const [messages, setMessages] = useState(loadHistory)
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [pdfCtx, setPdfCtx]     = useState(() => !!localStorage.getItem('ai-pdf-context'))
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Persist history on every change
  useEffect(() => {
    saveHistory(messages)
  }, [messages])

  const saveKey = () => {
    if (!keyInput.trim()) return
    localStorage.setItem('groq-key', keyInput.trim())
    setApiKey(keyInput.trim())
    setKeyInput('')
  }

  const removeKey = () => {
    localStorage.removeItem('groq-key')
    setApiKey('')
  }

  const clearChat = () => {
    const fresh = [WELCOME]
    setMessages(fresh)
    saveHistory(fresh)
  }

  const removePdfCtx = () => {
    localStorage.removeItem('ai-pdf-context')
    setPdfCtx(false)
    setMessages(m => [...m]) // force re-render
  }

  const send = async (overrideInput) => {
    const text = (overrideInput ?? input).trim()
    if (!text || !apiKey || loading) return
    const userMsg = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            ...next.slice(-20), // send last 20 messages for context
          ],
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Erro: ' + (data?.error?.message || 'Algo correu mal. Verifica a tua API key.') }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.choices[0].message.content }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Não consegui ligar à API. Verifica a tua ligação à internet.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>✨ AI Chat</h1>
          <p className="subtitle">A tua assistente de estudo pessoal — powered by Groq (gratuito)</p>
        </div>
        {messages.length > 1 && (
          <button className="btn btn-ghost" style={{ fontSize: 'var(--t-caption)', marginTop: 4 }} onClick={clearChat} title="Limpar conversa">
            <Trash2 size={13} /> Limpar
          </button>
        )}
      </div>

      <div className="chat-wrap" style={{ flex: 1 }}>

        {!apiKey && (
          <div className="api-key-banner">
            <Key size={16} color="var(--purple-dark)" />
            <span className="api-key-label">Groq API Key</span>
            <input
              type="text"
              placeholder="gsk_..."
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveKey()}
            />
            <button className="btn btn-primary" onClick={saveKey}>Guardar</button>
            <span style={{ fontSize: 'var(--t-body)', color: 'var(--purple-dark)', fontWeight: 700 }}>
              Obtém a tua key em console.groq.com/keys
            </span>
          </div>
        )}

        {apiKey && (
          <div style={{ padding: '8px 16px', background: 'var(--rose-50)', borderBottom: '1.5px solid var(--rose-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--t-body)', color: 'var(--text-light)', fontWeight: 700 }}>Groq conectado 🌸</span>
            <button className="btn btn-ghost" style={{ fontSize: 'var(--t-caption)' }} onClick={removeKey}>Mudar key</button>
          </div>
        )}

        {pdfCtx && (
          <div style={{ padding: '8px 16px', background: 'var(--purple-50)', borderBottom: '1.5px solid var(--purple-200)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={14} color="var(--purple-dark)" />
            <span style={{ fontSize: 'var(--t-body)', color: 'var(--purple-dark)', fontWeight: 700, flex: 1 }}>Contexto de PDF carregado</span>
            <button className="btn btn-ghost" style={{ fontSize: 'var(--t-caption)', padding: '2px 8px' }} onClick={removePdfCtx}>
              <X size={12} /> Remover
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, padding: '10px 16px', flexWrap: 'wrap', borderBottom: '1px solid var(--rose-100)' }}>
          {QUICK_PROMPTS.map(qp => (
            <button
              key={qp.label}
              className="btn btn-ghost"
              style={{ fontSize: 'var(--t-caption)', padding: '4px 10px', borderRadius: 'var(--r-pill)' }}
              disabled={!apiKey || loading}
              onClick={() => send(qp.msg)}
            >
              {qp.label}
            </button>
          ))}
        </div>

        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.role === 'user' ? 'user' : 'ai'}`}>
              <div className="chat-avatar">{msg.role === 'user' ? '🙋' : '🌸'}</div>
              <div className="chat-bubble" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            </div>
          ))}

          {loading && (
            <div className="chat-msg ai">
              <div className="chat-avatar">🌸</div>
              <div className="chat-bubble"><span className="dots"><span /><span /><span /></span></div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="chat-input-row">
          <input
            type="text"
            placeholder={apiKey ? 'Escreve a tua mensagem...' : 'Adiciona a tua Groq API key primeiro'}
            value={input}
            disabled={!apiKey || loading}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
          />
          <button className="btn btn-primary" onClick={() => send()} disabled={!apiKey || loading || !input.trim()}>
            {loading ? <Sparkles size={16} /> : <Send size={16} />}
          </button>
        </div>

      </div>
    </div>
  )
}
