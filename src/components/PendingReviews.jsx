import { useState } from 'react'
import { dueReviews, markReviewDone } from '../lib/reviews'

const MAX_VISIBLE = 5

function daysLate(due) {
  const d = new Date(`${due}T12:00:00`)
  const t = new Date(); t.setHours(12, 0, 0, 0)
  return Math.round((t - d) / 86400000)
}

// Mostra as revisões que já venceram. Só aparecem cadeiras abertas (closed !== true).
function loadSubjects() {
  try { return JSON.parse(localStorage.getItem('user-settings'))?.subjects || [] } catch { return [] }
}

export default function PendingReviews({ subjects }) {
  const [, bump] = useState(0)
  const [showAll, setShowAll] = useState(false)

  const open = new Map((subjects || loadSubjects()).filter(s => !s.closed).flatMap(s => [[s.key, s], [s.name, s], [s.label, s]]))
  const items = dueReviews().filter(r => open.has(r.subjectKey))
  if (items.length === 0) return null

  const visible = showAll ? items : items.slice(0, MAX_VISIBLE)

  return (
    <div style={{ margin: '14px 0 6px' }}>
      <p style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-500)', marginBottom: 8 }}>
        Revisões pendentes · {items.length}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visible.map(r => {
          const s = open.get(r.subjectKey)
          const late = daysLate(r.due)
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--r)' }}>
              <button
                aria-label={`Marcar revisão de ${r.topicName} como feita`}
                onClick={() => { markReviewDone(r.id); bump(n => n + 1) }}
                style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${s.color}`, background: 'transparent', cursor: 'pointer', flexShrink: 0, padding: 0 }}
              />
              <span style={{ fontSize: '1rem' }}>{s.emoji}</span>
              <span style={{ flex: 1, fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--gray-800)' }}>{r.topicName}</span>
              <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
                {r.interval}d{late > 0 ? ` · há ${late}d` : ''}
              </span>
            </div>
          )
        })}
      </div>
      {items.length > MAX_VISIBLE && (
        <button onClick={() => setShowAll(v => !v)} style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--t-caption)', fontWeight: 600, color: 'var(--gray-500)', padding: 0 }}>
          {showAll ? 'Mostrar menos' : `Ver mais ${items.length - MAX_VISIBLE}`}
        </button>
      )}
    </div>
  )
}
