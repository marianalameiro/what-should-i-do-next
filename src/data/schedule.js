function loadSettings() {
  try { return JSON.parse(localStorage.getItem("user-settings")) } catch { return null }
}

export function getTasksForDay(dayOfWeek, settingsOverride) {
  const settings = settingsOverride || loadSettings()
  if (!settings?.subjects?.length) return []
  const subjectKeys = settings.schedule?.[dayOfWeek] || []
  return subjectKeys.map(key => {
    const subject = settings.subjects.find(s => s.key === key)
    if (!subject || subject.closed) return null
    
    // Lógica 100% dinâmica: lê apenas os métodos reais configurados por qualquer utilizador
    const tasks = (subject.methods || []).map((method, i) => {
      const label = typeof method === "string" ? method : (method?.label || "")
      const duration = typeof method === "object" && method?.duration ? Number(method.duration) : undefined
      return { id: `${key}-method-${i}`, label, ...(duration ? { duration } : {}) }
    });
    
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
