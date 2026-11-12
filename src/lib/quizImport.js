// Lê o bloco "QUIZ" devolvido pelo Gemini (ou outra ferramenta) e guarda-o.
// Chaves: 'quiz-log' (um registo por quiz) e 'error-notebook' (erros e dúvidas).
import { scheduleReviews } from './reviews'

const norm = s => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f } catch { return f } }
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v))
const num = v => { const n = parseInt(String(v).replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : 0 }
const LEVELS = ['unknown', 'little', 'good', 'great']

export function parseQuiz(text) {
  const out = { cadeira: '', data: '', feitas: 0, certas: 0, topicos: [], erros: [], duvidas: [], niveis: [] }
  let section = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('```') || norm(line) === 'quiz') continue
    const isItem = /^[-*•]\s*/.test(line)
    const m = !isItem && line.match(/^([^:|]+):\s*(.*)$/)
    if (m) {
      const k = norm(m[1]), v = m[2].trim()
      if (k === 'cadeira') { out.cadeira = v; section = null }
      else if (k === 'data') { out.data = v; section = null }
      else if (k === 'feitas') { out.feitas = num(v); section = null }
      else if (k === 'certas') { out.certas = num(v); section = null }
      else if (k === 'topicos') section = 'topicos'
      else if (k === 'erros') section = 'erros'
      else if (k === 'duvidas') section = 'duvidas'
      else if (k === 'niveis') section = 'niveis'
      continue
    }
    if (section && isItem) {
      const p = line.replace(/^[-*•]\s*/, '').split('|').map(x => x.trim())
      if (section === 'topicos' && p[0]) out.topicos.push({ name: p[0], done: num(p[1]), correct: num(p[2]) })
      if (section === 'erros' && p[0]) out.erros.push({ topic: p[0], question: p[1] || '', answered: p[2] || '', right: p[3] || '' })
      if (section === 'duvidas' && p[0]) out.duvidas.push({ topic: p[0], text: p[1] || '' })
      if (section === 'niveis' && p[0]) { const n = parseInt(p[1], 10); out.niveis.push({ name: p[0], level: n >= 1 && n <= 4 ? n : 0 }) }
    }
  }
  return out
}

function findSubject(name) {
  const subs = read('user-settings', {}).subjects || []
  const n = norm(name)
  if (!n) return null
  return subs.find(s => [s.name, s.label, s.key].some(x => norm(x) === n))
    || subs.find(s => [s.name, s.label].some(x => x && (norm(x).includes(n) || n.includes(norm(x)))))
    || null
}

function findTopic(list, name) {
  const n = norm(name)
  return list.find(t => norm(t.name) === n)
    || list.find(t => norm(t.name).includes(n) || n.includes(norm(t.name)))
    || null
}

export function analyseQuiz(text) {
  const parsed = parseQuiz(text)
  if (!parsed.cadeira) return { ok: false, error: 'Não encontrei a linha "cadeira:". Colaste o bloco completo?' }
  if (!parsed.feitas) return { ok: false, error: 'Não encontrei "feitas:" com um número.' }
  const subject = findSubject(parsed.cadeira)
  if (!subject) return { ok: false, error: `Não reconheci a cadeira "${parsed.cadeira}". Tem de ser igual ao nome na app.` }
  const topicsMap = read('topics', {})
  const storeKey = topicsMap[subject.key] ? subject.key : (topicsMap[subject.name] ? subject.name : subject.key)
  const list = topicsMap[storeKey] || []
  const unmatched = new Set()
  const suggestions = []
  const lookup = name => { const t = findTopic(list, name); if (!t) unmatched.add(name); return t }

  parsed.topicos.forEach(x => {
    const t = lookup(x.name)
    if (!t || x.done < 2) return
    const acc = x.correct / x.done
    if (acc < 0.6 && ['good', 'great'].includes(t.confidence)) {
      suggestions.push({ topicId: t.id, name: t.name, to: 'little', why: `${x.correct}/${x.done} certas` })
    } else if (acc >= 0.9 && ['unknown', 'little'].includes(t.confidence)) {
      suggestions.push({ topicId: t.id, name: t.name, to: 'good', why: `${x.correct}/${x.done} certas` })
    }
  })
  parsed.erros.forEach(x => lookup(x.topic))
  parsed.duvidas.forEach(x => lookup(x.topic))

  // Níveis indicados pelo Gemini (1 a 4; em branco = ignorar). Sobrepõem-se à sugestão pelas notas.
  const newTopics = []
  parsed.niveis.forEach(x => {
    if (!x.level) return
    const to = LEVELS[x.level - 1]
    const t = findTopic(list, x.name)
    if (!t) {
      if (!newTopics.some(n => norm(n.name) === norm(x.name))) newTopics.push({ name: x.name, to })
      return
    }
    const i = suggestions.findIndex(s => s.topicId === t.id)
    if (i >= 0) suggestions.splice(i, 1)
    if ((t.confidence || 'unknown') !== to) suggestions.push({ topicId: t.id, name: t.name, to, why: 'nível indicado pelo Gemini' })
  })
  return { ok: true, parsed, subject, storeKey, unmatched: [...unmatched], suggestions, newTopics }
}

export function commitQuiz(an, acceptedTopicIds = [], acceptedNew = []) {
  const { parsed, subject, storeKey } = an
  const date = /^\d{4}-\d{2}-\d{2}$/.test(parsed.data) ? parsed.data : new Date().toISOString().slice(0, 10)
  const quizId = `${subject.key}-${date}-${parsed.feitas}-${parsed.certas}`
  const topicsMap = read('topics', {})
  const list = topicsMap[storeKey] || []

  const log = read('quiz-log', []).filter(q => q.id !== quizId)
  log.push({
    id: quizId, subjectKey: subject.key, date, done: parsed.feitas, correct: parsed.certas,
    topics: parsed.topicos.map(x => ({ name: x.name, topicId: findTopic(list, x.name)?.id ?? null, done: x.done, correct: x.correct })),
  })
  write('quiz-log', log)

  const notebook = read('error-notebook', []).filter(e => e.quizId !== quizId)
  const mk = (kind, i, x) => {
    const t = findTopic(list, x.topic)
    return { id: `${quizId}-${kind}-${i}`, quizId, kind, subjectKey: subject.key, date, topicId: t?.id ?? null, topicName: t?.name || x.topic, resolved: false,
      question: x.question || '', answered: x.answered || '', right: x.right || '', text: x.text || '' }
  }
  parsed.erros.forEach((x, i) => notebook.push(mk('erro', i, x)))
  parsed.duvidas.forEach((x, i) => notebook.push(mk('duvida', i, x)))
  write('error-notebook', notebook)

  const toReview = new Map()
  ;[...parsed.erros.map(x => x.topic), ...parsed.duvidas.map(x => x.topic)].forEach(n => { const t = findTopic(list, n); if (t) toReview.set(t.id, t) })
  parsed.topicos.forEach(x => { const t = findTopic(list, x.name); if (t && x.done >= 2 && x.correct / x.done < 0.7) toReview.set(t.id, t) })
  toReview.forEach(t => { try { scheduleReviews(subject.key, t) } catch {} })

  let next = list, changed = false
  const acc = new Set(acceptedTopicIds.map(String))
  if (acc.size > 0) {
    const sug = new Map(an.suggestions.map(s => [String(s.topicId), s.to]))
    next = next.map(t => acc.has(String(t.id)) && sug.has(String(t.id)) ? { ...t, confidence: sug.get(String(t.id)) } : t)
    changed = true
  }
  const add = an.newTopics.filter(n => acceptedNew.includes(n.name))
  if (add.length > 0) {
    next = [...next, ...add.map((n, i) => ({ id: Date.now() + i, name: n.name, confidence: n.to }))]
    changed = true
  }
  if (changed) { topicsMap[storeKey] = next; write('topics', topicsMap) }
  return { errors: parsed.erros.length, doubts: parsed.duvidas.length, reviews: toReview.size, added: add.length }
}

export function resolveNotebookEntry(id) {
  write('error-notebook', read('error-notebook', []).map(e => e.id === id ? { ...e, resolved: true } : e))
}

// Estatísticas dos últimos 7 dias (para o resumo semanal).
export function weeklyQuizStats(now = new Date()) {
  const from = new Date(now); from.setDate(from.getDate() - 6)
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const logs = read('quiz-log', []).filter(q => q.date >= iso(from))
  const subjects = Object.fromEntries((read('user-settings', {}).subjects || []).map(s => [s.key, s]))
  const byTopic = new Map()
  logs.forEach(q => (q.topics || []).forEach(t => {
    const k = `${q.subjectKey}|${t.name}`
    const cur = byTopic.get(k) || { subject: subjects[q.subjectKey], name: t.name, done: 0, correct: 0 }
    cur.done += t.done; cur.correct += t.correct
    byTopic.set(k, cur)
  }))
  const worst = [...byTopic.values()].filter(t => t.done >= 2).map(t => ({ ...t, acc: t.correct / t.done }))
    .filter(t => t.acc < 0.8).sort((a, b) => a.acc - b.acc).slice(0, 5)
  return {
    quizzes: logs.length,
    done: logs.reduce((a, q) => a + q.done, 0),
    correct: logs.reduce((a, q) => a + q.correct, 0),
    worst,
  }
}

// Prompt único para dar ao Gemini depois de cada quiz, com as cadeiras e tópicos de cada pessoa.
export function buildPrompt() {
  const subs = (read('user-settings', {}).subjects || []).filter(s => !s.closed)
  const topics = read('topics', {})
  const lines = subs.map(s => {
    const t = (topics[s.key] || topics[s.name] || []).map(x => x.name)
    return `- ${s.name}${t.length ? ` (tópicos: ${t.join('; ')})` : ''}`
  })
  return `Com base neste quiz (e nos quizzes anteriores desta conversa), responde APENAS com este bloco, sem mais texto:

QUIZ
cadeira: <nome da cadeira>
data: <AAAA-MM-DD>
feitas: <nº de questões>
certas: <nº de acertos>
tópicos:
- <tópico> | <feitas> | <certas>
erros:
- <tópico> | <enunciado resumido> | <o que respondi> | <resposta certa>
dúvidas:
- <tópico> | <dúvida em uma frase>
níveis:
- <tópico> | <1 a 4>

Regras para "níveis": 1 = Não sei, 2 = Sei pouco, 3 = Sei bem, 4 = Sei muito bem. Inclui os tópicos sobre os quais tens evidência nos quizzes, incluindo tópicos novos que ainda não estejam na lista. Se não tiveres a certeza, deixa o número em branco. Não inventes.
${lines.length ? `\nUsa exatamente estes nomes de cadeira e de tópicos quando existirem:\n${lines.join('\n')}\n` : ''}`
}
