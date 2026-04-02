import { useState, useEffect, useRef } from 'react'
import { Upload, Sparkles, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

const GROQ_MODEL = 'llama-3.3-70b-versatile'

function loadSubjects() {
  try {
    const s = JSON.parse(localStorage.getItem('user-settings'))
    return s?.subjects || []
  } catch { return [] }
}

function loadAnalyses() {
  try { return JSON.parse(localStorage.getItem('pdf-analyses')) || [] }
  catch { return [] }
}

function saveAnalyses(a) {
  localStorage.setItem('pdf-analyses', JSON.stringify(a))
}

async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target.result)
        // Use pdf.js from CDN
        const pdfjsLib = window['pdfjs-dist/build/pdf']
        if (!pdfjsLib) {
          // Fallback: just use filename and ask user to paste text
          resolve(null)
          return
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        const pdf = await pdfjsLib.getDocument(typedArray).promise
        let text = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          text += content.items.map(item => item.str).join(' ') + '\n'
        }
        resolve(text)
      } catch {
        resolve(null)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler ficheiro'))
    reader.readAsArrayBuffer(file)
  })
}

export default function PDFAnalysis() {
  const SUBJECTS = loadSubjects()

  const [analyses, setAnalyses]   = useState(loadAnalyses)
  const [subject, setSubject]     = useState(() => loadSubjects()[0]?.key || '')
  const [week, setWeek]           = useState('')
  const [pastedText, setPastedText] = useState('')
  const [fileName, setFileName]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [expanded, setExpanded]   = useState(null)
  const [dragOver, setDragOver]   = useState(false)
  const fileRef                   = useRef(null)

  useEffect(() => {
    // Load pdf.js
    if (!window['pdfjs-dist/build/pdf']) {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      document.head.appendChild(script)
    }
    saveAnalyses(analyses)
  }, [analyses])

  const handleFile = async (file) => {
    if (!file || file.type !== 'application/pdf') return
    setFileName(file.name)
    const text = await extractTextFromPDF(file)
    if (text) setPastedText(text.slice(0, 6000))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const analyse = async () => {
    if (!pastedText.trim() || !week) return
    const apiKey = localStorage.getItem('groq-key')
    if (!apiKey) return

    setLoading(true)
    const subj = SUBJECTS.find(s => s.key === subject)

    const prompt = `You are an expert study coach analysing a student's weekly study sheet for ${subj?.name}, week ${week}.

Here is the content of the sheet:
"""
${pastedText.slice(0, 4000)}
"""

Based on this content, provide:
1. A brief summary of the main topics covered (2-3 sentences)
2. Topics that seem well understood (look for detailed notes, correct answers, confident writing)
3. Topics that need more attention (look for gaps, question marks, incomplete sections, errors)
4. A concrete study plan for the next week with specific actions
5. One motivating sentence

Format your response clearly with these sections. Be specific and reference actual content from the sheet. Answer in Portuguese. Use a warm, encouraging tone.`

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      const feedback = res.ok ? data.choices[0].message.content : 'Erro ao analisar. Verifica a tua API key.'

      const analysis = {
        id: Date.now(),
        subject,
        week,
        fileName,
        feedback,
        date: new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' }),
      }
      setAnalyses(prev => [analysis, ...prev])
      setExpanded(analysis.id)
      setPastedText('')
      setFileName('')
      setWeek('')
    } catch {
      alert('Erro de ligacao. Verifica a tua internet.')
    } finally {
      setLoading(false)
    }
  }

  const removeAnalysis = (id) => setAnalyses(prev => prev.filter(a => a.id !== id))

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>📄 Análise de Fichas</h1>
        <p className="subtitle">Carrega a tua ficha semanal — a IA diz-te o que estudar mais</p>
      </div>

      {/* Form */}
      <div style={{
        background: 'var(--white)', border: '1px solid var(--gray-200)',
        borderRadius: 'var(--radius)', padding: '20px',
        marginBottom: 24, boxShadow: 'var(--shadow-xs)',
      }}>
        {/* Subject */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
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

        {/* Week */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', marginBottom: 5 }}>
            Semana nº
          </label>
          <input
            type="number" min="1" max="23"
            placeholder="Ex: 6"
            value={week}
            onChange={e => setWeek(e.target.value)}
            style={{
              width: 120, fontFamily: 'inherit', fontSize: '0.88rem',
              border: '1px solid var(--gray-200)', borderRadius: 8,
              padding: '7px 10px', outline: 'none',
              background: 'var(--white)', color: 'var(--gray-900)',
            }}
          />
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('pdf-input').click()}
          style={{
            border: `2px dashed ${dragOver ? '#c0455a' : 'var(--gray-200)'}`,
            borderRadius: 12, padding: '24px',
            textAlign: 'center', cursor: 'pointer',
            background: dragOver ? '#fff0f3' : 'var(--gray-50)',
            marginBottom: 14, transition: 'all 0.15s',
          }}
        >
          <Upload size={24} color={dragOver ? '#c0455a' : 'var(--gray-300)'} style={{ margin: '0 auto 8px' }} />
          <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--gray-500)', margin: 0 }}>
            {fileName ? `📄 ${fileName}` : 'Arrasta o PDF aqui ou clica para selecionar'}
          </p>
          <input
            id="pdf-input"
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>

        {/* Paste fallback */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', marginBottom: 5 }}>
            Ou cola o texto da ficha aqui
          </label>
          <textarea
            rows={5}
            placeholder="Cola o conteúdo da ficha aqui se o PDF não funcionar..."
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
            style={{
              width: '100%', fontFamily: 'inherit', fontSize: '0.85rem',
              border: '1px solid var(--gray-200)', borderRadius: 10,
              padding: '10px 12px', outline: 'none',
              background: 'var(--gray-50)', color: 'var(--gray-900)',
              resize: 'vertical', lineHeight: 1.5,
            }}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={analyse}
          disabled={loading || !pastedText.trim() || !week}
          style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
        >
          {loading
            ? <><span className="dots"><span /><span /><span /></span> A analisar ficha...</>
            : <><Sparkles size={15} /> Analisar ficha</>
          }
        </button>
      </div>

      {/* Analyses list */}
      {analyses.length === 0 ? (
        <div className="empty-state">
          <div className="e-emoji">📄</div>
          <p>Sem fichas analisadas ainda.</p>
        </div>
      ) : (
        analyses.map(a => {
          const subj   = SUBJECTS.find(s => s.key === a.subject)
          const isOpen = expanded === a.id
          return (
            <div key={a.id} style={{
              background: 'var(--white)', border: '1px solid var(--gray-200)',
              borderRadius: 'var(--radius)', marginBottom: 12,
              boxShadow: 'var(--shadow-xs)', overflow: 'hidden',
            }}>
              <div
                style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={() => setExpanded(isOpen ? null : a.id)}
              >
                <span>{subj?.emoji}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{subj?.name} — Semana {a.week}</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', margin: 0 }}>{a.date} · {a.fileName}</p>
                </div>
                <button className="btn btn-ghost" onClick={e => { e.stopPropagation(); removeAnalysis(a.id) }}>
                  <Trash2 size={13} />
                </button>
                {isOpen ? <ChevronUp size={16} color="var(--gray-400)" /> : <ChevronDown size={16} color="var(--gray-400)" />}
              </div>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--gray-100)', padding: '16px' }}>
                  <div style={{
                    background: '#f5f3ff', border: '1px solid #ddd6fe',
                    borderRadius: 10, padding: '14px 16px',
                    fontSize: '0.88rem', lineHeight: 1.7,
                    color: 'var(--gray-700)', whiteSpace: 'pre-wrap',
                  }}>
                    {a.feedback}
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