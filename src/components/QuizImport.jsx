import { useState } from 'react'
import { analyseQuiz, commitQuiz, buildPrompt } from '../lib/quizImport'

const LABEL = { little: 'Sei pouco', good: 'Sei bem', unknown: 'Não sei', great: 'Sei muito bem' }

export default function QuizImport() {
  const [text, setText] = useState('')
  const [an, setAn] = useState(null)
  const [accepted, setAccepted] = useState({})
  const [msg, setMsg] = useState('')

  const analyse = () => {
    const a = analyseQuiz(text)
    setAn(a); setMsg('')
    setAccepted(Object.fromEntries((a.suggestions || []).map(s => [String(s.topicId), true])))
  }
  const save = () => {
    const r = commitQuiz(an, Object.keys(accepted).filter(k => accepted[k]))
    setMsg(`Guardado · ${r.errors} erro(s) no caderno, ${r.doubts} dúvida(s), ${r.reviews} tópico(s) com revisões agendadas.`)
    setText(''); setAn(null)
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header"><span className="card-title">📝 Colar resultado do quiz</span></div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea className="form-input" rows={6} value={text} placeholder="Cola aqui o bloco QUIZ do Gemini"
          onChange={e => { setText(e.target.value); setAn(null); setMsg('') }} style={{ fontFamily: 'inherit', resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {!an && <button className="btn btn-primary" disabled={!text.trim()} onClick={analyse}>Ler</button>}
          <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(buildPrompt()); setMsg('Prompt copiado. Cola-o no Gemini uma vez.') }}>Copiar prompt para o Gemini</button>
        </div>
        {msg && <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-500)', margin: 0 }}>{msg}</p>}
        {an && !an.ok && <p style={{ fontSize: 'var(--t-caption)', color: 'var(--red-500)', margin: 0 }}>{an.error}</p>}
        {an?.ok && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-800)', margin: 0 }}>
              {an.subject.emoji} <b>{an.subject.name}</b> · {an.parsed.certas}/{an.parsed.feitas} certas ·
              {' '}{an.parsed.erros.length} erro(s) · {an.parsed.duvidas.length} dúvida(s)
            </p>
            {an.unmatched.length > 0 && (
              <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', margin: 0 }}>
                Tópicos que não existem na cadeira (ficam no caderno, sem revisão): {an.unmatched.join(', ')}
              </p>
            )}
            {an.suggestions.map(s => (
              <label key={s.topicId} style={{ display: 'flex', gap: 8, fontSize: 'var(--t-caption)', color: 'var(--gray-500)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!accepted[String(s.topicId)]}
                  onChange={e => setAccepted({ ...accepted, [String(s.topicId)]: e.target.checked })} />
                Passar “{s.name}” para {LABEL[s.to]} ({s.why})
              </label>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={save}>Guardar</button>
              <button className="btn btn-ghost" onClick={() => setAn(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
