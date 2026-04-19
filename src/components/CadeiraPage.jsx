import { useState } from 'react'
import { ArrowLeft, Clock, Target, Trophy, ChevronDown, ChevronUp, NotebookPen, BookOpen } from 'lucide-react'
import { getMondayOfWeek } from '../utils/dates'
import { CONFIDENCE } from '../constants'
import { computeSubjectAchievements } from '../utils/subjectAchievements'

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback }
  catch { return fallback }
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((new Date(dateStr + 'T12:00:00') - today) / 86400000)
}

export default function CadeiraPage({ subjectKey, settings, onBack, onNavigate }) {
  const subjects = settings?.subjects || []
  const subject = subjects.find(s => s.key === subjectKey)

  const [showAllSessions, setShowAllSessions] = useState(false)
  const [showAllDiary, setShowAllDiary] = useState(false)

  if (!subject) {
    return (
      <div style={{ padding: 32 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--gray-400)', fontWeight: 600, fontSize: 'var(--t-body)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={15} /> Voltar
        </button>
        <p style={{ marginTop: 16, color: 'var(--gray-400)' }}>Cadeira não encontrada.</p>
      </div>
    )
  }

  const allSessions   = load('study-sessions', [])
  const sessions      = allSessions.filter(s => s.subject === subjectKey).sort((a, b) => new Date(b.date) - new Date(a.date))
  const allExams      = load('exams', [])
  const subjectExams  = allExams
    .filter(e => e.subject && (e.subject.toLowerCase() === subject.name?.toLowerCase() || e.subject === subjectKey))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  const topics        = load('topics', {})
  const subjectTopics = topics[subjectKey] || topics[subject.name] || []
  const allDiary      = load('diary-entries', [])
  const diaryEntries  = allDiary.filter(e => e.subject === subjectKey).sort((a, b) => b.id - a.id)
  const targets       = load('subject-targets', {})

  const today   = new Date(); today.setHours(0, 0, 0, 0)
  const monday  = getMondayOfWeek(today)

  const totalHours = sessions.reduce((a, b) => a + (b.hours || 0), 0)
  const weekHours  = sessions.filter(s => new Date(s.date) >= monday).reduce((a, b) => a + (b.hours || 0), 0)

  const targetH = (() => {
    const val = targets[subjectKey]
    const num = parseFloat(val)
    if (val !== undefined && val !== '' && !isNaN(num) && num > 0) return num
    return settings?.hoursGoal / Math.max(1, subjects.length) || 110
  })()
  const pct = Math.min(100, Math.round(totalHours / targetH * 100))

  const achievements = computeSubjectAchievements(allSessions, allExams, topics, allDiary, subjectKey, subject.name)

  const displayedSessions = showAllSessions ? sessions : sessions.slice(0, 5)
  const displayedDiary    = showAllDiary    ? diaryEntries : diaryEntries.slice(0, 3)

  const color       = subject.color || '#e5e7eb'
  const colorFaint  = color + '20'
  const colorBorder = color + '55'

  const upcomingExams = subjectExams.filter(e => e.date && daysUntil(e.date) >= 0)
  const pastExams     = subjectExams.filter(e => !e.date || daysUntil(e.date) < 0)

  return (
    <div className="fade-in" style={{ maxWidth: 700 }}>

      {/* ── Back button ── */}
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20,
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 'var(--t-body)', fontWeight: 600,
        color: 'var(--gray-400)', padding: 0,
      }}>
        <ArrowLeft size={15} strokeWidth={2} /> Voltar
      </button>

      {/* ── Header ── */}
      <div style={{
        background: colorFaint, border: `2px solid ${colorBorder}`,
        borderRadius: 'var(--r)', padding: '22px 24px',
        display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16,
      }}>
        <span style={{ fontSize: '3rem', lineHeight: 1, flexShrink: 0 }}>{subject.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--gray-900)', margin: '0 0 6px', letterSpacing: -0.8 }}>
            {subject.name}
          </h1>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)' }}>
              ⏱️ {totalHours.toFixed(1)}h no total
            </span>
            <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)' }}>
              📋 {sessions.length} sessões
            </span>
            {achievements.length > 0 && (
              <span style={{ fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)' }}>
                🏅 {achievements.length} medalha{achievements.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              localStorage.setItem('pomodoro-prefill', JSON.stringify({ subjectKey: subject.key, title: subject.name }))
              onNavigate?.('hours')
            }}
            style={{
              padding: '8px 18px', borderRadius: 'var(--r)', border: 'none',
              background: color, color: subject.textColor || '#fff',
              fontFamily: 'inherit', fontWeight: 700, fontSize: 'var(--t-body)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            🍅 Estudar agora
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label"><Clock size={12} /> Esta semana</div>
          <div className="stat-value">
            {weekHours.toFixed(1)}<span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-400)' }}>h</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Target size={12} /> Meta semestral</div>
          <div className="stat-value">
            {pct}<span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-400)' }}>%</span>
          </div>
          <div className="stat-sub">{totalHours.toFixed(0)}h / {targetH}h</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><Trophy size={12} /> Medalhas</div>
          <div className="stat-value">{achievements.length}</div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ height: 8, borderRadius: 99, background: 'var(--gray-100)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
        </div>
        <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 500, marginTop: 5 }}>
          {pct}% da meta semestral · {targetH}h total
        </p>
      </div>

      {/* ── Exams ── */}
      {subjectExams.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 'var(--t-body)', fontWeight: 800, color: 'var(--gray-700)', marginBottom: 10, letterSpacing: -0.2 }}>
            🎯 Exames
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {upcomingExams.map(exam => {
              const days = daysUntil(exam.date)
              return (
                <div key={exam.id} style={{
                  padding: '11px 16px', borderRadius: 'var(--r)',
                  background: 'var(--white)', border: '1px solid var(--gray-100)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 'var(--t-body)', color: 'var(--gray-800)', margin: 0 }}>
                      {exam.type || 'Exame'}
                    </p>
                    <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', margin: 0, fontWeight: 500 }}>
                      {new Date(exam.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {exam.minGrade ? ` · Mínimo: ${exam.minGrade}/20` : ''}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 'var(--t-caption)', fontWeight: 700, flexShrink: 0,
                    padding: '3px 10px', borderRadius: 99,
                    background: days <= 7 ? 'var(--red-100)' : days <= 21 ? 'var(--amber-100)' : 'var(--green-50)',
                    color: days <= 7 ? '#b91c1c' : days <= 21 ? '#b45309' : '#15803d',
                  }}>
                    {days === 0 ? 'Hoje!' : days === 1 ? 'Amanhã' : `${days}d`}
                  </span>
                </div>
              )
            })}
            {pastExams.map(exam => (
              <div key={exam.id} style={{
                padding: '11px 16px', borderRadius: 'var(--r)',
                background: 'var(--gray-50)', border: '1px solid var(--gray-100)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                opacity: 0.7,
              }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 'var(--t-body)', color: 'var(--gray-700)', margin: 0 }}>
                    {exam.type || 'Exame'}
                  </p>
                  <p style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', margin: 0, fontWeight: 500 }}>
                    {exam.date ? new Date(exam.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                  </p>
                </div>
                {exam.actualGrade != null ? (
                  <span style={{
                    fontWeight: 800, fontSize: 'var(--t-body)', flexShrink: 0,
                    color: exam.actualGrade >= 10 ? 'var(--green-500)' : 'var(--red-400)',
                  }}>
                    {exam.actualGrade}/20
                  </span>
                ) : (
                  <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 500 }}>Passou</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Topics ── */}
      {subjectTopics.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 'var(--t-body)', fontWeight: 800, color: 'var(--gray-700)', marginBottom: 10, letterSpacing: -0.2 }}>
            <BookOpen size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            Tópicos
          </h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {CONFIDENCE.map(c => {
              const count = subjectTopics.filter(t => (t.confidence || 'unknown') === c.id).length
              if (count === 0) return null
              return (
                <span key={c.id} style={{
                  fontSize: 'var(--t-caption)', fontWeight: 700,
                  padding: '3px 10px', borderRadius: 99,
                  background: c.bg, color: c.color,
                }}>
                  {c.label}: {count}
                </span>
              )
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {subjectTopics.map(topic => {
              const conf = CONFIDENCE.find(c => c.id === (topic.confidence || 'unknown')) || CONFIDENCE[0]
              return (
                <div key={topic.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 14px', borderRadius: 8,
                  background: 'var(--white)', border: '1px solid var(--gray-100)',
                }}>
                  <p style={{ margin: 0, fontSize: 'var(--t-body)', fontWeight: 500, color: 'var(--gray-700)' }}>
                    {topic.name}
                  </p>
                  <span style={{
                    fontSize: 'var(--t-caption)', fontWeight: 700, flexShrink: 0,
                    padding: '2px 9px', borderRadius: 99,
                    background: conf.bg, color: conf.color,
                  }}>
                    {conf.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Sessions ── */}
      {sessions.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 'var(--t-body)', fontWeight: 800, color: 'var(--gray-700)', marginBottom: 10, letterSpacing: -0.2 }}>
            ⏱️ Sessões
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {displayedSessions.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 14px', borderRadius: 8,
                background: 'var(--white)', border: '1px solid var(--gray-100)',
              }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--gray-800)' }}>
                    {s.mood || '📖'} {s.hours}h
                    {s.notes && <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}> · {s.notes}</span>}
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 500 }}>{s.date}</p>
                </div>
              </div>
            ))}
          </div>
          {sessions.length > 5 && (
            <button onClick={() => setShowAllSessions(v => !v)} style={{
              marginTop: 8, display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)',
              fontFamily: 'inherit', padding: 0,
            }}>
              {showAllSessions ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showAllSessions ? 'Mostrar menos' : `Ver todas as ${sessions.length} sessões`}
            </button>
          )}
        </div>
      ) : (
        <div style={{
          padding: '28px', textAlign: 'center', borderRadius: 'var(--r)',
          background: 'var(--gray-50)', border: '1.5px dashed var(--gray-200)', marginBottom: 24,
        }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }}>{subject.emoji}</span>
          <p style={{ color: 'var(--gray-500)', fontSize: 'var(--t-body)', fontWeight: 600, marginBottom: 6 }}>
            Ainda não há sessões para {subject.name}
          </p>
          <p style={{ color: 'var(--gray-400)', fontSize: 'var(--t-body)', margin: 0 }}>
            Usa o botão &ldquo;+ Registar horas&rdquo; para começar.
          </p>
        </div>
      )}

      {/* ── Diary ── */}
      {diaryEntries.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 'var(--t-body)', fontWeight: 800, color: 'var(--gray-700)', marginBottom: 10, letterSpacing: -0.2 }}>
            <NotebookPen size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            Diário
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displayedDiary.map(entry => (
              <div key={entry.id} style={{
                padding: '12px 14px', borderRadius: 8,
                background: 'var(--white)', border: '1px solid var(--gray-100)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 500 }}>
                    {new Date(entry.id).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {entry.mood && <span style={{ fontSize: '1rem' }}>{entry.mood}</span>}
                </div>
                <p style={{ margin: 0, fontSize: 'var(--t-body)', color: 'var(--gray-700)', lineHeight: 1.55 }}>
                  {entry.text}
                </p>
                {entry.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                    {entry.tags.map(tag => (
                      <span key={tag} style={{
                        fontSize: 'var(--t-caption)', fontWeight: 600,
                        padding: '2px 8px', borderRadius: 99,
                        background: 'var(--gray-100)', color: 'var(--gray-500)',
                      }}>#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {diaryEntries.length > 3 && (
            <button onClick={() => setShowAllDiary(v => !v)} style={{
              marginTop: 8, display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 'var(--t-caption)', fontWeight: 700, color: 'var(--gray-400)',
              fontFamily: 'inherit', padding: 0,
            }}>
              {showAllDiary ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showAllDiary ? 'Mostrar menos' : `Ver todas as ${diaryEntries.length} entradas`}
            </button>
          )}
        </div>
      )}

      {/* ── Achievements ── */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--t-body)', fontWeight: 800, color: 'var(--gray-700)', marginBottom: 10, letterSpacing: -0.2 }}>
          🏅 Medalhas
        </h2>
        {achievements.length === 0 ? (
          <div style={{
            padding: '20px', borderRadius: 'var(--r)', textAlign: 'center',
            background: 'var(--gray-50)', border: '1.5px dashed var(--gray-200)',
          }}>
            <p style={{ color: 'var(--gray-400)', fontSize: 'var(--t-body)', fontWeight: 500, margin: 0 }}>
              As medalhas aparecem aqui à medida que estudas.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {achievements.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 8,
                background: 'var(--white)', border: '1px solid var(--gray-100)',
              }}>
                <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{a.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--gray-800)' }}>{a.desc}</p>
                  <p style={{ margin: 0, fontSize: 'var(--t-caption)', color: 'var(--gray-400)', fontWeight: 500 }}>{a.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
