import { getMondayOfWeek, daysUntil } from './dates'

/**
 * Scores every subject and returns a ranked list, each entry with a
 * human-readable `reason` string. The list is mood-sensitive:
 *   😴 → easiest/least urgent first  (review mode)
 *   😐/😊/🔥 → most urgent first      (focus mode)
 *
 * @param {object} opts
 * @param {Array}   opts.subjects        - settings.subjects
 * @param {Array}   opts.sessions        - study-sessions from localStorage
 * @param {Array}   opts.exams           - exams from localStorage
 * @param {object}  opts.weeklyTargets   - { [key]: hours } overrides
 * @param {string}  opts.mood            - '😴' | '😐' | '😊' | '🔥'
 * @param {Array}   opts.todaySchedule   - getTasksForDay() result
 * @param {object}  opts.done            - tasks-<date> map from localStorage
 * @param {Function} opts.getWeeklyGoal  - (key) → semester target hours
 * @param {number}  opts.weeksRemaining
 */
export function suggestNextSession({ subjects, sessions, exams, weeklyTargets, mood, todaySchedule, done, getWeeklyGoal, weeksRemaining }) {
  if (!subjects || subjects.length === 0) return []

  const monday  = getMondayOfWeek(new Date())
  const todayDow = (() => { const d = new Date().getDay(); return d === 0 ? 7 : d })()

  const scored = subjects.map(s => {
    // ── Hours logged this week for this subject ───────────────────────────
    const weekHrs = sessions
      .filter(x => x.subject === s.key && new Date(x.date) >= monday)
      .reduce((sum, x) => sum + (x.hours || 0), 0)

    // ── Weekly goal ───────────────────────────────────────────────────────
    const weeklyGoal = (weeklyTargets?.[s.key] !== undefined && weeklyTargets[s.key] !== '')
      ? parseFloat(weeklyTargets[s.key])
      : getWeeklyGoal(s.key) / Math.max(1, weeksRemaining)

    // ── Expected hours so far this week (proportional) ───────────────────
    const expectedNow = weeklyGoal * (todayDow / 7)

    // ── On-track status ───────────────────────────────────────────────────
    const pct    = expectedNow < 0.1 ? 100 : (weekHrs / expectedNow) * 100
    const status = todayDow <= 1 || expectedNow < 0.1 ? 'green'
      : pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red'

    const deficit = Math.max(0, expectedNow - weekHrs)

    // ── Nearest exam for this subject ─────────────────────────────────────
    const nextExam = exams
      .filter(e => e.date && daysUntil(e.date) >= 0 &&
        (e.subject?.toLowerCase() === s.name?.toLowerCase() || e.subject === s.key))
      .map(e => ({ ...e, days: daysUntil(e.date) }))
      .sort((a, b) => a.days - b.days)[0]

    const examDays = nextExam?.days ?? 999

    // ── Pending tasks scheduled for today ─────────────────────────────────
    const todayPending = (todaySchedule || [])
      .filter(g => g.subjectKey === s.key)
      .flatMap(g => g.tasks)
      .filter(t => !(done?.[t.id])).length

    // ── Composite urgency score ───────────────────────────────────────────
    let score = 0

    // Exam proximity (dominates)
    if      (examDays <= 3)  score += 320
    else if (examDays <= 7)  score += 220
    else if (examDays <= 14) score += 110
    else if (examDays <= 21) score +=  55

    // Behind on track
    if      (status === 'red')   score += 130
    else if (status === 'amber') score +=  55

    // Proportional deficit (max 80 pts)
    score += Math.min(80, deficit * 22)

    // Zero sessions this week — nudge
    if (weekHrs === 0) score += 45

    // Scheduled tasks pending today
    score += todayPending * 28

    return { ...s, score, status, weekHrs, weeklyGoal, expectedNow, deficit, examDays, nextExam, todayPending }
  })

  // ── Sort: tired → easiest first; otherwise → hardest first ───────────
  const sorted = mood === '😴'
    ? [...scored].sort((a, b) => a.score - b.score)
    : [...scored].sort((a, b) => b.score - a.score)

  return sorted.map(s => ({ ...s, reason: buildReason(s, mood) }))
}

// ── Human-readable reason ────────────────────────────────────────────────────

const ENERGY = { '😴': 'baixa', '😐': 'normal', '😊': 'boa', '🔥': 'alta' }

function buildReason(s, mood) {
  const { status, examDays, weekHrs, expectedNow, deficit, todayPending } = s
  const energy = ENERGY[mood] || 'normal'

  // Tired mode: calmer framing
  if (mood === '😴') {
    if (examDays <= 7)  return `Exame em ${examDays} dias — mesmo com pouca energia, vale a pena rever.`
    if (examDays <= 14) return `Exame em ${examDays} dias. Com energia baixa, foca em rever o que já sabes.`
    if (status === 'green' && weekHrs > 0) return `Sem pressão imediata — boa para rever com calma. Energia ${energy}.`
    return `Cadeira sem urgência aguda — ideal para um ritmo mais leve. Energia ${energy}.`
  }

  // Build fact list
  const facts = []

  if      (examDays <= 3)  facts.push(`tens exame daqui a ${examDays === 1 ? '1 dia' : `${examDays} dias`}`)
  else if (examDays <= 7)  facts.push(`tens exame em ${examDays} dias`)
  else if (examDays <= 14) facts.push(`exame em ${examDays} dias`)
  else if (examDays <= 21) facts.push(`exame em ${examDays} dias`)

  if (status === 'red') {
    facts.push(`estás ${deficit.toFixed(1)}h abaixo do ritmo semanal`)
  } else if (status === 'amber') {
    facts.push('estás ligeiramente abaixo do plano')
  } else if (weekHrs === 0) {
    facts.push('ainda sem sessões esta semana')
  }

  if (todayPending > 0) {
    facts.push(`${todayPending} tarefa${todayPending !== 1 ? 's' : ''} agendada${todayPending !== 1 ? 's' : ''} para hoje`)
  }

  // Compose sentence
  let sentence
  if (facts.length === 0) {
    sentence = mood === '🔥'
      ? 'Estás no bom caminho — aproveita a energia para acelerar.'
      : 'Boa cadeira para manter o ritmo nesta fase.'
  } else {
    const [first, ...rest] = facts
    const cap = first[0].toUpperCase() + first.slice(1)
    sentence = rest.length > 0 ? `${cap} — ${rest.join(' e ')}.` : `${cap}.`
  }

  // Append energy only when non-default or high
  if (mood === '🔥') sentence += ' Energia alta.'

  return sentence
}
