function parseICSDate(val) {
  const isUTC = val.endsWith('Z')
  const str = val.replace(/Z$/, '')
  const parts = str.split('T')
  const datePart = parts[0]
  if (datePart.length !== 8) return { date: null, time: null }
  if (parts[1] && isUTC) {
    const t = parts[1]
    const d = new Date(`${datePart.slice(0,4)}-${datePart.slice(4,6)}-${datePart.slice(6,8)}T${t.slice(0,2)}:${t.slice(2,4)}:${t.slice(4,6) || '00'}Z`)
    return {
      date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
      time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
    }
  }
  return {
    date: `${datePart.slice(0,4)}-${datePart.slice(4,6)}-${datePart.slice(6,8)}`,
    time: parts[1] ? `${parts[1].slice(0,2)}:${parts[1].slice(2,4)}` : null,
  }
}

function parseICS(text) {
  const events = []
  const unfolded = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '')
  const lines = unfolded.split('\n')
  let inEvent = false
  let cur = {}
  for (const line of lines) {
    if (line.trim() === 'BEGIN:VEVENT') { inEvent = true; cur = {}; continue }
    if (line.trim() === 'END:VEVENT') {
      if (cur.date && cur.title) events.push(cur)
      inEvent = false; continue
    }
    if (!inEvent) continue
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const rawKey = line.slice(0, colonIdx).toUpperCase()
    const val    = line.slice(colonIdx + 1).trim()
    if (rawKey === 'SUMMARY')           cur.title       = val.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
    if (rawKey.startsWith('DTSTART')) { const p = parseICSDate(val); cur.date = p.date; cur.startTime = p.time }
    if (rawKey.startsWith('DTEND'))   { const p = parseICSDate(val); cur.endTime = p.time }
    if (rawKey === 'DESCRIPTION')       cur.description = val.replace(/\\n/g, ' ').replace(/\\,/g, ',')
    if (rawKey === 'LOCATION')          cur.location    = val
    if (rawKey === 'UID')               cur.uid         = val
  }
  return events
}

async function fetchICSUrl(url) {
  const normalized = url.replace(/^webcal:\/\//i, 'https://')
  const res = await fetch(normalized)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

export async function syncAllCalendars(urls) {
  const allEvents = []
  for (const { url, label } of urls) {
    try {
      const text   = await fetchICSUrl(url)
      const parsed = parseICS(text)
      parsed.forEach(e => allEvents.push({
        id:        `gcal-${e.uid || Math.random()}`,
        date:      e.date,
        title:     e.title,
        subtitle:  label || 'Google Calendar',
        notes:     [e.description, e.location].filter(Boolean).join(' · '),
        type:      'google',
        source:    'google',
        startTime: e.startTime || null,
        endTime:   e.endTime   || null,
      }))
    } catch {}
  }
  localStorage.setItem('gcal-events', JSON.stringify(allEvents))
  return allEvents
}
