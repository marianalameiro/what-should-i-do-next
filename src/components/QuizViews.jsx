import { useState } from 'react'
import { resolveNotebookEntry, weeklyQuizStats } from '../lib/quizImport'

// Caderno de erros de uma cadeira (para a página da cadeira).
export function ErrorNotebook({ subjectKey }) {
  const [, bump] = useState(0)
  let all = []
  try { all = JSON.parse(localStorage.getItem('error-notebook')) || [] } catch {}
  const items = all.filter(e => e.subjectKey === subjectKey && !e.resolved).sort((a, b) => b.date.localeCompare(a.date))
  if (items.length === 0) return null
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 'var(--t-body)', fontWeight: 800, color: 'var(--gray-700)', marginBottom: 10 }}>📕 Caderno de erros · {items.length}</h2>
      {items.map(e => (
        <div key={e.id} onClick={() => { resolveNotebookEntry(e.id); bump(n => n + 1) }}
          style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer' }}>
          <p style={{ margin: 0, fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--gray-800)' }}>
            {e.kind === 'duvida' ? '❓ ' : ''}{e.topicName}{e.question ? ` · ${e.question}` : ''}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--t-caption)', color: 'var(--gray-500)' }}>
            {e.kind === 'duvida' ? e.text : `Respondeste: ${e.answered || '—'} · Certa: ${e.right || '—'}`}
          </p>
        </div>
      ))}
      <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', marginTop: 6 }}>Clica numa entrada quando já a percebeste.</p>
    </div>
  )
}

// Quizzes e matérias onde mais erras nos últimos 7 dias (para o resumo semanal).
export function WeeklyQuizStats() {
  const s = weeklyQuizStats()
  if (s.quizzes === 0) return null
  const pct = s.done ? Math.round(s.correct / s.done * 100) : 0
  return (
    <div style={{ margin: '0 0 20px' }}>
      <p style={{ fontSize: 'var(--t-caption)', fontWeight: 600, color: 'var(--gray-500)', margin: '0 0 6px' }}>
        Quizzes da semana · {s.quizzes} · {s.correct}/{s.done} certas ({pct}%)
      </p>
      {s.worst.length > 0 && <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', margin: '0 0 4px' }}>Onde mais erras:</p>}
      {s.worst.map(t => (
        <div key={`${t.subject?.key}-${t.name}`} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--gray-100)' }}>
          <span style={{ flex: 1, fontSize: 'var(--t-body)', color: 'var(--gray-800)' }}>
            {t.subject?.emoji} {t.name}<span style={{ color: 'var(--gray-400)' }}> · {t.subject?.name}</span>
          </span>
          <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-500)' }}>{t.correct}/{t.done} certas</span>
        </div>
      ))}
    </div>
  )
}
