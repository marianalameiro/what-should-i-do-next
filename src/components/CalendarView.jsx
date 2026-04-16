import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, RefreshCw, Pencil } from 'lucide-react'
import { CalendarEmoji, smartEmoji } from './CalendarEmoji'

const EVENT_TYPES = {
  exam:         { label: 'Exame/Teste',    color: '#dc2626', bg: '#fef2f2', emoji: '📝' },
  presentation: { label: 'Apresentação',   color: '#16a34a', bg: '#f0fdf4', emoji: '🎤' },
  milestone:    { label: 'Deadline',       color: '#2563eb', bg: '#dbeafe', emoji: '🚩' },
  meeting:      { label: 'Reunião',        color: '#7c3aed', bg: '#f5f3ff', emoji: '🤝' },
  deadline:     { label: 'Deadline avulsa',color: '#ea580c', bg: '#fff7ed', emoji: '⚡' },
  class:        { label: 'Aula',           color: '#0891b2', bg: '#ecfeff', emoji: '📖' },
  other:        { label: 'Outro',          color: '#71717a', bg: '#fafafa', emoji: '📌' },
  study:        { label: 'Estudo',         color: '#d4688a', bg: '#fff5f7', emoji: '⏱️' },
  google:       { label: 'Google Cal',     color: '#1a73e8', bg: '#e8f0fe', emoji: '📆' },
}

// ── Google Calendar ICS ───────────────────────────────────────────────────────
function loadGCalConfig() { try { return JSON.parse(localStorage.getItem('gcal-config')) || { urls: [] } } catch { return { urls: [] } } }
function saveGCalConfig(c) { localStorage.setItem('gcal-config', JSON.stringify(c)) }
function loadGCalEvents() { try { return JSON.parse(localStorage.getItem('gcal-events')) || [] } catch { return [] } }
function saveGCalEvents(e) { localStorage.setItem('gcal-events', JSON.stringify(e)) }

function parseICSDate(val) {
  // Handles: 20260321T100000Z  20260321T100000  20260321
  const str = val.replace(/Z$/, '')
  const parts = str.split('T')
  const datePart = parts[0]
  if (datePart.length !== 8) return { date: null, time: null }
  const date = `${datePart.slice(0,4)}-${datePart.slice(4,6)}-${datePart.slice(6,8)}`
  let time = null
  if (parts[1]) {
    const t = parts[1]
    time = `${t.slice(0,2)}:${t.slice(2,4)}`
  }
  return { date, time }
}

function parseICS(text) {
  const events = []
  // Unfold lines (continuation lines start with space/tab)
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
    if (rawKey === 'SUMMARY')                      cur.title       = val.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
    if (rawKey.startsWith('DTSTART'))            { const p = parseICSDate(val); cur.date = p.date; cur.startTime = p.time }
    if (rawKey.startsWith('DTEND'))              { const p = parseICSDate(val); cur.endTime = p.time }
    if (rawKey === 'DESCRIPTION')                  cur.description = val.replace(/\\n/g, ' ').replace(/\\,/g, ',')
    if (rawKey === 'LOCATION')                     cur.location    = val
    if (rawKey === 'UID')                          cur.uid         = val
  }
  return events
}

async function fetchICSUrl(url) {
  // Google's ICS URLs need webcal:// → https://
  const normalized = url.replace(/^webcal:\/\//i, 'https://')
  const res = await fetch(normalized)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function syncAllCalendars(urls) {
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
  saveGCalEvents(allEvents)
  return allEvents
}

const DAY_NAMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const MANUAL_TYPES = ['meeting','deadline','class','study','other']
const RECURRENCE = ['Nunca','Semanalmente','Quinzenalmente','Mensalmente']

function loadExams() { try { return JSON.parse(localStorage.getItem('exams')) || [] } catch { return [] } }
function loadProjects() { try { return JSON.parse(localStorage.getItem('projects')) || [] } catch { return [] } }
function loadSessions() { try { return JSON.parse(localStorage.getItem('study-sessions')) || [] } catch { return [] } }
function loadManualEvents() { try { return JSON.parse(localStorage.getItem('calendar-events')) || [] } catch { return [] } }
function saveManualEvents(e) { localStorage.setItem('calendar-events', JSON.stringify(e)) }

function toDateStr(date) { return date.toISOString().split('T')[0] }

function getAllEvents(googleEvents = []) {
  const events = [...googleEvents]

  // Exams
  loadExams().forEach(e => {
    if (!e.date) return
    events.push({
      id: `exam-${e.id}`,
      date: e.date,
      title: e.subject,
      subtitle: e.type,
      type: e.type === 'Apresentação' ? 'presentation' : 'exam',
      source: 'auto',
    })
  })

  // Project milestones
  loadProjects().forEach(p => {
    (p.milestones || []).forEach(m => {
      if (!m.date || m.done) return
      events.push({
        id: `milestone-${m.id}`,
        date: m.date,
        title: m.label,
        subtitle: p.name,
        type: 'milestone',
        source: 'auto',
      })
    })
  })

  // Study sessions intentionally excluded from calendar

  // Manual events (with recurrence)
  loadManualEvents().forEach(e => {
    if (!e.date) return
    events.push({ ...e, source: 'manual' })

    // Expand recurring events for 1 year
    if (e.recurrence && e.recurrence !== 'Nunca') {
      const base = new Date(e.date)
      let days = e.recurrence === 'Semanalmente' ? 7 : e.recurrence === 'Quinzenalmente' ? 14 : 30
      for (let i = 1; i <= 52; i++) {
        const next = new Date(base)
        next.setDate(base.getDate() + days * i)
        if (next.getFullYear() > base.getFullYear() + 1) break
        events.push({ ...e, id: `${e.id}-r${i}`, date: toDateStr(next), source: 'manual-recurring' })
      }
    }
  })

  return events
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

export function CalendarView() {
  const today = new Date()
  const [view, setView]               = useState('month')
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents]           = useState([])
  const [manualEvents, setManualEvents] = useState(loadManualEvents)
  const [showForm, setShowForm]       = useState(false)
  const [showGCal, setShowGCal]       = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)
  const [gcalConfig, setGcalConfig]   = useState(loadGCalConfig)
  const [gcalEvents, setGcalEvents]   = useState(loadGCalEvents)
  const [syncing, setSyncing]         = useState(false)
  const [syncError, setSyncError]     = useState(null)
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [newCal, setNewCal]           = useState({ url: '', label: '' })
  const [editingEvent, setEditingEvent] = useState(null)
  const [form, setForm]               = useState({
    title: '', type: 'meeting', date: toDateStr(today),
    time: '', notes: '', recurrence: 'Nunca',
  })

  useEffect(() => { setEvents(getAllEvents(gcalEvents)) }, [manualEvents, gcalEvents])
  useEffect(() => { saveManualEvents(manualEvents) }, [manualEvents])
  useEffect(() => { saveGCalConfig(gcalConfig) }, [gcalConfig])

  const syncGoogle = async () => {
    if (!gcalConfig.urls.length) return
    setSyncing(true)
    setSyncError(null)
    try {
      const evs = await syncAllCalendars(gcalConfig.urls)
      setGcalEvents(evs)
    } catch {
      setSyncError('Erro ao sincronizar. Verifica o URL.')
    } finally {
      setSyncing(false)
    }
  }

  // Auto-sync on mount if configured
  useEffect(() => { if (gcalConfig.urls.length) syncGoogle() }, [])

  const addCalendar = () => {
    if (!newCal.url.trim()) return
    setGcalConfig(prev => ({ ...prev, urls: [...prev.urls, { url: newCal.url.trim(), label: newCal.label.trim() || 'Google Calendar' }] }))
    setNewCal({ url: '', label: '' })
  }

  const removeCalendar = (idx) => {
    setGcalConfig(prev => ({ ...prev, urls: prev.urls.filter((_, i) => i !== idx) }))
  }

  const resetForm = () => {
    setForm({ title: '', type: 'meeting', date: toDateStr(today), time: '', notes: '', recurrence: 'Nunca' })
    setEditingEvent(null)
    setShowForm(false)
  }

  const saveEvent = () => {
    if (!form.title.trim() || !form.date) return
    if (editingEvent) {
      setManualEvents(prev => prev.map(e => e.id === editingEvent ? { ...e, ...form, title: form.title.trim() } : e))
    } else {
      setManualEvents(prev => [...prev, { id: `manual-${Date.now()}`, ...form, title: form.title.trim() }])
    }
    resetForm()
  }

  const startEdit = (ev) => {
    const baseId = ev.id.replace(/-r\d+$/, '')
    const base = manualEvents.find(e => e.id === baseId) || ev
    setEditingEvent(base.id)
    setForm({ title: base.title, type: base.type, date: base.date, time: base.time || '', notes: base.notes || '', recurrence: base.recurrence || 'Nunca' })
    setShowForm(true)
  }

  const removeEvent = (id) => {
    const baseId = id.replace(/-r\d+$/, '')
    setManualEvents(prev => prev.filter(e => e.id !== baseId))
  }


  const toggleFilter = (key) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const filterEvents = (evs) =>
    activeFilters.size === 0 ? evs : evs.filter(e => activeFilters.has(e.type))

  const getEventsForDate = (dateStr) => filterEvents(events.filter(e => e.date === dateStr))

  const navigate = (dir) => {
    if (view === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1))
    } else if (view === 'week') {
      const d = new Date(currentDate)
      d.setDate(d.getDate() + dir * 7)
      setCurrentDate(d)
    }
  }

  // ── MONTH VIEW ─────────────────────────────────────────────────────────────
  const renderMonth = () => {
    const year  = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const days  = getDaysInMonth(year, month)
    const first = getFirstDayOfMonth(year, month)
    const cells = []

    // Empty cells before first day
    for (let i = 0; i < first; i++) cells.push(null)
    for (let d = 1; d <= days; d++) cells.push(d)

    const todayStr = toDateStr(today)

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 2 }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-400)', padding: '6px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const dayEvents = getEventsForDate(dateStr)
            const isToday = dateStr === todayStr
            const isSelected = selectedDay === dateStr

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                style={{
                  minHeight: 70,
                  background: isSelected ? 'var(--rose-50)' : 'var(--white)',
                  border: `1.5px solid ${isToday ? 'var(--rose-400)' : isSelected ? 'var(--rose-200)' : 'var(--gray-100)'}`,
                  borderRadius: 8,
                  padding: '5px 6px',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                  minWidth: 0,
                }}
              >
                <div style={{
                  fontSize: '0.8rem', fontWeight: isToday ? 800 : 600,
                  marginBottom: 3,
                  width: 22, height: 22,
                  background: isToday ? 'var(--rose-400)' : 'transparent',
                  color: isToday ? 'white' : 'var(--gray-700)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {day}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {dayEvents.slice(0, 3).map(ev => {
                    const t = EVENT_TYPES[ev.type] || EVENT_TYPES.other
                    return (
                      <div key={ev.id} style={{
                        fontSize: '0.62rem', fontWeight: 600,
                        background: t.bg, color: t.color,
                        borderRadius: 3, padding: '1px 4px',
                        display: 'flex', alignItems: 'center', gap: 2,
                        minWidth: 0,
                      }}>
                        <span style={{ flexShrink: 0, lineHeight: 1 }}>{smartEmoji(t.emoji)}</span>
                        <span style={{ wordBreak: 'break-word', lineHeight: 1.2 }}>{ev.title}</span>
                      </div>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div style={{ fontSize: '0.6rem', color: 'var(--gray-400)', fontWeight: 600 }}>+{dayEvents.length - 3}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Selected day detail */}
        {selectedDay && getEventsForDate(selectedDay).length > 0 && (
          <div style={{ marginTop: 14, background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
            <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--gray-700)', marginBottom: 10 }}>
              {new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {getEventsForDate(selectedDay).map(ev => {
                const t = EVENT_TYPES[ev.type] || EVENT_TYPES.other
                return (
                  <div key={ev.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', background: t.bg,
                    borderRadius: 8, border: `1px solid ${t.color}20`,
                  }}>
                    <span style={{ fontSize: '1rem' }}>{smartEmoji(t.emoji)}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.83rem', color: t.color }}>{ev.title}</p>
                      {ev.subtitle && <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{ev.subtitle}</p>}
                      {ev.time && <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>🕐 {ev.time}</p>}
                      {ev.notes && <p style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: 2 }}>{ev.notes}</p>}
                    </div>
                    {(ev.source === 'manual' || ev.source === 'manual-recurring') && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost" onClick={() => startEdit(ev)}><Pencil size={13} /></button>
                        <button className="btn btn-ghost" onClick={() => removeEvent(ev.id)}><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── WEEK VIEW ──────────────────────────────────────────────────────────────
  const renderWeek = () => {
    const monday = new Date(currentDate)
    const dow = monday.getDay()
    monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1))
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      days.push(d)
    }
    const todayStr = toDateStr(today)

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {days.map(d => {
          const dateStr = toDateStr(d)
          const dayEvents = getEventsForDate(dateStr)
          const isToday = dateStr === todayStr
          return (
            <div key={dateStr} style={{ background: isToday ? 'var(--rose-50)' : 'var(--white)', border: `1.5px solid ${isToday ? 'var(--rose-300)' : 'var(--gray-100)'}`, borderRadius: 10, padding: '10px 8px', minHeight: 100, overflow: 'hidden' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', marginBottom: 2 }}>{DAY_NAMES[d.getDay()]}</p>
              <p style={{ fontSize: '1rem', fontWeight: 800, color: isToday ? 'var(--rose-400)' : 'var(--gray-800)', marginBottom: 8 }}>{d.getDate()}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dayEvents.slice(0, 3).map(ev => {
                  const t = EVENT_TYPES[ev.type] || EVENT_TYPES.other
                  return (
                    <div key={ev.id} style={{ fontSize: '0.65rem', fontWeight: 600, background: t.bg, color: t.color, borderRadius: 4, padding: '2px 5px', display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
                      <span style={{ flexShrink: 0, lineHeight: 1 }}>{smartEmoji(t.emoji)}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                      {(ev.source === 'manual' || ev.source === 'manual-recurring') && (
                        <>
                          <button onClick={() => startEdit(ev)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', opacity: 0.6, lineHeight: 1 }}><Pencil size={10} /></button>
                          <button onClick={() => removeEvent(ev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', opacity: 0.6, lineHeight: 1 }}><Trash2 size={10} /></button>
                        </>
                      )}
                    </div>
                  )
                })}
                {dayEvents.length > 3 && (
                  <div style={{ fontSize: '0.6rem', color: 'var(--gray-400)', fontWeight: 600 }}>+{dayEvents.length - 3} mais</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  const renderList = () => {
    const upcoming = filterEvents(events)
      .filter(e => e.type !== 'study' && e.date >= toDateStr(today))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 50)

    if (upcoming.length === 0) return <div className="empty-state"><div className="e-emoji"><CalendarEmoji size="2em" /></div><p>Sem eventos próximos.</p></div>

    let lastDate = ''
    return (
      <div>
        {upcoming.map(ev => {
          const t = EVENT_TYPES[ev.type] || EVENT_TYPES.other
          const isNewDate = ev.date !== lastDate
          lastDate = ev.date
          const d = new Date(ev.date + 'T12:00:00')
          const daysLeft = Math.round((d - today) / 86400000)

          return (
            <div key={ev.id}>
              {isNewDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 6px' }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-600)' }}>
                    {d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <span style={{ fontSize: '0.68rem', color: 'var(--gray-400)', fontWeight: 600 }}>
                    {daysLeft === 0 ? 'hoje' : daysLeft === 1 ? 'amanhã' : `em ${daysLeft} dias`}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: t.bg, borderRadius: 8, marginBottom: 4, border: `1px solid ${t.color}20` }}>
                <span style={{ fontSize: '1rem' }}>{smartEmoji(t.emoji)}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: '0.83rem', color: t.color }}>{ev.title}</p>
                  {ev.subtitle && <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{ev.subtitle}</p>}
                </div>
                {ev.time && <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 600 }}>{ev.time}</span>}
                {(ev.source === 'manual' || ev.source === 'manual-recurring') && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost" onClick={() => startEdit(ev)}><Pencil size={13} /></button>
                    <button className="btn btn-ghost" onClick={() => removeEvent(ev.id)}><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const monthLabel = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1><CalendarEmoji /> Calendário</h1>
          <p className="subtitle">
            Exames, deadlines, reuniões e sessões de estudo
            {gcalEvents.length > 0 && ` · ${gcalEvents.length} eventos do Google`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={showGCal ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => setShowGCal(v => !v)}>
            <CalendarEmoji /> Google Calendar
          </button>
          <button className="btn btn-primary" onClick={() => {
            if (showForm) { resetForm() }
            else { setEditingEvent(null); setForm({ title: '', type: 'meeting', date: toDateStr(today), time: '', notes: '', recurrence: 'Nunca' }); setShowForm(true) }
          }}>
            <Plus size={14} /> Novo evento
          </button>
        </div>
      </div>

      {/* Google Calendar panel */}
      {showGCal && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title"><CalendarEmoji /> Google Calendar</span>
            <button
              className="btn btn-secondary"
              onClick={syncGoogle}
              disabled={syncing || !gcalConfig.urls.length}
              style={{ fontSize: '0.78rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <RefreshCw size={13} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
              {syncing ? 'A sincronizar...' : 'Sincronizar'}
            </button>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Instruction */}
            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '0.78rem', color: 'var(--gray-500)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--gray-700)' }}>Como obter o URL:</strong> Google Calendar → ⚙️ Definições → clica no teu calendário → "Endereço secreto no formato iCal" → copia o URL
            </div>

            {/* Existing calendars */}
            {gcalConfig.urls.map((cal, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#e8f0fe', border: '1px solid #c5d8fb', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1a73e8', display: 'flex', alignItems: 'center', gap: 4 }}><CalendarEmoji /> {cal.label}</span>
                <span style={{ fontSize: '0.72rem', color: '#4285f4', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cal.url}</span>
                <button className="btn btn-ghost" onClick={() => removeCalendar(idx)} style={{ padding: '3px 6px' }}><Trash2 size={12} /></button>
              </div>
            ))}

            {/* Add new calendar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  value={newCal.label}
                  onChange={e => setNewCal(p => ({ ...p, label: e.target.value }))}
                  placeholder="Nome (ex: Faculdade)"
                  style={{ width: 160 }}
                />
                <input
                  className="form-input"
                  value={newCal.url}
                  onChange={e => setNewCal(p => ({ ...p, url: e.target.value }))}
                  placeholder="URL iCal (webcal:// ou https://)"
                  style={{ flex: 1 }}
                  onKeyDown={e => e.key === 'Enter' && addCalendar()}
                />
                <button className="btn btn-primary" onClick={addCalendar} disabled={!newCal.url.trim()}>
                  <Plus size={14} /> Adicionar
                </button>
              </div>
              {syncError && <p style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>⚠️ {syncError}</p>}
              {gcalEvents.length > 0 && !syncing && (
                <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontWeight: 500 }}>
                  ✓ {gcalEvents.length} eventos importados
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add event form */}
      {showForm && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: 20, boxShadow: 'var(--shadow-xs)' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--gray-700)', marginBottom: 14 }}>{editingEvent ? 'Editar evento' : 'Novo evento'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Título</label>
              <input type="text" style={inputStyle} placeholder="Ex: Reunião de grupo" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select style={inputStyle} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {MANUAL_TYPES.map(t => <option key={t} value={t}>{EVENT_TYPES[t].emoji} {EVENT_TYPES[t].label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Data</label>
              <input type="date" style={inputStyle} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Hora (opcional)</label>
              <input type="time" style={inputStyle} value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Recorrência</label>
              <select style={inputStyle} value={form.recurrence} onChange={e => setForm(p => ({ ...p, recurrence: e.target.value }))}>
                {RECURRENCE.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Notas (opcional)</label>
              <input type="text" style={inputStyle} placeholder="Observações..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={saveEvent}><Plus size={14} /> Guardar</button>
            <button className="btn btn-secondary" onClick={resetForm}>Cancelar</button>
          </div>
        </div>
      )}

      {/* View switcher + navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['month','week'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '6px 14px', borderRadius: 50, fontFamily: 'inherit', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
              border: `2px solid ${view === v ? 'var(--rose-400)' : 'var(--gray-200)'}`,
              background: view === v ? 'var(--rose-50)' : 'var(--white)',
              color: view === v ? 'var(--rose-400)' : 'var(--gray-500)',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              {v === 'month' ? <><CalendarEmoji /> Mensal</> : '📋 Semanal'}
            </button>
          ))}
        </div>

        {view !== 'list' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ padding: '6px 10px' }}><ChevronLeft size={16} /></button>
            <p style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--gray-700)', minWidth: 130, textAlign: 'center' }}>{monthLabel}</p>
            <button className="btn btn-secondary" onClick={() => navigate(1)} style={{ padding: '6px 10px' }}><ChevronRight size={16} /></button>
            <button className="btn btn-secondary" onClick={() => setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))} style={{ fontSize: '0.75rem' }}>Hoje</button>
          </div>
        )}
      </div>

      {/* Legend / filters */}
      <div style={{ display: 'flex', gap: 6, rowGap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {activeFilters.size > 0 && (
          <button
            onClick={() => setActiveFilters(new Set())}
            style={{
              fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px', borderRadius: 50,
              background: 'var(--gray-100)', color: 'var(--gray-500)',
              border: '1.5px solid var(--gray-300)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ✕ Limpar filtros
          </button>
        )}
        {Object.entries(EVENT_TYPES).filter(([k]) => k !== 'study' && k !== 'google').map(([k, t]) => {
          const active = activeFilters.has(k)
          return (
            <button
              key={k}
              onClick={() => toggleFilter(k)}
              style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px', borderRadius: 50,
                background: active ? t.color : t.bg,
                color: active ? 'white' : t.color,
                border: `1.5px solid ${active ? t.color : t.color + '44'}`,
                cursor: 'pointer', fontFamily: 'inherit',
                opacity: activeFilters.size > 0 && !active ? 0.45 : 1,
                transition: 'all 0.15s',
              }}
            >
              {smartEmoji(t.emoji)} {t.label}
            </button>
          )
        })}
      </div>

      {/* View content */}
      {view === 'month' && renderMonth()}
      {view === 'week'  && renderWeek()}

    </div>
  )
}

const labelStyle = { display: 'block', fontSize: '0.73rem', fontWeight: 700, color: 'var(--gray-500)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }
const inputStyle = { width: '100%', fontFamily: 'inherit', fontSize: '0.88rem', border: '1.5px solid var(--gray-200)', borderRadius: 8, padding: '8px 10px', outline: 'none', background: 'var(--white)', color: 'var(--gray-900)', boxSizing: 'border-box' }