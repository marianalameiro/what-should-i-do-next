import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Key } from 'lucide-react'

const GROQ_MODEL = 'llama-3.3-70b-versatile'

function buildSystemPrompt() {
  try {
    const settings = JSON.parse(localStorage.getItem('user-settings'))
    if (settings?.subjects?.length) {
      const subjectList = settings.subjects.map(s => s.name).join(', ')
      const methodLines = settings.subjects
        .filter(s => s.methods?.length)
        .map(s => `${s.name}: ${s.methods.join(', ')}`)
        .join('; ')
      return `You are a friendly, warm and encouraging study companion for a university student. She studies ${subjectList}.${methodLines ? ` Her study methods — ${methodLines}.` : ''} Be concise, warm, and supportive. Use a few emojis. Help her study, explain concepts, create flashcards, summarize topics, or just motivate her. Answer in the same language she writes in.`
    }
  } catch {}
  return 'You are a friendly, warm and encouraging study companion for a university student. Be concise, warm, and supportive. Use a few emojis. Help her study, explain concepts, create flashcards, summarize topics, or just motivate her. Answer in the same language she writes in.'
}

const SYSTEM_PROMPT = buildSystemPrompt()

export default function AIChat() {
  const [apiKey, setApiKey]     = useState(() => localStorage.getItem('groq-key') || '')
  const [keyInput, setKeyInput] = useState('')
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Ola! Sou a tua assistente de estudo. Posso ajudar-te a estudar qualquer materia, criar flashcards, explicar conceitos, ou simplesmente motivar-te. O que precisas? 🌸',
    },
  ])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

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

  const send = async () => {
    if (!input.trim() || !apiKey || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages,
            userMsg,
          ],
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Erro: ' + (data?.error?.message || 'Algo correu mal. Verifica a tua API key.'),
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.choices[0].message.content,
        }])
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Nao consegui ligar a API. Verifica a tua ligacao a internet.',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <h1>✨ AI Chat</h1>
        <p className="subtitle">A tua assistente de estudo pessoal — powered by Groq (gratuito)</p>
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
            <button className="btn btn-primary" onClick={saveKey}>
              Guardar
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--purple-dark)', fontWeight: 700 }}>
              Obtem a tua key em console.groq.com/keys
            </span>
          </div>
        )}

        {apiKey && (
          <div style={{
            padding: '8px 16px',
            background: 'var(--pink-50)',
            borderBottom: '1.5px solid var(--pink-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 700 }}>
              Groq conectado 🌸
            </span>
            <button className="btn btn-ghost" style={{ fontSize: '0.78rem' }} onClick={removeKey}>
              Mudar key
            </button>
          </div>
        )}

        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.role === 'user' ? 'user' : 'ai'}`}>
              <div className="chat-avatar">
                {msg.role === 'user' ? '🙋' : '🌸'}
              </div>
              <div className="chat-bubble" style={{ whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="chat-msg ai">
              <div className="chat-avatar">🌸</div>
              <div className="chat-bubble">
                <span className="dots">
                  <span /><span /><span />
                </span>
              </div>
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
          <button
            className="btn btn-primary"
            onClick={send}
            disabled={!apiKey || loading || !input.trim()}
          >
            {loading ? <Sparkles size={16} /> : <Send size={16} />}
          </button>
        </div>

      </div>
    </div>
  )
}