// Quantos tópicos por dia faltam ver até ao próximo exame de uma cadeira.
// "Por ver" = tópicos com confiança "Não sei" ou "Sei pouco".
const DAY = 86400000

export function topicsPlan(subject, exams, topicsMap, now = new Date()) {
  const topics = topicsMap[subject.key] || topicsMap[subject.name] || []
  if (topics.length === 0) return null
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const next = exams
    .filter(e => e.date && e.actualGrade == null && (e.subject === subject.name || e.subject === subject.key))
    .map(e => ({ ...e, when: new Date(e.date + 'T00:00:00') }))
    .filter(e => e.when >= today)
    .sort((a, b) => a.when - b.when)[0]
  if (!next) return null
  const pending = topics.filter(t => !['good', 'great'].includes(t.confidence)).length
  const days = Math.max(0, Math.round((next.when - today) / DAY))
  const perDay = days === 0 ? pending : pending / days
  return { total: topics.length, pending, days, perDay, exam: next }
}
