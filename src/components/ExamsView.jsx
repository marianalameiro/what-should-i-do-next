import { useState, useEffect } from "react"
import { Plus, X, ChevronDown, ChevronUp, Trash2, GripVertical, Pencil } from "lucide-react"
import { CalendarEmoji } from './CalendarEmoji'
import { CONFIDENCE, EVENT_TYPES } from '../constants'
import { daysUntil } from '../utils/dates'
import { activeSubjects, withoutClosedSubjects } from '../utils/subjects'
import { useToast, ToastContainer } from './Toast'

function exportICS(exams) {
  const withDate = exams.filter(e => e.date)
  if (withDate.length === 0) return
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//WhatShouldIDoNext//PT','CALSCALE:GREGORIAN','METHOD:PUBLISH']
  withDate.forEach(exam => {
    const d = exam.date.replace(/-/g, '')
    const next = new Date(exam.date + 'T12:00:00'); next.setDate(next.getDate() + 1)
    const dEnd = next.toISOString().split('T')[0].replace(/-/g, '')
    lines.push('BEGIN:VEVENT')
    lines.push(`DTSTART;VALUE=DATE:${d}`)
    lines.push(`DTEND;VALUE=DATE:${dEnd}`)
    lines.push(`SUMMARY:${(exam.type || 'Exame')} \u2014 ${exam.subject}`)
    const desc = [`Meta: ${exam.minGrade}/20`, exam.weight ? `${exam.weight}% da nota` : null, exam.notes || null].filter(Boolean).join(' \u00b7 ')
    if (desc) lines.push(`DESCRIPTION:${desc}`)
    lines.push(`UID:${exam.id}@wsidnt`)
    lines.push('END:VEVENT')
  })
  lines.push('END:VCALENDAR')
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'exames.ics'; a.click()
  URL.revokeObjectURL(url)
}

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
  const subjects = activeSubjects(settings)
  const firstSubjectName = subjects[0]?.name || ''

  const [allExams, setExams]    = useState(() => load("exams", []))
  // Closed subjects must vanish everywhere — hide their exams from the whole view.
  const exams = withoutClosedSubjects(allExams, settings)
  const [topics, setTopics]     = useState(() => load("topics", {}))
  const [schedule, setSchedule] = useState(() => load("exam-schedule", {}))
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [aiResult, setAiResult] = useState("")
  const [aiPlan, setAiPlan]     = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMinimized, setAiMinimized] = useState(false)

  const [selectedSubject, setSelectedSubject] = useState(firstSubjectName)
  const [showForm, setShowForm]               = useState(false)
  const [editingExamId, setEditingExamId]     = useState(null)
  const [expanded, setExpanded]               = useState(null)
  // dragging: { topic, fromDate } — fromDate is null when dragging from topic list
  const [dragging, setDragging]               = useState(null)
  const [dragOver, setDragOver]               = useState(null)
  const [newTopic, setNewTopic]               = useState("")
  const [newDoubt, setNewDoubt]               = useState({}) // { [topicId]: string }
  const { toasts, toast, dismiss }            = useToast()

  const [form, setForm] = useState({
    subject: firstSubjectName,
    type: "Exame",
    date: "",
    minGrade: 10,
    desiredGrade: "",
    weight: "",
    notes: "",
  })
  const [examTab, setExamTab] = useState("upcoming") // "upcoming" | "past"

  useEffect(() => save("exams", allExams),          [allExams])
  useEffect(() => save("topics", topics),           [topics])
  useEffect(() => save("exam-schedule", schedule),  [schedule])

  // Migração única (corre uma só vez no histórico do utilizador, não a cada montagem):
  // preenche a cadeira nos temas agendados antigos, procurando o dono de cada tópico pelo id.
  useEffect(() => {
    if (localStorage.getItem('sched-subject-migrated')) return
    let changed = false
    const next = {}
    for (const [date, arr] of Object.entries(schedule)) {
      next[date] = (arr || []).map(t => {
        if (t.subject) return t
        const owner = Object.keys(topics).find(name => (topics[name] || []).some(x => x.id === t.id))
        if (owner) { changed = true; return { ...t, subject: owner } }
        return t
      })
    }
    if (changed) setSchedule(next)
    localStorage.setItem('sched-subject-migrated', '1')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emptyForm = { subject: firstSubjectName, type: "Exame", date: "", minGrade: 10, desiredGrade: "", weight: "", notes: "" }

  function openEditForm(exam) {
    setForm({ subject: exam.subject, type: exam.type, date: exam.date, minGrade: exam.minGrade, desiredGrade: exam.desiredGrade ?? "", weight: exam.weight ?? "", notes: exam.notes || "" })
    setEditingExamId(exam.id)
    setShowForm(true)
    setTimeout(() => document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' }), 20)
  }

  function closeForm() {
    setShowForm(false)
    setEditingExamId(null)
    setForm(emptyForm)
  }

  function saveExam() {
    if (!form.date) return
    const payload = {
      ...form,
      weight: form.weight ? parseFloat(form.weight) : null,
      desiredGrade: form.desiredGrade !== "" ? parseFloat(form.desiredGrade) : null,
    }
    if (editingExamId) {
      setExams(prev => prev.map(e => e.id === editingExamId ? { ...e, ...payload } : e))
    } else {
      setExams(prev => [...prev, { id: Date.now(), ...payload, sheets: [] }])
    }
    closeForm()
  }

  function updateActualGrade(id, grade) {
    setExams(prev => prev.map(e => e.id === id ? { ...e, actualGrade: grade === "" ? null : parseFloat(grade) } : e))
  }

  // study hours per exam subject (all time)
  function studyHoursForExam(exam) {
    try {
      const sessions = JSON.parse(localStorage.getItem("study-sessions") || "[]")
      return parseFloat(sessions.filter(s => s.subject === exam.subject || s.subject === subjects.find(x => x.name === exam.subject)?.key).reduce((a, b) => a + b.hours, 0).toFixed(1))
    } catch { return 0 }
  }

  function removeExam(id) {
    let removed = null
    setExams(e => { removed = e.find(x => x.id === id); return e.filter(x => x.id !== id) })
    toast({ message: 'Exame eliminado', onUndo: () => { if (removed) setExams(e => [...e, removed].sort((a, b) => new Date(a.date) - new Date(b.date))) } })
  }

  const subjectTopics = topics[selectedSubject] || []
  // Um tema agendado pertence à cadeira selecionada se foi agendado para ela
  // (campo subject) ou, para agendamentos antigos, se o id está nos tópicos dela.
  const selectedTopicIds = new Set(subjectTopics.map(t => t.id))
  const belongsToSelected = (t) => t.subject ? t.subject === selectedSubject : selectedTopicIds.has(t.id)

  function addTopic() {
    if (!newTopic.trim()) return
    setTopics({ ...topics, [selectedSubject]: [...(topics[selectedSubject] || []), { id: Date.now(), name: newTopic, confidence: "unknown", doubts: [] }] })
    setNewTopic("")
  }

  function updateTopic(id, field, value) {
    const extra = field === 'confidence' ? { lastReviewed: new Date().toDateString() } : {}
    setTopics({ ...topics, [selectedSubject]: subjectTopics.map(t => t.id === id ? { ...t, [field]: value, ...extra } : t) })
  }

  // Normalize doubts: handle legacy string format and missing field
  function getDoubts(topic) {
    if (!topic.doubts) return []
    if (typeof topic.doubts === "string") return topic.doubts.trim() ? [{ id: 0, text: topic.doubts }] : []
    return topic.doubts
  }

  function addDoubt(topicId) {
    const text = (newDoubt[topicId] || "").trim()
    if (!text) return
    setTopics({ ...topics, [selectedSubject]: subjectTopics.map(t =>
      t.id === topicId ? { ...t, doubts: [...getDoubts(t), { id: Date.now(), text }] } : t
    )})
    setNewDoubt(d => ({ ...d, [topicId]: "" }))
  }

  function removeDoubt(topicId, doubtId) {
    setTopics({ ...topics, [selectedSubject]: subjectTopics.map(t =>
      t.id === topicId ? { ...t, doubts: getDoubts(t).filter(d => d.id !== doubtId) } : t
    )})
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
      // Add to target day (dedup), keeping which subject the topic belongs to
      const existing = next[targetDate] || []
      if (!existing.find(t => t.id === topic.id)) {
        next[targetDate] = [...existing, { ...topic, subject: topic.subject || selectedSubject }]
      }
      return next
    })
    setDragOver(null)
  }

  function removeFromDay(dateStr, topicId) {
    setSchedule(prev => ({ ...prev, [dateStr]: (prev[dateStr] || []).filter(t => t.id !== topicId) }))
  }

  // Apaga TODOS os temas agendados de uma vez (com opção de desfazer).
  function clearSchedule() {
    const hasAny = Object.values(schedule).some(arr => (arr || []).length > 0)
    if (!hasAny) return
    const previous = schedule
    setSchedule({})
    toast({ message: 'Agenda de estudo apagada', onUndo: () => setSchedule(previous) })
  }

  function applyAIPlan() {
    if (!aiPlan) return
    const examForSelected = exams.find(e => e.subject === selectedSubject && daysUntil(e.date) > 0)
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
          toAdd.forEach(t => { if (!existing.find(e => e.id === t.id)) existing.push({ ...t, subject: t.subject || selectedSubject }) })
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

    const exam = exams.find(e => e.subject === selectedSubject && daysUntil(e.date) > 0)
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

  // "A vir" hides closed subjects. O Arquivo mantém TODAS as avaliações passadas
  // (incl. de cadeiras fechadas) como histórico de notas, com as mais recentes primeiro.
  const upcomingExams = [...exams]
    .filter(e => daysUntil(e.date) > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  const pastExams = [...allExams]
    .filter(e => daysUntil(e.date) <= 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  const shownExams = examTab === 'upcoming' ? upcomingExams : pastExams
  const hasAnyExam = upcomingExams.length > 0 || pastExams.length > 0

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* ── Header ── */}
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1>🎯 Exames & Estudo</h1>
          <p className="subtitle">{exams.length === 0 ? "Nenhum evento registado" : `${exams.length} evento${exams.length !== 1 ? "s" : ""} registado${exams.length !== 1 ? "s" : ""}`}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => { setEditingExamId(null); setForm(emptyForm); setShowForm(v => !v) }}>
            <Plus size={14} /> Novo evento
          </button>
        </div>
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <span className="card-title">{editingExamId ? "Editar evento" : "Novo evento de avaliação"}</span>
            <button className="btn-ghost btn" onClick={closeForm}><X size={14} /></button>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="form-label">Disciplina</label>
                <select className="form-input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
                  {(subjects.some(s => s.name === form.subject) ? subjects.map(s => s.name) : [form.subject, ...subjects.map(s => s.name)])
                    .filter(Boolean)
                    .map(name => <option key={name} value={name}>{name}</option>)}
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
              <div>
                <label className="form-label">Nota desejada</label>
                <input className="form-input" type="number" min={0} max={20} placeholder="ex: 16" value={form.desiredGrade} onChange={e => setForm({ ...form, desiredGrade: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Peso na nota final (%)</label>
                <input className="form-input" type="number" min={0} max={100} placeholder="ex: 40" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="form-label">Notas (opcional)</label>
              <input className="form-input" value={form.notes} placeholder="Notas sobre o evento…" onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={closeForm}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveExam} disabled={!form.date}>
                {editingExamId ? "Guardar alterações" : <><Plus size={14} /> Guardar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Exams list tabs ── */}
      {hasAnyExam && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[['upcoming','📅 A vir'],['past','🗂️ Arquivo']].map(([id, label]) => (
            <button key={id} onClick={() => setExamTab(id)}
              style={{ padding: '6px 14px', borderRadius: 50, fontFamily: 'inherit', fontWeight: 700, fontSize: 'var(--t-caption)', cursor: 'pointer',
                border: `2px solid ${examTab === id ? 'var(--rose-400)' : 'var(--gray-200)'}`,
                background: examTab === id ? 'var(--rose-50)' : 'var(--white)', color: examTab === id ? 'var(--rose-400)' : 'var(--gray-500)' }}>
              {label} ({(id === 'upcoming' ? upcomingExams : pastExams).length})
            </button>
          ))}
        </div>
      )}

      {allExams.length === 0 ? (
        <div style={{
          padding: '32px 28px', textAlign: 'center',
          background: 'var(--white)', borderRadius: 'var(--r)',
          border: '1.5px dashed var(--gray-200)', marginBottom: 14,
        }}>
          <p style={{ fontSize: '2rem', marginBottom: 10 }}>🗓️</p>
          <p style={{ fontWeight: 800, color: 'var(--gray-800)', marginBottom: 6, fontSize: 'var(--t-body)' }}>
            Que avaliações tens este semestre?
          </p>
          <p style={{ fontSize: 'var(--t-body)', color: 'var(--gray-400)', marginBottom: 20, lineHeight: 1.55, maxWidth: 340, margin: '0 auto 20px' }}>
            Exames, testes, mini-testes, apresentações — regista tudo para saber sempre quanto tempo tens e quanto já estudaste.
          </p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Adicionar primeira avaliação
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {shownExams.map(exam => {
            const days = daysUntil(exam.date)
            const pill = urgencyPill(days)
            const open = expanded === exam.id
            const isPast = days < 0
            const studyH = studyHoursForExam(exam)
            return (
              <div key={exam.id} className="card">
                <div
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer" }}
                  onClick={() => setExpanded(open ? null : exam.id)}
                >
                  <div style={{
                    textAlign: "center", background: isPast ? 'var(--green-50)' : "var(--gray-50)", border: `1px solid ${isPast ? '#bbf7d0' : 'var(--gray-200)'}`,
                    borderRadius: "var(--r)", padding: "8px 14px", minWidth: 64, flexShrink: 0,
                  }}>
                    {isPast && exam.actualGrade != null ? (
                      <>
                        <div style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: -1, lineHeight: 1, color: exam.actualGrade >= 10 ? '#16a34a' : '#dc2626' }}>{exam.actualGrade}</div>
                        <div style={{ fontSize: "var(--t-caption)", fontWeight: 700, letterSpacing: 0.5, color: "var(--gray-400)", marginTop: 2 }}>nota</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: -1, lineHeight: 1, color: days <= 7 ? "var(--red-400)" : days <= 21 ? "var(--amber-400)" : "var(--green-500)" }}>{Math.abs(days)}</div>
                        <div style={{ fontSize: "var(--t-caption)", fontWeight: 700, letterSpacing: 0.5, color: "var(--gray-400)", marginTop: 2 }}>{days < 0 ? "atrás" : "dias"}</div>
                      </>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: "var(--t-body)", color: "var(--gray-900)" }}>{exam.subject}</span>
                      {!isPast && <span className={pill.cls}>{pill.label}</span>}
                      {isPast && exam.actualGrade != null && <span className={exam.actualGrade >= exam.minGrade ? "status-pill status-green" : "status-pill status-red"}>{exam.actualGrade >= exam.minGrade ? "✅ Aprovada" : "❌ Reprovada"}</span>}
                    </div>
                    <div style={{ fontSize: "var(--t-caption)", color: "var(--gray-400)", fontWeight: 500 }}>
                      {exam.type} · {new Date(exam.date).toLocaleDateString("pt-PT", { day: "numeric", month: "long" })} · Mín: {exam.minGrade}/20{exam.desiredGrade != null ? ` · Desejada: ${exam.desiredGrade}/20` : ''}{exam.weight ? ` · ${exam.weight}% da nota` : ''}
                    </div>
                    {studyH > 0 && ['Exame','Teste','Mini-teste'].includes(exam.type) && <div style={{ fontSize: "var(--t-caption)", color: "var(--gray-400)", marginTop: 2 }}>⏱️ {studyH}h de estudo registadas nesta cadeira</div>}
                    {exam.notes && <div style={{ fontSize: "var(--t-caption)", color: "var(--gray-500)", marginTop: 3 }}>{exam.notes}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <button className="btn btn-ghost" onClick={e => { e.stopPropagation(); openEditForm(exam) }} style={{ padding: "5px 8px" }} title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button className="btn btn-ghost" onClick={e => { e.stopPropagation(); removeExam(exam.id) }} style={{ padding: "5px 8px" }}>
                      <Trash2 size={14} />
                    </button>
                    {open ? <ChevronUp size={16} color="var(--gray-400)" /> : <ChevronDown size={16} color="var(--gray-400)" />}
                  </div>
                </div>
                {open && (
                  <div style={{ borderTop: "1px solid var(--gray-100)", padding: "14px 18px" }}>
                    {isPast && (
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: "var(--t-caption)", fontWeight: 700, color: "var(--gray-500)", display: "block", marginBottom: 4, letterSpacing: 0.4 }}>
                          Nota obtida (0–20)
                        </label>
                        <input
                          className="form-input"
                          type="number" min={0} max={20} step={0.1}
                          value={exam.actualGrade ?? ""}
                          placeholder="Insere a nota que tiraste…"
                          onChange={e => updateActualGrade(exam.id, e.target.value)}
                          style={{ maxWidth: 160 }}
                        />
                        {exam.actualGrade != null && (
                          <p style={{ fontSize: "var(--t-caption)", marginTop: 6, color: exam.actualGrade >= exam.minGrade ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                            {exam.actualGrade >= exam.minGrade ? `✅ Acima da meta (${exam.minGrade}/20)` : `❌ Abaixo da meta (${exam.minGrade}/20)`}
                          </p>
                        )}
                      </div>
                    )}
                    {!isPast && <p style={{ fontSize: "var(--t-body)", color: "var(--gray-500)" }}>Ainda não passou a data — o resultado ficará disponível aqui após o exame.</p>}
                  </div>
                )}
              </div>
            )
          })}
          {shownExams.length === 0 && (
            <div className="card"><div className="empty-state" style={{ padding: 24 }}>
              <p style={{ color: 'var(--gray-400)', fontSize: 'var(--t-body)' }}>{examTab === 'upcoming' ? 'Nenhum exame futuro — boas férias! 🎉' : 'Nenhum exame passado ainda.'}</p>
            </div></div>
          )}
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
              style={{ fontSize: "var(--t-caption)", padding: "5px 12px" }}
            >
              {s.emoji} {s.name}
            </button>
          ))}
        </div>
        <div className="card-body" style={{ paddingTop: 14 }}>
          {subjectTopics.length === 0 ? (
            <p style={{ fontSize: "var(--t-body)", color: "var(--gray-400)", textAlign: "center", padding: "16px 0" }}>
              Nenhum tópico ainda. Adiciona abaixo!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {subjectTopics.map(topic => {
                const conf = CONFIDENCE.find(c => c.id === topic.confidence)
                const doubts = getDoubts(topic)
                return (
                  <div key={topic.id} style={{
                    background: "var(--gray-50)", borderRadius: "var(--r)",
                    border: "1px solid var(--gray-100)", overflow: "hidden",
                  }}>
                    {/* Topic header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
                      <span style={{ flex: 1, fontSize: "var(--t-body)", fontWeight: 500, color: "var(--gray-700)" }}>{topic.name}</span>
                      <select
                        className="form-input"
                        value={topic.confidence}
                        onChange={e => updateTopic(topic.id, "confidence", e.target.value)}
                        style={{ width: "auto", fontSize: "var(--t-caption)", padding: "4px 8px", background: conf?.bg, color: conf?.color, fontWeight: 600, border: "none" }}
                      >
                        {CONFIDENCE.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                      <button className="btn btn-ghost" onClick={() => removeTopic(topic.id)} style={{ padding: "4px 6px" }}>
                        <X size={13} />
                      </button>
                    </div>
                    {/* Doubts section */}
                    <div style={{ padding: "0 12px 10px", borderTop: "1px solid var(--gray-100)" }}>
                      <p style={{ fontSize: "var(--t-caption)", fontWeight: 700, color: "var(--gray-400)", letterSpacing: "0.06em", margin: "8px 0 6px" }}>
                        Dúvidas {doubts.length > 0 && <span style={{ background: "var(--rose-100)", color: "var(--rose-500)", borderRadius: 'var(--r)', padding: "0 5px", fontWeight: 700 }}>{doubts.length}</span>}
                      </p>
                      {doubts.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                          {doubts.map(d => (
                            <div key={d.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, background: "var(--white)", border: "1px solid var(--gray-200)", borderRadius: 6, padding: "5px 8px" }}>
                              <span style={{ flex: 1, fontSize: "var(--t-body)", color: "var(--gray-700)", lineHeight: 1.4 }}>❓ {d.text}</span>
                              <button
                                onClick={() => removeDoubt(topic.id, d.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-300)", fontSize: "var(--t-body)", padding: "0 2px", lineHeight: 1, flexShrink: 0 }}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          className="form-input"
                          value={newDoubt[topic.id] || ""}
                          onChange={e => setNewDoubt(d => ({ ...d, [topic.id]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && addDoubt(topic.id)}
                          placeholder="Adicionar dúvida…"
                          style={{ flex: 1, fontSize: "var(--t-caption)", padding: "5px 8px" }}
                        />
                        <button
                          className="btn btn-secondary"
                          onClick={() => addDoubt(topic.id)}
                          disabled={!(newDoubt[topic.id] || "").trim()}
                          style={{ padding: "4px 10px", fontSize: "var(--t-caption)" }}>
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
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
            <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: "var(--t-caption)", color: "var(--gray-900)" }} onClick={clearSchedule}>
              🗑️ Apagar agenda
            </button>
            <button className="btn btn-secondary" style={{ padding: "4px 8px" }} onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
            <span style={{ fontSize: "var(--t-body)", fontWeight: 700, color: "var(--gray-700)", minWidth: 120, textAlign: "center" }}>
              {calMonth.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}
            </span>
            <button className="btn btn-secondary" style={{ padding: "4px 8px" }} onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
          </div>
        </div>
        <div className="card-body">

          {/* Draggable topics from list */}
          {subjectTopics.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              <span style={{ fontSize: "var(--t-caption)", color: "var(--gray-400)", fontWeight: 600, alignSelf: "center", marginRight: 4 }}>Arrasta para os dias →</span>
              {subjectTopics.map(topic => (
                <div
                  key={topic.id}
                  draggable
                  onDragStart={() => setDragging({ topic, fromDate: null })}
                  onDragEnd={() => { setDragging(null); setDragOver(null) }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "var(--white)", border: "1px solid var(--gray-200)",
                    borderRadius: "var(--r)", padding: "5px 10px",
                    fontSize: "var(--t-caption)", fontWeight: 500, color: "var(--gray-700)",
                    cursor: "grab", boxShadow: "var(--shadow)",
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
                  <div key={d} style={{ textAlign: "center", fontSize: "var(--t-caption)", fontWeight: 700, color: "var(--gray-400)", letterSpacing: 0.5, paddingBottom: 5 }}>{d}</div>
                ))}
                {cells.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} />
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  const dayTopics = schedule[dateStr] || []
                  const isToday = dateStr === todayStr
                  const isExamDay = examDates.has(dateStr)
                  const isDragOver = dragOver === dateStr
                  // Mostra todos os temas (sem "+N"); o botão esconde-os por completo.
                  // Só os temas agendados da cadeira atualmente selecionada
                  const visible = dayTopics.filter(belongsToSelected)

                  return (
                    <div
                      key={dateStr}
                      style={{
                        border: `1.5px solid ${isDragOver ? "var(--rose-400)" : isExamDay ? "#f97316" : isToday ? "var(--rose-300)" : dayTopics.length > 0 ? "var(--accent-200)" : "var(--gray-200)"}`,
                        borderRadius: "var(--r)",
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
                      <div style={{ fontSize: "var(--t-caption)", fontWeight: 700, color: isExamDay ? "#c2410c" : isToday ? "var(--rose-400)" : "var(--gray-500)", textAlign: "center", marginBottom: 2 }}>
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
                            fontSize: "var(--t-caption)", fontWeight: 600, color: "var(--accent-600)",
                            background: "var(--accent-100)", borderRadius: 3,
                            padding: "2px 4px", marginBottom: 2,
                            cursor: "grab",
                            opacity: dragging?.topic?.id === t.id && dragging?.fromDate === dateStr ? 0.4 : 1,
                          }}
                        >
                          <span style={{ flex: 1, wordBreak: "break-word", lineHeight: 1.3 }}>{t.name}</span>
                          <button
                            onClick={e => { e.stopPropagation(); removeFromDay(dateStr, t.id) }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-400)", padding: 0, lineHeight: 1, flexShrink: 0, fontSize: "var(--t-caption)" }}
                          >✕</button>
                        </div>
                      ))}
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
              style={{ fontSize: "var(--t-caption)", padding: "6px 14px" }}
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
                <p style={{ fontSize: "var(--t-body)", color: "var(--gray-700)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{aiResult}</p>
                {aiPlan && Object.keys(aiPlan).length > 0 && (
                  <div style={{
                    marginTop: 14, padding: "12px 14px",
                    background: "var(--rose-50)", border: "1.5px solid var(--rose-200)",
                    borderRadius: "var(--r)", display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: "var(--t-body)", color: "var(--rose-600)", marginBottom: 2 }}>
                        <CalendarEmoji /> Plano de calendário pronto
                      </p>
                      <p style={{ fontSize: "var(--t-caption)", color: "var(--rose-400)" }}>
                        {Object.values(aiPlan).reduce((a, v) => a + v.length, 0)} sessões distribuídas por {Object.keys(aiPlan).length} dias
                      </p>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: "var(--t-body)", flexShrink: 0 }}
                      onClick={applyAIPlan}
                    >
                      Aplicar ao calendário
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="card-body">
                <p style={{ fontSize: "var(--t-caption)", color: "var(--gray-400)", fontStyle: "italic" }}>
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
