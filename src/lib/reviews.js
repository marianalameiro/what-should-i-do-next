// Revisão espaçada: um tópico estudado volta a aparecer 1, 7 e 21 dias depois.
const KEY = 'topic-reviews'
const INTERVALS = [1, 7, 21]
const KEEP_DONE_DAYS = 60

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function loadReviews() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

function save(list) { localStorage.setItem(KEY, JSON.stringify(list)) }

export function scheduleReviews(subjectKey, topic, from = new Date()) {
  if (!subjectKey || !topic?.id) return
  const cutoff = new Date(from)
  cutoff.setDate(cutoff.getDate() - KEEP_DONE_DAYS)
  const cutoffStr = iso(cutoff)
  const kept = loadReviews().filter(r =>
    !(r.subjectKey === subjectKey && r.topicId === topic.id && !r.done) &&
    (!r.done || r.due >= cutoffStr)
  )
  const added = INTERVALS.map(n => {
    const due = new Date(from)
    due.setDate(due.getDate() + n)
    return {
      id: `${subjectKey}-${topic.id}-${iso(from)}-${n}`,
      subjectKey, topicId: topic.id, topicName: topic.name,
      interval: n, due: iso(due), done: false,
    }
  })
  save([...kept, ...added])
}

export function dueReviews(now = new Date()) {
  const today = iso(now)
  return loadReviews()
    .filter(r => !r.done && r.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due))
}

export function markReviewDone(id) {
  save(loadReviews().map(r => (r.id === id ? { ...r, done: true } : r)))
}
