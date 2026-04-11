import { useState, useEffect } from "react"
import { Plus, X, ChevronDown, ChevronUp, Trash2, GripVertical } from "lucide-react"
import { CalendarEmoji } from './CalendarEmoji'
import { CONFIDENCE, EVENT_TYPES } from '../constants'
import { daysUntil } from '../utils/dates'

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback }
  catch { return fallback }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function urgencyPill(days) {
  if (days < 0)  return { cls: "status-pill status-red",   label: "Passou" }
  if (days <= 7) return { cls: "status-pill status-red",   label: "Urgente" }
  if (days <= 21) return { cls: "status-pill status-amber", label: "Em breve" }
  return { cls: "status-pill status-green", label: "Com tempo" }
}

export default function ExamsView({ settings }) {
  const subjects = settings?.subjects || []
  const firstSubjectName = subjects[0]?.name || ''

  const [exams, setExams]       = useState(() => load("exams", []))
  const [topics, setTopics]     = useState(() => load("topics", {}))
  const [schedule, setSchedule] = useState(() => load("exam-schedule", {}))
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [aiResult, setAiResult] = useState("")
  const [aiPlan, setAiPlan]     = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMinimized, setAiMinimized] = useState(false)

  const [selectedSubject, setSelectedSubject] = useState(firstSubjectName)
  const [showForm, setShowForm]               = useState(false)
  const [expanded, setExpanded]               = useState(null)
  // dragging: { topic, fromDate } — fromDate is null when dragging from topic list
  const [dragging, setDragging]               = useState(null)
  const [dragOver, setDragOver]               = useState(null)
  const [newTopic, setNewTopic]               = useState("")

  const [form, setForm] = useState({
    subject: firstSubjectName,
    type: "Exame",
    date: "",
    minGrade: 10,
    notes: "",
  })

  useEffect(() => save("exams", exams),             [exams])
  useEffect(() => save("topics", topics),           [topics])
  useEffect(() => save("exam-schedule", schedule),  [schedule])

  function addExam() {
    if (!form.date) return
    setExams(prev => [...prev, { id: Date.now(), ...form, sheets: [] }])
    setShowForm(false)
    setForm({ subject: firstSubjectName, type: "Exame", date: "", minGrade: 10, notes: "" })
  }

  function removeExam(id) { setExams(e => e.filter(x => x.id !== id)) }

  const subjectTopics = topics[selectedSubject] || []

  function addTopic() {
    if (!newTopic.trim()) return
    setTopics({ ...topics, [selectedSubject]: [...(topics[selectedSubject] || []), { id: Date.now(), name: newTopic, confidence: "unknown", doubts: "" }] })
    setNewTopic("")
  }

  function updateTopic(id, field, value) {
    setTopics({ ...topics, [selectedSubject]: subjectTopics.map(t => t.id === id ? { ...t, [field]: value } : t) })
  }

  function removeTopic(id) {
    setTopics({ ...topics, [selectedSubject]: subjectTopics.filter(t => t.id !== id) })
  }

  function dropTopic(targetDate) {
    if (!dragging || targetDate === dragging.fromDate) return
    const { topic, fromDate } = dragging
    setSchedule(prev => {
      const next = { ...prev }
      // Remove from source day if dragging from calendar
      if (fromDate) {
        next[fromDate] = (next[fromDate] || []).filter(t => t.id !== topic.id)
      }
      // Add to target day (dedup)
      const existing = next[targetDate] || []
      if (!existing.find(t => t.id === topic.id)) {
        next[targetDate] = [...existing, topic]
      }
      return next
    })
    setDragOver(null)
  }

  function removeFromDay(dateStr, topicId) {
    setSchedule(prev => ({ ...prev, [dateStr]: (prev[dateStr] || []).filter(t => t.id !== topicId) }))
  }

  function applyAIPlan() {
    if (!aiPlan) return
    const examForSelected = exams.find(e => e.subject === selectedSubject && daysUntil(e.date) >= 0)
    setSchedule(prev => {
      const next = { ...prev }
      // Build map only from selected subject's topics
      const topicByName = {}
      ;(topics[selectedSubject] || []).forEach(t => { topicByName[t.name.toLowerCase().trim()] = t })
      Object.entries(aiPlan).forEach(([dateStr, topicNames]) => {
        // Never schedule past the exam date
        if (examForSelected && dateStr > examForSelected.date) return
        const toAdd = []
        topicNames.forEach(name => {
          const found = topicByName[name.toLowerCase().trim()]
          if (found && !toAdd.find(t => t.id === found.id)) toAdd.push(found)
        })
        if (toAdd.length > 0) {
          const existing = next[dateStr] || []
          toAdd.forEach(t => { if (!existing.find(e => e.id === t.id)) existing.push(t) })
          next[dateStr] = existing
        }
      })
      return next
    })
    setAiPlan(null)
  }

  async function analyzeWithAI() {
    const groqKey = localStorage.getItem("groq-key")
    if (!groqKey) { setAiResult("⚠️ Configura a chave API Groq nas Definições."); return }

    const subTopics = topics[selectedSubject] || []
    if (!subTopics.length) { setAiResult("⚠️ Adiciona tópicos a esta cadeira primeiro."); return }

    const today = new Date()
    const todayStr = today.toLocaleDateString("pt-PT")
    const todayISO = today.toISOString().split("T")[0]

    const exam = exams.find(e => e.subject === selectedSubject && daysUntil(e.date) >= 0)
    const daysLeft = exam ? daysUntil(exam.date) : null
    const examDateISO = exam ? exam.date : null
    const examDateFmt = exam ? new Date(exam.date + "T12:00:00").toLocaleDateString("pt-PT") : null

    const sub = subjects.find(s => s.name === selectedSubject)
    const examHeader = exam
      ? `**${sub?.emoji || ""} ${selectedSubject}** — ${exam.type} a ${examDateFmt} (daqui a ${daysLeft} dias)\n`
      : `**${sub?.emoji || ""} ${selectedSubject}** — sem exame registado\n`

    let topicsBlock = ""
    subTopics.forEach(t => {
      const conf = CONFIDENCE.find(c => c.id === t.confidence)
      topicsBlock += `  - ${t.name} [${conf?.label || t.confidence}]`
      if (t.doubts) topicsBlock += ` — dúvidas: ${t.doubts}`
      topicsBlock += "\n"
    })

    const deadlineNote = exam
      ? `IMPORTANTE: Tens apenas ${daysLeft} dias até ao exame (${examDateISO}). O plano NÃO pode ter datas depois de ${examDateISO}.`
      : `Não há exame registado. Distribui razoavelmente pelas próximas semanas.`

    const prompt = `Hoje é ${todayStr} (${todayISO}).

TÓPICOS DE ${selectedSubject.toUpperCase()} E AUTO-AVALIAÇÃO:
${examHeader}
${topicsBlock}
${deadlineNote}

Responde em DUAS PARTES:

**PARTE 1 — Análise:**
Quais os tópicos mais urgentes? Qual a ordem de estudo? Quantas revisões recomendas para cada tópico e porquê (usa repetição espaçada)? Algum conselho específico para os tópicos com pior avaliação?

**PARTE 2 — Plano de calendário:**
Com base na repetição espaçada, distribui os tópicos por dias específicos entre hoje e o exame.
Tópicos "Não sei" precisam de 4-5 revisões. "Sei pouco" → 3 revisões. "Sei bem" → 2 revisões. "Sei muito bem" → 1 revisão.
O espaçamento entre revisões deve aumentar progressivamente (1 dia, 3 dias, 7 dias, etc.).
${exam ? `Não uses datas depois de ${examDateISO}. Tens apenas ${daysLeft} dias — adapta o número de revisões a esse limite.` : ""}

Retorna o plano como JSON EXATAMENTE neste formato (no final da resposta):
\`\`\`json
{
  "YYYY-MM-DD": ["Nome exacto do tópico 1", "Nome exacto do tópico 2"],
  "YYYY-MM-DD": ["Nome exacto do tópico 3"]
}
\`\`\`
Usa APENAS datas entre ${todayISO} e ${examDateISO || "o futuro próximo"}. Os nomes dos tópicos devem ser EXACTAMENTE iguais aos da lista acima.`

    setAiLoading(true)
    setAiResult("")
    setAiPlan(null)
    setAiMinimized(false)
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "És uma tutora de estudo para estudantes universitárias. Responde em português de Portugal. Sê prática, usa emojis e segue exactamente o formato pedido." },
            { role: "user", content: prompt },
          ],
          max_tokens: 2000,
        }),
      })
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content || "Sem resposta."
      // Extract JSON plan from the response
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/)
      if (jsonMatch) {
        try {
          const plan = JSON.parse(jsonMatch[1].trim())
          setAiPlan(plan)
        } catch { /* ignore parse errors */ }
      }
      // Show text without the JSON block
      setAiResult(content.replace(/```json[\s\S]*?```/, "").trim())
    } catch {
      setAiResult("⚠️ Erro ao contactar a IA.")
    } finally {
      setAiLoading(false)
    }
  }

  const sortedExams = [...exams].sort((a, b) => new Date(a.date) - new Date(b.date))

  return (
    <div className="fade-in">

      {/* ── Header ── */}
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1>🎯 Exames & Estudo</h1>
          <p className="subtitle">{exams.length === 0 ? "Nenhum evento registado" : `${exams.length} evento${exams.length !== 1 ? "s" : ""} registado${exams.length !== 1 ? "s" : ""}`}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          <Plus size={14} /> Novo evento
        </button>
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <span className="card-title">Novo evento de avaliação</span>
            <button className="btn-ghost btn" onClick={() => setShowForm(false)}><X size={14} /></button>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="form-label">Disciplina</label>
                <select className="form-input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
                  {subjects.map(s => <option key={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Tipo</label>
                <select className="form-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Data</label>
                <input className="form-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Nota mínima</label>
                <input className="form-input" type="number" min={0} max={20} value={form.minGrade} onChange={e => setForm({ ...form, minGrade: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className="form-label">Notas (opcional)</label>
              <input className="form-input" value={form.notes} placeholder="Notas sobre o evento…" onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addExam} disabled={!form.date}><Plus size={14} /> Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Exams list ── */}
      {sortedExams.length === 0 ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="empty-state">
            <div className="e-emoji">📋</div>
            <p>Sem eventos registados</p>
            <p style={{ fontSize: "0.78rem", marginTop: 4 }}>Adiciona o teu primeiro exame ou teste acima</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {sortedExams.map(exam => {
            const days = daysUntil(exam.date)
            const pill = urgencyPill(days)
            const open = expanded === exam.id
            return (
              <div key={exam.id} className="card">
                <div
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer" }}
                  onClick={() => setExpanded(open ? null : exam.id)}
                >
                  <div style={{
                    textAlign: "center", background: "var(--gray-50)", border: "1px solid var(--gray-200)",
                    borderRadius: "var(--radius)", padding: "8px 14px", minWidth: 64, flexShrink: 0,
                  }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: -1, lineHeight: 1, color: days <= 7 ? "var(--red-400)" : days <= 21 ? "var(--amber-400)" : "var(--green-500)" }}>
                      {Math.abs(days)}
                    </div>
                    <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--gray-400)", marginTop: 2 }}>
                      {days < 0 ? "atrás" : "dias"}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--gray-900)" }}>{exam.subject}</span>
                      <span className={pill.cls}>{pill.label}</span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--gray-400)", fontWeight: 500 }}>
                      {exam.type} · {new Date(exam.date).toLocaleDateString("pt-PT", { day: "numeric", month: "long" })} · Meta: {exam.minGrade}/20
                    </div>
                    {exam.notes && <div style={{ fontSize: "0.75rem", color: "var(--gray-500)", marginTop: 3 }}>{exam.notes}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <button className="btn btn-ghost" onClick={e => { e.stopPropagation(); removeExam(exam.id) }} style={{ padding: "5px 8px" }}>
                      <Trash2 size={14} />
                    </button>
                    {open ? <ChevronUp size={16} color="var(--gray-400)" /> : <ChevronDown size={16} color="var(--gray-400)" />}
                  </div>
                </div>
                {open && (
                  <div style={{ borderTop: "1px solid var(--gray-100)", padding: "14px 18px" }}>
                    <p style={{ fontSize: "0.83rem", color: "var(--gray-500)" }}>Plano de estudo automático — em breve.</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Topics ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <span className="card-title">📚 Tópicos</span>
        </div>
        <div style={{ display: "flex", gap: 6, padding: "12px 16px 0", flexWrap: "wrap" }}>
          {subjects.map(s => (
            <button
              key={s.name}
              onClick={() => setSelectedSubject(s.name)}
              className={selectedSubject === s.name ? "btn btn-primary" : "btn btn-secondary"}
              style={{ fontSize: "0.78rem", padding: "5px 12px" }}
            >
              {s.emoji} {s.name}
            </button>
          ))}
        </div>
        <div className="card-body" style={{ paddingTop: 14 }}>
          {subjectTopics.length === 0 ? (
            <p style={{ fontSize: "0.83rem", color: "var(--gray-400)", textAlign: "center", padding: "16px 0" }}>
              Nenhum tópico ainda. Adiciona abaixo!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {subjectTopics.map(topic => {
                const conf = CONFIDENCE.find(c => c.id === topic.confidence)
                return (
                  <div key={topic.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "var(--gray-50)", borderRadius: "var(--radius-sm)",
                    padding: "8px 12px", border: "1px solid var(--gray-100)",
                  }}>
                    <span style={{ flex: 1, fontSize: "0.85rem", fontWeight: 500, color: "var(--gray-700)" }}>{topic.name}</span>
                    <select
                      className="form-input"
                      value={topic.confidence}
                      onChange={e => updateTopic(topic.id, "confidence", e.target.value)}
                      style={{ width: "auto", fontSize: "0.78rem", padding: "4px 8px", background: conf?.bg, color: conf?.color, fontWeight: 600, border: "none" }}
                    >
                      {CONFIDENCE.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <input
                      className="form-input"
                      value={topic.doubts}
                      placeholder="Dúvidas…"
                      onChange={e => updateTopic(topic.id, "doubts", e.target.value)}
                      style={{ width: 180, fontSize: "0.78rem", padding: "4px 8px" }}
                    />
                    <button className="btn btn-ghost" onClick={() => removeTopic(topic.id)} style={{ padding: "4px 6px" }}>
                      <X size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="form-input"
              value={newTopic}
              onChange={e => setNewTopic(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTopic()}
              placeholder="Novo tópico…"
            />
            <button className="btn btn-primary" onClick={addTopic} disabled={!newTopic.trim()}>
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Study calendar ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><CalendarEmoji /> Calendário de estudo</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-secondary" style={{ padding: "4px 8px" }} onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--gray-700)", minWidth: 120, textAlign: "center" }}>
              {calMonth.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}
            </span>
            <button className="btn btn-secondary" style={{ padding: "4px 8px" }} onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
          </div>
        </div>
        <div className="card-body">

          {/* Draggable topics from list */}
          {subjectTopics.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              <span style={{ fontSize: "0.72rem", color: "var(--gray-400)", fontWeight: 600, alignSelf: "center", marginRight: 4 }}>Arrasta para os dias →</span>
              {subjectTopics.map(topic => (
                <div
                  key={topic.id}
                  draggable
                  onDragStart={() => setDragging({ topic, fromDate: null })}
                  onDragEnd={() => { setDragging(null); setDragOver(null) }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "var(--white)", border: "1px solid var(--gray-200)",
                    borderRadius: "var(--radius-sm)", padding: "5px 10px",
                    fontSize: "0.78rem", fontWeight: 500, color: "var(--gray-700)",
                    cursor: "grab", boxShadow: "var(--shadow-xs)",
                    opacity: dragging?.topic?.id === topic.id && dragging?.fromDate === null ? 0.5 : 1,
                  }}
                >
                  <GripVertical size={11} color="var(--gray-400)" /> {topic.name}
                </div>
              ))}
            </div>
          )}

          {/* Calendar grid */}
          {(() => {
            const year = calMonth.getFullYear()
            const month = calMonth.getMonth()
            const daysInMonth = new Date(year, month + 1, 0).getDate()
            const firstDow = new Date(year, month, 1).getDay()
            const offset = firstDow === 0 ? 6 : firstDow - 1
            const todayStr = new Date().toISOString().split("T")[0]
            const cells = []
            for (let i = 0; i < offset; i++) cells.push(null)
            for (let d = 1; d <= daysInMonth; d++) cells.push(d)

            // Only highlight the exam date for the currently selected subject
            const examDates = new Set(
              exams.filter(e => e.subject === selectedSubject).map(e => e.date).filter(d => {
                const [ey, em] = d.split("-").map(Number)
                return ey === year && em === month + 1
              })
            )

            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 3 }}>
                {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d => (
                  <div key={d} style={{ textAlign: "center", fontSize: "0.62rem", fontWeight: 700, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: 0.5, paddingBottom: 5 }}>{d}</div>
                ))}
                {cells.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} />
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  const dayTopics = schedule[dateStr] || []
                  const isToday = dateStr === todayStr
                  const isExamDay = examDates.has(dateStr)
                  const isDragOver = dragOver === dateStr
                  const SHOW_MAX = 2
                  const visible = dayTopics.slice(0, SHOW_MAX)
                  const overflow = dayTopics.length - SHOW_MAX

                  return (
                    <div
                      key={dateStr}
                      style={{
                        border: `1.5px solid ${isDragOver ? "var(--rose-400)" : isExamDay ? "#f97316" : isToday ? "var(--rose-300)" : dayTopics.length > 0 ? "var(--accent-200)" : "var(--gray-200)"}`,
                        borderRadius: "var(--radius-sm)",
                        minHeight: 60,
                        padding: "3px",
                        background: isDragOver ? "var(--rose-50)" : isExamDay ? "#fff7ed" : isToday ? "#fff1f2" : dayTopics.length > 0 ? "var(--accent-50)" : "var(--white)",
                        transition: "border-color 0.1s, background 0.1s",
                        boxSizing: "border-box",
                      }}
                      onDragOver={e => { e.preventDefault(); setDragOver(dateStr) }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null) }}
                      onDrop={() => dropTopic(dateStr)}
                    >
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: isExamDay ? "#c2410c" : isToday ? "var(--rose-400)" : "var(--gray-500)", textAlign: "center", marginBottom: 2 }}>
                        {day}{isExamDay ? " 🎯" : ""}
                      </div>
                      {visible.map(t => (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={e => { e.stopPropagation(); setDragging({ topic: t, fromDate: dateStr }) }}
                          onDragEnd={() => { setDragging(null); setDragOver(null) }}
                          style={{
                            display: "flex", alignItems: "center", gap: 2,
                            fontSize: "0.58rem", fontWeight: 600, color: "var(--accent-600)",
                            background: "var(--accent-100)", borderRadius: 3,
                            padding: "2px 4px", marginBottom: 2,
                            cursor: "grab",
                            opacity: dragging?.topic?.id === t.id && dragging?.fromDate === dateStr ? 0.4 : 1,
                          }}
                        >
                          <span style={{ flex: 1, wordBreak: "break-word", lineHeight: 1.3 }}>{t.name}</span>
                          <button
                            onClick={e => { e.stopPropagation(); removeFromDay(dateStr, t.id) }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-400)", padding: 0, lineHeight: 1, flexShrink: 0, fontSize: "0.7rem" }}
                          >✕</button>
                        </div>
                      ))}
                      {overflow > 0 && (
                        <div style={{ fontSize: "0.55rem", fontWeight: 700, color: "var(--gray-400)", textAlign: "center", marginTop: 1 }}>+{overflow}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── AI Study Planner ── */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-header">
          <span className="card-title">🤖 Plano de estudo com IA</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {aiResult && (
              <button
                className="btn btn-ghost"
                style={{ padding: "4px 8px" }}
                onClick={() => setAiMinimized(v => !v)}
                title={aiMinimized ? "Expandir" : "Minimizar"}
              >
                {aiMinimized ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
              </button>
            )}
            <button
              className="btn btn-primary"
              style={{ fontSize: "0.78rem", padding: "6px 14px" }}
              onClick={analyzeWithAI}
              disabled={aiLoading}
            >
              {aiLoading ? "⏳ A analisar..." : "✨ Analisar"}
            </button>
          </div>
        </div>

        {!aiMinimized && (
          <>
            {aiResult ? (
              <div className="card-body">
                <p style={{ fontSize: "0.83rem", color: "var(--gray-700)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{aiResult}</p>
                {aiPlan && Object.keys(aiPlan).length > 0 && (
                  <div style={{
                    marginTop: 14, padding: "12px 14px",
                    background: "var(--rose-50)", border: "1.5px solid var(--rose-200)",
                    borderRadius: "var(--radius)", display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: "0.83rem", color: "var(--rose-600)", marginBottom: 2 }}>
                        <CalendarEmoji /> Plano de calendário pronto
                      </p>
                      <p style={{ fontSize: "0.75rem", color: "var(--rose-400)" }}>
                        {Object.values(aiPlan).reduce((a, v) => a + v.length, 0)} sessões distribuídas por {Object.keys(aiPlan).length} dias
                      </p>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: "0.8rem", flexShrink: 0 }}
                      onClick={applyAIPlan}
                    >
                      Aplicar ao calendário
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="card-body">
                <p style={{ fontSize: "0.78rem", color: "var(--gray-400)", fontStyle: "italic" }}>
                  Adiciona tópicos com auto-avaliação e clica Analisar — a IA sugere ordem de estudo, prioridades, número de revisões com base nos exames e distribui as revisões por dias específicos no calendário.
                </p>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  )
}
