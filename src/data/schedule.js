function loadSettings() {
  try { return JSON.parse(localStorage.getItem('user-settings')) } catch { return null }
}

export function getTasksForDay(dayOfWeek, settingsOverride) {
  const settings = settingsOverride || loadSettings()
  if (!settings?.subjects?.length) return []
  const subjectKeys = settings.schedule?.[dayOfWeek] || []
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  return subjectKeys.map(key => {
    const subject = settings.subjects.find(s => s.key === key)
    if (!subject) return null
    const tasks = isWeekend
      ? [{ id: `${key}-sheet-weekend`, label: 'Ficha semanal da matéria', highlight: true }]
      : (subject.methods || []).map((method, i) => ({ id: `${key}-method-${i}`, label: method }))
    return { subjectKey: key, tasks }
  }).filter(Boolean)
}

export function getSubjectsMap(settingsOverride) {
  const settings = settingsOverride || loadSettings()
  const map = {}
  ;(settings?.subjects || []).forEach(s => {
    map[s.key] = { name: s.name, color: s.color, textColor: s.textColor, emoji: s.emoji }
  })
  return map
}
