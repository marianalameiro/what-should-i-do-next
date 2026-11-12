// Padrão humor × hora do dia, calculado a partir das sessões de estudo.
// Janelas de 2 horas pela hora de início; só conta janelas com sessões suficientes.
const MOOD = { '😴': 1, '😐': 2, '😊': 3, '🔥': 4 }
const BLOCK = 2
const MIN_N = 4        // sessões mínimas por janela
const MIN_SPREAD = 0.4 // diferença mínima entre a melhor e a pior janela

function readSessions() {
  try { return JSON.parse(localStorage.getItem('study-sessions')) || [] } catch { return [] }
}

// Hora de início: a guardada pelo Pomodoro, ou estimada (registo menos duração).
export function sessionStart(s) {
  if (typeof s.startTime === 'number' && s.startTime > 1e12) return new Date(s.startTime)
  if (s.id > 1e12 && s.hours > 0 && new Date(s.id).toDateString() === s.date) {
    return new Date(s.id - s.hours * 3600000)
  }
  return null
}

export function analyseHours(sessions = readSessions()) {
  const map = new Map()
  let used = 0
  for (const s of sessions) {
    const score = MOOD[s.mood]
    const start = score ? sessionStart(s) : null
    if (!start) continue
    used++
    const from = Math.floor(start.getHours() / BLOCK) * BLOCK
    const w = map.get(from) || { from, to: from + BLOCK, sum: 0, n: 0, hours: 0 }
    w.sum += score; w.n++; w.hours += s.hours || 0
    map.set(from, w)
  }
  const windows = [...map.values()]
    .map(w => ({ ...w, avg: w.sum / w.n, avgHours: w.hours / w.n }))
    .sort((a, b) => a.from - b.from)
  const reliable = windows.filter(w => w.n >= MIN_N)
  if (reliable.length < 3) return { ready: false, used, windows }
  const ranked = [...reliable].sort((a, b) => b.avg - a.avg)
  const spread = ranked[0].avg - ranked[ranked.length - 1].avg
  if (spread < MIN_SPREAD) return { ready: true, clear: false, used, windows, reliable }
  const k = Math.min(2, Math.floor(ranked.length / 2))
  return {
    ready: true, clear: true, used, windows, reliable,
    best: ranked.slice(0, k),
    worst: ranked.slice(-k).reverse(),
  }
}

// Energia pessoal ('high' | 'medium' | 'low') para um minuto do dia, ou null se não houver padrão claro.
let cacheRaw = null, cacheValue = null
export function personalEnergy(minute) {
  let raw = null
  try { raw = localStorage.getItem('study-sessions') } catch {}
  if (raw !== cacheRaw) { cacheRaw = raw; cacheValue = analyseHours() }
  const a = cacheValue
  if (!a?.clear) return null
  const hour = Math.floor(minute / 60)
  const w = a.reliable.find(x => hour >= x.from && hour < x.to)
  if (!w) return null
  const ranked = [...a.reliable].sort((x, y) => y.avg - x.avg)
  const i = ranked.findIndex(x => x.from === w.from)
  const third = ranked.length / 3
  return i < third ? 'high' : i >= ranked.length - third ? 'low' : 'medium'
}
