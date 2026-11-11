import { useState } from 'react'
import { CONFIDENCE } from '../constants'
import { scheduleReviews } from '../lib/reviews'

export function loadTopics(subjectKey, subjects = []) {
  try {
    const all = JSON.parse(localStorage.getItem('topics') || '{}')
    const name = subjects.find(s => s.key === subjectKey)?.name || ''
    return all[subjectKey] || all[name] || []
  } catch { return [] }
}

// Tópicos cobertos numa sessão: assinalar agenda as revisões e não muda a confiança.
export default function TopicsCovered({ subjectKey, subjects }) {
  const [covered, setCovered] = useState([])
  const topics = loadTopics(subjectKey, subjects)
  if (topics.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {topics.map(topic => {
        const conf = CONFIDENCE.find(c => c.id === topic.confidence) || CONFIDENCE[0]
        const done = covered.includes(topic.id)
        return (
          <button key={topic.id} type="button"
            onClick={() => {
              if (done) return
              try { scheduleReviews(subjectKey, topic) } catch {}
              setCovered(prev => [...prev, topic.id])
            }}
            style={{
              padding: '4px 10px', borderRadius: 50, fontFamily: 'inherit',
              fontSize: 'var(--t-caption)', fontWeight: 600, cursor: 'pointer',
              background: conf.bg, color: conf.color, border: '1.5px solid ' + conf.color + '44',
            }}>
            {done ? '✓ ' : ''}{topic.name}
          </button>
        )
      })}
    </div>
  )
}
