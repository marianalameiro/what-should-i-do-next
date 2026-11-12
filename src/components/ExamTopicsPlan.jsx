import { topicsPlan } from '../lib/studyPlan'

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

export default function ExamTopicsPlan() {
  const settings = read('user-settings', {})
  const exams = read('exams', [])
  const topics = read('topics', {})
  const rows = (settings.subjects || [])
    .filter(s => !s.closed)
    .map(s => ({ s, plan: topicsPlan(s, exams, topics) }))
    .filter(r => r.plan && r.plan.pending > 0)
    .sort((a, b) => a.plan.days - b.plan.days)

  if (rows.length === 0) return null
  const fmt = n => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',')

  return (
    <div style={{ margin: '0 0 24px' }}>
      <p style={{ fontSize: 'var(--t-caption)', fontWeight: 600, color: 'var(--gray-500)', margin: '0 0 6px' }}>
        Tópicos por dia até ao exame
      </p>
      {rows.map(({ s, plan }) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--gray-100)' }}>
          <span style={{ flex: 1, fontSize: 'var(--t-body)', color: 'var(--gray-800)' }}>
            {s.emoji} {s.name}
            <span style={{ color: 'var(--gray-400)' }}> · {plan.exam.type || 'Exame'}</span>
          </span>
          <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-500)' }}>
            {plan.pending} por ver · {plan.days === 0 ? 'hoje' : `${plan.days} d`} · {fmt(plan.perDay)}/dia
          </span>
        </div>
      ))}
    </div>
  )
}
