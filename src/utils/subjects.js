// Helpers for hiding closed (fechadas) subjects across the whole app.
// Exams and sessions reference a subject by its display name, so we key on names.

export function closedSubjectNames(settings) {
  return new Set((settings?.subjects || []).filter(s => s.closed).map(s => s.name))
}

export function activeSubjects(settings) {
  return (settings?.subjects || []).filter(s => !s.closed)
}

// Drop any exam whose subject has been closed.
export function withoutClosedSubjects(exams, settings) {
  const closed = closedSubjectNames(settings)
  return (exams || []).filter(e => !closed.has(e.subject))
}
