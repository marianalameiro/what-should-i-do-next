import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Zap, Plus, X, Check, Settings2, Pencil, Trash2 } from 'lucide-react'
import { getTasksForDay } from '/Users/mariana/Desktop/what-should-i-do-next/src/data/schedule'

// ─── Constants ────────────────────────────────────────────────────────────────
const HOUR_H       = 64
const MIN_BLOCK    = 15
const DAY_FULL     = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
const DAY_SHORT    = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MONTHS       = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const FREQUENCIES  = [
  { id:'daily',    label:'Diariamente' },
  { id:'weekly',   label:'Semanalmente' },
  { id:'biweekly', label:'De 2 em 2 semanas' },
  { id:'monthly',  label:'Mensalmente' },
]
const BLOCK_TYPES_LIST = [
  { id:'study',     label:'Estudo',    emoji:'📚' },
  { id:'break',     label:'Pausa',     emoji:'☕' },
  { id:'household', label:'Doméstica', emoji:'🏠' },
  { id:'event',     label:'Evento',    emoji:'📅' },
  { id:'manual',    label:'Outro',     emoji:'📌' },
]
const STYLES = {
  class:     { color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc' },
  study:     { color:'#db2777', bg:'#fdf2f7', border:'#f9a8d4' },
  break:     { color:'#16a34a', bg:'#f0fdf4', border:'#86efac' },
  household: { color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
  event:     { color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe' },
  exam:      { color:'#dc2626', bg:'#fef2f2', border:'#fca5a5' },
  manual:    { color:'#71717a', bg:'#fafafa', border:'#d4d4d8' },
}
const DEFAULT_HOUSEHOLD = [
  { id:'h1', name:'Compras da semana',    emoji:'🛒', duration:60, frequency:'weekly',   color:'#d97706', preferredDay:6 },
  { id:'h2', name:'Limpar quarto',        emoji:'🧹', duration:45, frequency:'weekly',   color:'#7c3aed', preferredDay:6 },
  { id:'h3', name:'Lavar roupa',          emoji:'🫧', duration:30, frequency:'biweekly', color:'#0891b2', preferredDay:3 },
  { id:'h4', name:'Secar/dobrar roupa',   emoji:'👕', duration:20, frequency:'biweekly', color:'#0891b2', preferredDay:4 },
  { id:'h5', name:'Limpar casa de banho', emoji:'🚿', duration:30, frequency:'weekly',   color:'#16a34a', preferredDay:6 },
]
const TASK_RULES = [
  { match:['sheet-weekend','ficha'],         quadrant:'Q1' },
  { match:['transcribe','cornell'],          quadrant:'Q2' },
  { match:['flashcards','biblio','modelo'],  quadrant:'Q2' },
  { match:['review'],                        quadrant:'Q3' },
  { match:['extra'],                         quadrant:'Q4' },
]

// ─── Time utils ───────────────────────────────────────────────────────────────
const toDateStr   = d => d.toISOString().split('T')[0]
const toMins      = t => { const [h,m] = t.split(':').map(Number); return h*60+m }
const toTime      = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
const toPx        = m => (m/60)*HOUR_H
const fmtTime     = t => { const [h,m] = t.split(':'); return `${h}h${m!=='00'?m:''}` }
const fmtDur      = m => { if(m<60) return `${m}min`; const h=Math.floor(m/60),r=m%60; return r?`${h}h${r}`:`${h}h` }

// ─── Storage ──────────────────────────────────────────────────────────────────
const ls = {
  get:   (k, fb=[]) => { try { return JSON.parse(localStorage.getItem(k))??fb } catch { return fb } },
  set:   (k, v)     => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
  getSet:(k, fb)    => { try { return new Set(JSON.parse(localStorage.getItem(k))??[]) } catch { return new Set() } },
  setSet:(k, s)     => { try { localStorage.setItem(k, JSON.stringify([...s])) } catch {} },
}
const loadHousehold    = ()      => { const s=ls.get('household-tasks',null); return (s&&s.length)?s:DEFAULT_HOUSEHOLD }
const saveHousehold    = h       => ls.set('household-tasks', h)
const loadBlocks       = ds     => ls.get(`schedule-blocks-${ds}`, [])
const saveBlocks       = (ds,b) => ls.set(`schedule-blocks-${ds}`, b)
const loadDoneBlocks   = ds     => ls.getSet(`schedule-done-${ds}`)
const saveDoneBlocks   = (ds,s) => ls.setSet(`schedule-done-${ds}`, s)
const loadSnoozed      = ds     => ls.get(`schedule-snoozed-${ds}`, [])
const saveSnoozed      = (ds,a) => ls.set(`schedule-snoozed-${ds}`, a)
const loadGCal         = ()      => ls.get('gcal-events', [])
const loadManual       = ()      => ls.get('calendar-events', [])
const loadExams        = ()      => ls.get('exams', [])
const loadMatrixOvr    = ()      => ls.get('eisenhower-overrides', {})
const loadDone         = ds     => {
  try { const d=new Date(ds+'T12:00:00'); return ls.get(`tasks-${d.toDateString()}`,{}) } catch { return {} }
}
const loadExtra        = ()      => ls.get('extra-tasks', [])
const loadDailyTargets = ()      => ls.get('daily-study-targets', {})
const saveDailyTargets = t       => ls.set('daily-study-targets', t)

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _uid = Date.now()
const uid = () => String(++_uid)

function getMondayOf(date) {
  const d=new Date(date), day=d.getDay(), diff=day===0?-6:1-day
  d.setDate(d.getDate()+diff); d.setHours(0,0,0,0); return d
}
function autoClassify(id='', label='') {
  const s=(id+' '+label).toLowerCase()
  for (const r of TASK_RULES) if (r.match.some(k=>s.includes(k))) return r.quadrant
  return 'Q2'
}
function detectConflicts(blocks) {
  const ids=new Set()
  const sorted=[...blocks].filter(b=>b.startMins!=null).sort((a,b)=>a.startMins-b.startMins)
  for (let i=1;i<sorted.length;i++)
    if (sorted[i].startMins<sorted[i-1].endMins) { ids.add(sorted[i].id); ids.add(sorted[i-1].id) }
  return ids
}
function getScheduledElsewhere(dateStr) {
  const set=new Set(), base=new Date(dateStr+'T12:00:00')
  for (let d=-7;d<=7;d++) {
    if (d===0) continue
    const dt=new Date(base); dt.setDate(base.getDate()+d)
    loadBlocks(toDateStr(dt)).forEach(b=>{ if(b.title) set.add(b.title) })
  }
  loadSnoozed(dateStr).forEach(t=>set.delete(t))
  return set
}

// ─── Block builders ───────────────────────────────────────────────────────────
function getClassBlocks(dateStr, settings) {
  const blocks=[], dow=new Date(dateStr+'T12:00:00').getDay()
  ;(settings?.classTimes||[]).filter(ct=>ct.dayOfWeek===dow&&ct.startTime&&ct.endTime).forEach(ct=>{
    const subj=settings.subjects?.find(s=>s.key===ct.subjectKey)
    blocks.push({ id:`class-${ct.id}-${dateStr}`, type:'class',
      startTime:ct.startTime, endTime:ct.endTime,
      startMins:toMins(ct.startTime), endMins:toMins(ct.endTime),
      title:subj?.name||ct.label||'Aula', subtitle:ct.room||'',
      emoji:subj?.emoji||'📖', ...STYLES.class, subjectKey:ct.subjectKey, locked:true })
  })
  return blocks
}
function getTimedGCal(dateStr, settings) {
  const subjects=settings?.subjects||[]
  return loadGCal().filter(e=>e.date===dateStr&&e.startTime&&e.endTime).map(e=>{
    const sm=toMins(e.startTime), em=toMins(e.endTime)
    if (isNaN(sm)||isNaN(em)||em<=sm) return null
    const tl=e.title.toLowerCase()
    const subj=subjects.find(s=>tl.includes(s.name.toLowerCase())||(s.key&&tl.includes(s.key.replace(/_\d+$/,'').replace(/_/g,' '))))
    return { id:`gcal-${e.id||e.title}-${dateStr}`, type:'class',
      startTime:e.startTime, endTime:e.endTime, startMins:sm, endMins:em,
      title:e.title, subtitle:e.subtitle||'', emoji:subj?.emoji||'📖',
      ...STYLES.class, locked:true }
  }).filter(Boolean)
}
function getAllDayEvents(dateStr) {
  const out=[]
  loadGCal().filter(e=>e.date===dateStr).forEach(e=>out.push({id:`gcal-${e.id}`,title:e.title,type:'event',source:'gcal'}))
  loadManual().forEach(e=>{
    if (!e.date) return
    let match=e.date===dateStr
    if (!match&&e.recurrence&&e.recurrence!=='Nunca') {
      const diff=Math.round((new Date(dateStr+'T12:00:00')-new Date(e.date+'T12:00:00'))/86400000)
      const iv=e.recurrence==='Semanalmente'?7:e.recurrence==='Quinzenalmente'?14:30
      match=diff>0&&diff%iv===0
    }
    if (match) out.push({id:`manual-${e.id}`,title:e.title,type:e.type||'event',source:'manual'})
  })
  loadExams().filter(e=>e.date===dateStr).forEach(e=>out.push({id:`exam-${e.id}`,title:`${e.type}: ${e.subject}`,type:'exam',source:'exam'}))
  return out
}

// ─── Auto-schedule ────────────────────────────────────────────────────────────
function autoScheduleDay(dateStr, settings, household) {
  const wakeMin=toMins(settings?.wakeTime||'08:00'), sleepMin=toMins(settings?.sleepTime||'23:00')
  const total=sleepMin-wakeMin, dow=new Date(dateStr+'T12:00:00').getDay()
  const z1=wakeMin+total*0.35, z2=wakeMin+total*0.60, z3=wakeMin+total*0.80
  const PRI={high:['Q1','Q2','Q3','Q4'],medium:['Q2','Q1','Q3','Q4'],low:['Q3','Q2','Q4','Q1'],very_low:['Q4','Q3','Q2','Q1']}
  const energy=m=>m<z1?'high':m<z2?'medium':m<z3?'low':'very_low'
  const classBlocks=getClassBlocks(dateStr,settings)
  const occ=classBlocks.map(b=>({start:b.startMins,end:b.endMins})).sort((a,b)=>a.start-b.start)
  const free=[], cur={v:wakeMin}
  for (const o of occ) { if(cur.v<o.start-MIN_BLOCK) free.push({start:cur.v,end:o.start}); cur.v=Math.max(cur.v,o.end) }
  if (cur.v<sleepMin-MIN_BLOCK) free.push({start:cur.v,end:sleepMin})
  const matOvr=loadMatrixOvr(), done=loadDone(dateStr), elsewhere=getScheduledElsewhere(dateStr)
  const byQ={Q1:[],Q2:[],Q3:[],Q4:[]}
  getTasksForDay(dow,settings).forEach(group=>{
    const subj=settings?.subjects?.find(s=>s.key===group.subjectKey)
    group.tasks.filter(t=>!done[t.id]&&!elsewhere.has(t.label)).forEach(task=>{
      const q=matOvr[task.id]||autoClassify(task.id,task.label)
      byQ[q].push({label:task.label,emoji:subj?.emoji||'📚',color:subj?.color||STYLES.study.color,
        bg:STYLES.study.bg,border:subj?.color?`${subj.color}66`:STYLES.study.border,type:'study',duration:30})
    })
  })
  loadExtra().filter(t=>!done[t.id]&&!elsewhere.has(t.label)).forEach(t=>{
    const q=matOvr[t.id]||autoClassify(t.id,t.label)
    const qe=q==='Q1'?'🔴':q==='Q2'?'🟡':q==='Q3'?'🟠':'⚪'
    byQ[q].push({label:t.label,emoji:qe,color:'#71717a',bg:'#fafafa',border:'#d4d4d8',type:'manual',duration:30})
  })
  const pick=e=>{ for(const q of PRI[e]) if(byQ[q].length) return byQ[q].shift(); return null }
  const houseDue=household.filter(h=>{
    if(h.preferredDay!==undefined&&h.preferredDay!==dow) return false
    if(!h.lastDone) return true
    const ds=Math.round((new Date(dateStr+'T12:00:00')-new Date(h.lastDone+'T12:00:00'))/86400000)
    const iv=h.frequency==='daily'?1:h.frequency==='weekly'?7:h.frequency==='biweekly'?14:30
    return ds>=iv
  })
  const newBlocks=[], cont={v:0}
  for (const slot of free) {
    let c=slot.start
    while(c<slot.end) {
      const gap=slot.end-c
      if(cont.v>=90&&gap>=10) {
        const dur=Math.min(15,gap)
        newBlocks.push({id:`break-${c}`,type:'break',startMins:c,endMins:c+dur,startTime:toTime(c),endTime:toTime(c+dur),title:'Pausa',emoji:'☕',...STYLES.break,locked:false})
        c+=dur; cont.v=0; continue
      }
      if(gap>=20) {
        const task=pick(energy(c))
        if(task) {
          const dur=Math.min(task.duration,gap)
          newBlocks.push({id:`task-${c}`,type:task.type,startMins:c,endMins:c+dur,startTime:toTime(c),endTime:toTime(c+dur),title:task.label,emoji:task.emoji,color:task.color,bg:task.bg,border:task.border,locked:false})
          c+=dur; cont.v+=dur; continue
        }
      }
      if(houseDue.length&&gap>=20) {
        const h=houseDue.shift(), dur=Math.min(h.duration,gap-5)
        if(dur>=15) {
          newBlocks.push({id:`household-${h.id}-${c}`,type:'household',startMins:c,endMins:c+dur,startTime:toTime(c),endTime:toTime(c+dur),title:h.name,emoji:h.emoji,householdId:h.id,color:h.color||STYLES.household.color,bg:STYLES.household.bg,border:STYLES.household.border,locked:false})
          c+=dur+10; continue
        }
      }
      break
    }
  }
  return newBlocks
}

// ─── AI scheduling ────────────────────────────────────────────────────────────
async function callGroq(apiKey, system, user) {
  const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),30000)
  try {
    const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST', signal:ctrl.signal,
      headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',max_tokens:2048,messages:[{role:'system',content:system},{role:'user',content:user}]})
    })
    if(!res.ok) throw new Error(`API ${res.status}`)
    const d=await res.json(); return d.choices?.[0]?.message?.content||''
  } catch(e) {
    if(e.name==='AbortError') throw new Error('Pedido à IA expirou (30s)')
    throw e
  } finally { clearTimeout(timer) }
}

async function aiSchedule(dateStr, settings, household, apiKey) {
  const wakeMin=toMins(settings?.wakeTime||'08:00'), sleepMin=toMins(settings?.sleepTime||'23:00')
  const dow=new Date(dateStr+'T12:00:00').getDay()
  const classBlocks=getClassBlocks(dateStr,settings), gcal=getTimedGCal(dateStr,settings)
  const allFixed=[...classBlocks,...gcal].sort((a,b)=>a.startMins-b.startMins)
  const occ=allFixed.map(b=>({start:b.startMins,end:b.endMins}))
  const free=[], cur={v:wakeMin}
  for(const o of occ){if(cur.v<o.start-MIN_BLOCK)free.push({start:cur.v,end:o.start});cur.v=Math.max(cur.v,o.end)}
  if(cur.v<sleepMin-MIN_BLOCK)free.push({start:cur.v,end:sleepMin})
  const totalFree=free.reduce((s,sl)=>s+sl.end-sl.start,0)
  const matOvr=loadMatrixOvr(),done=loadDone(dateStr),elsewhere=getScheduledElsewhere(dateStr),tasks=[]
  getTasksForDay(dow,settings).forEach(g=>{
    const subj=settings?.subjects?.find(s=>s.key===g.subjectKey)
    g.tasks.filter(t=>!done[t.id]&&!elsewhere.has(t.label)).forEach(task=>{
      const q=matOvr[task.id]||autoClassify(task.id,task.label)
      tasks.push({id:task.id,label:task.label,quadrant:q,subject:subj?.name||'',emoji:subj?.emoji||'📚',color:subj?.color||STYLES.study.color,bg:STYLES.study.bg,border:subj?.color?`${subj.color}66`:STYLES.study.border})
    })
  })
  loadExtra().filter(t=>!done[t.id]&&!elsewhere.has(t.label)).forEach(t=>{
    const q=matOvr[t.id]||autoClassify(t.id,t.label)
    tasks.push({id:t.id,label:t.label,quadrant:q,subject:'',emoji:q==='Q1'?'🔴':q==='Q2'?'🟡':q==='Q3'?'🟠':'⚪',color:'#71717a',bg:'#fafafa',border:'#d4d4d8'})
  })
  const houseDue=household.filter(h=>{
    if(h.preferredDay!==undefined&&h.preferredDay!==dow)return false
    if(!h.lastDone)return true
    const ds=Math.round((new Date(dateStr+'T12:00:00')-new Date(h.lastDone+'T12:00:00'))/86400000)
    const iv=h.frequency==='daily'?1:h.frequency==='weekly'?7:h.frequency==='biweekly'?14:30
    return ds>=iv
  })
  const fixedDesc=allFixed.length?allFixed.map(b=>`${b.startTime}–${b.endTime}: ${b.title} (FIXO)`).join('\n'):'Nenhuma.'
  const freeDesc=free.map(s=>`${toTime(s.start)}–${toTime(s.end)} (${s.end-s.start} min)`).join(', ')
  const taskDesc=tasks.length?tasks.map(t=>`- [${t.quadrant}] "${t.label}"${t.subject?` (${t.subject})`:''}`).join('\n'):'Sem tarefas.'
  const houseDesc=houseDue.length?houseDue.map(h=>`- "${h.name}" (${h.duration} min)`).join('\n'):'Nenhuma.'
  const sys=`És um assistente de agendamento estudantil. Crias horários realistas.\nRegras:\n- Pausa 10–15 min após 45–50 min contínuos\n- Manhã = alta energia → Q1/Q2\n- Tarde = média → Q2\n- Fim do dia = baixa → Q3/Q4\n- Duração realista\n- Nunca sobrepores blocos fixos\n- Deixa espaço livre\nResponde APENAS com JSON array, sem markdown.`
  const msg=`Data: ${dateStr} (acordar ${toTime(wakeMin)}, dormir ${toTime(sleepMin)})\nLivre total: ${totalFree} min\n\nFixos:\n${fixedDesc}\n\nSlots livres:\n${freeDesc}\n\nTarefas:\n${taskDesc}\n\nDomésticas:\n${houseDesc}\n\nJSON: {"title":"...","emoji":"...","type":"study|break|manual|household","startTime":"HH:MM","endTime":"HH:MM","color":"#...","bg":"#...","border":"#..."}`
  const raw=await callGroq(apiKey,sys,msg)
  const m=raw.match(/\[[\s\S]*\]/)
  if(!m) throw new Error('Resposta inválida da IA')
  const parsed=JSON.parse(m[0])
  const HH=/^\d{2}:\d{2}$/
  return parsed.map((b,i)=>{
    if(!b.startTime||!b.endTime||!HH.test(b.startTime)||!HH.test(b.endTime))return null
    const sm=toMins(b.startTime),em=toMins(b.endTime)
    if(isNaN(sm)||isNaN(em)||em<=sm)return null
    const task=tasks.find(t=>t.label===b.title||b.title.includes(t.label.slice(0,15)))
    return {id:`ai-${i}-${sm}`,type:b.type||'manual',startMins:sm,endMins:em,startTime:b.startTime,endTime:b.endTime,title:b.title,emoji:b.emoji||task?.emoji||'📚',color:b.color||task?.color||STYLES.study.color,bg:b.bg||task?.bg||STYLES.study.bg,border:b.border||task?.border||STYLES.study.border,locked:false}
  }).filter(Boolean)
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════════
const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,700;0,9..144,900;1,9..144,300&display=swap');

.sched-root {
  font-family: 'DM Mono', monospace;
  --ink: #1a1a1a;
  --ink2: #555;
  --ink3: #999;
  --line: #e8e8e8;
  --surface: #ffffff;
  --hover: #f7f7f7;
  --radius: 10px;
}
.sched-root * { box-sizing: border-box; margin: 0; padding: 0; }
.sched-btn {
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s;
  letter-spacing: 0.02em;
}
.sched-btn:hover { filter: brightness(0.94); transform: translateY(-1px); }
.sched-btn:active { transform: translateY(0); }
.sched-icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #aaa;
  transition: background 0.15s, color 0.15s;
}
.sched-icon-btn:hover { background: #f0f0f0; color: #333; }
.sched-card {
  background: white;
  border: 1px solid #ececec;
  border-radius: 14px;
  padding: 16px;
}
.sched-input {
  border: 1.5px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 0.8rem;
  font-family: 'DM Mono', monospace;
  color: #1a1a1a;
  background: white;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
}
.sched-input:focus { border-color: #1a1a1a; }
.sched-label {
  font-size: 0.68rem;
  font-weight: 500;
  color: #999;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
@keyframes fadeUp {
  from { opacity:0; transform:translateY(6px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes spin { to { transform:rotate(360deg); } }
.sched-block { animation: fadeUp 0.25s ease both; }
`

function Styles() {
  return <style>{css}</style>
}

// ─── Pill button ──────────────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, bg='#f2f2f2', color='#333', solid=false, style={}, title, className='' }) {
  return (
    <button
      className={`sched-btn ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: solid ? color : bg,
        color: solid ? 'white' : color,
        border: `1.5px solid ${solid ? color : color+'33'}`,
        padding: '7px 12px',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ children, onClose, title, wide=false }) {
  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:300,
               display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
      onClick={onClose}
    >
      <div
        style={{ background:'white', borderRadius:18, padding:28,
                 width:wide?580:420, maxWidth:'100%', maxHeight:'88vh', overflowY:'auto',
                 boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}
        onClick={e=>e.stopPropagation()}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:'1.1rem', fontWeight:700, color:'#1a1a1a' }}>{title}</span>
          <button className="sched-icon-btn" onClick={onClose} style={{ color:'#666' }}><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── ClassTimeForm ────────────────────────────────────────────────────────────
function ClassTimeForm({ initial, subjects, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  return (
    <div style={{ background:'#f8f8f8', borderRadius:12, padding:18, marginTop:16 }}>
      <p style={{ fontFamily:"'Fraunces',serif", fontSize:'0.9rem', fontWeight:700, color:'#1a1a1a', marginBottom:14 }}>
        {initial.id?'Editar aula':'Nova aula'}
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {[
          ['Cadeira', <select className="sched-input" value={form.subjectKey} onChange={e=>set('subjectKey',e.target.value)}>
            <option value="">— Selecionar —</option>
            {subjects.map(s=><option key={s.key} value={s.key}>{s.emoji} {s.name}</option>)}
          </select>],
          ['Nome alternativo', <input className="sched-input" value={form.label||''} onChange={e=>set('label',e.target.value)} placeholder="Ex: Inglês"/>],
          ['Dia', <select className="sched-input" value={form.dayOfWeek} onChange={e=>set('dayOfWeek',Number(e.target.value))}>
            {DAY_FULL.map((d,i)=><option key={i} value={i}>{d}</option>)}
          </select>],
          ['Sala', <input className="sched-input" value={form.room||''} onChange={e=>set('room',e.target.value)} placeholder="B2.01"/>],
          ['Início', <input type="time" className="sched-input" value={form.startTime} onChange={e=>set('startTime',e.target.value)}/>],
          ['Fim',    <input type="time" className="sched-input" value={form.endTime}   onChange={e=>set('endTime',e.target.value)}/>],
        ].map(([label, el]) => (
          <label key={label} className="sched-label">{label}{el}</label>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:16 }}>
        <Btn onClick={()=>onSave(form)} solid color="#0891b2" bg="#ecfeff">Guardar</Btn>
        <Btn onClick={onCancel} bg="#f2f2f2" color="#666">Cancelar</Btn>
      </div>
    </div>
  )
}

// ─── HouseholdForm ────────────────────────────────────────────────────────────
function HouseholdForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  return (
    <div style={{ background:'#fffbeb', borderRadius:12, padding:18, marginTop:16 }}>
      <p style={{ fontFamily:"'Fraunces',serif", fontSize:'0.9rem', fontWeight:700, color:'#d97706', marginBottom:14 }}>
        {initial.id?'Editar tarefa':'Nova tarefa'}
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {[
          ['Nome',      <input className="sched-input" value={form.name}  onChange={e=>set('name',e.target.value)}  placeholder="Limpar quarto"/>],
          ['Emoji',     <input className="sched-input" value={form.emoji} onChange={e=>set('emoji',e.target.value)} placeholder="🧹"/>],
          ['Duração (min)', <input type="number" className="sched-input" min="5" max="240" value={form.duration} onChange={e=>set('duration',Number(e.target.value))}/>],
          ['Frequência', <select className="sched-input" value={form.frequency} onChange={e=>set('frequency',e.target.value)}>
            {FREQUENCIES.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}
          </select>],
          ['Dia preferido', <select className="sched-input" value={form.preferredDay??''} onChange={e=>set('preferredDay',e.target.value===''?undefined:Number(e.target.value))}>
            <option value="">Qualquer dia</option>
            {DAY_FULL.map((d,i)=><option key={i} value={i}>{d}</option>)}
          </select>],
        ].map(([label, el]) => (
          <label key={label} className="sched-label">{label}{el}</label>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:16 }}>
        <Btn onClick={()=>onSave(form)} solid color="#d97706" bg="#fffbeb">Guardar</Btn>
        <Btn onClick={onCancel} bg="#f2f2f2" color="#666">Cancelar</Btn>
      </div>
    </div>
  )
}

// ─── BlockForm ────────────────────────────────────────────────────────────────
function BlockForm({ initial, subjects, household, onSave, onCancel }) {
  const [form, setForm] = useState({...initial})
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  return (
    <Modal onClose={onCancel} title={initial.id?'Editar bloco':'Novo bloco'}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <label className="sched-label" style={{ gridColumn:'1/-1' }}>
          Tipo
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
            {BLOCK_TYPES_LIST.map(bt=>(
              <button
                key={bt.id}
                className="sched-btn"
                onClick={()=>set('type',bt.id)}
                style={{
                  background: form.type===bt.id ? (STYLES[bt.id]?.color||'#333') : (STYLES[bt.id]?.bg||'#fafafa'),
                  color: form.type===bt.id ? 'white' : (STYLES[bt.id]?.color||'#333'),
                  border: `1.5px solid ${(STYLES[bt.id]?.color||'#333')+'44'}`,
                  padding:'5px 10px',
                }}
              >{bt.emoji} {bt.label}</button>
            ))}
          </div>
        </label>
        <label className="sched-label">Início<input type="time" className="sched-input" value={form.startTime} onChange={e=>set('startTime',e.target.value)}/></label>
        <label className="sched-label">Fim<input type="time" className="sched-input" value={form.endTime} onChange={e=>set('endTime',e.target.value)}/></label>
        {form.type==='study'&&(
          <label className="sched-label" style={{gridColumn:'1/-1'}}>Cadeira
            <select className="sched-input" value={form.subjectKey||''} onChange={e=>set('subjectKey',e.target.value)}>
              <option value="">— Selecionar —</option>
              {subjects.map(s=><option key={s.key} value={s.key}>{s.emoji} {s.name}</option>)}
            </select>
          </label>
        )}
        {form.type==='household'&&(
          <label className="sched-label" style={{gridColumn:'1/-1'}}>Tarefa
            <select className="sched-input" value={form.householdId||''} onChange={e=>{
              const h=household.find(h=>h.id===e.target.value)
              set('householdId',e.target.value)
              if(h){set('title',h.name);set('emoji',h.emoji)}
            }}>
              <option value="">— Selecionar —</option>
              {household.map(h=><option key={h.id} value={h.id}>{h.emoji} {h.name}</option>)}
            </select>
          </label>
        )}
        <label className="sched-label">Título<input className="sched-input" value={form.title||''} onChange={e=>set('title',e.target.value)} placeholder="Estudar capítulo 3"/></label>
        <label className="sched-label">Emoji<input className="sched-input" value={form.emoji||''} onChange={e=>set('emoji',e.target.value)} placeholder="📚"/></label>
      </div>
      <div style={{ display:'flex', gap:8, marginTop:18 }}>
        <Btn onClick={()=>onSave(form)} solid color="#1a1a1a" bg="#1a1a1a">Guardar</Btn>
        <Btn onClick={onCancel} bg="#f2f2f2" color="#666">Cancelar</Btn>
      </div>
    </Modal>
  )
}

// ─── FocusOverlay ─────────────────────────────────────────────────────────────
function FocusOverlay({ block, currentMins, onClose, onStartPomodoro }) {
  const noteKey=`block-notes-${block.id}`
  const [notes, setNotes] = useState(()=>{ try{return localStorage.getItem(noteKey)||''}catch{return''} })
  const dur=block.endMins-block.startMins
  const isPast=currentMins>block.endMins, isActive=currentMins>=block.startMins&&currentMins<=block.endMins
  const minsUntil=block.startMins-currentMins
  const label=isPast?'Concluído':isActive?'A decorrer':`Começa em ${fmtDur(minsUntil)}`
  const saveNotes=v=>{ setNotes(v); try{localStorage.setItem(noteKey,v)}catch{} }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={onClose}>
      <div style={{background:'white',borderRadius:20,padding:36,width:480,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 32px 80px rgba(0,0,0,0.25)',position:'relative'}} onClick={e=>e.stopPropagation()}>
        <button className="sched-icon-btn" onClick={onClose} style={{position:'absolute',top:16,right:16,background:'#f2f2f2',borderRadius:'50%',width:32,height:32}}>✕</button>
        <div style={{textAlign:'center',marginBottom:24}}>
          {block.emoji&&<div style={{fontSize:'3rem',marginBottom:10}}>{block.emoji}</div>}
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:'1.6rem',fontWeight:900,color:'#1a1a1a',letterSpacing:'-0.04em'}}>{block.title}</h2>
          <p style={{fontSize:'0.75rem',color:'#999',marginTop:6}}>{block.startTime} – {block.endTime} · {fmtDur(dur)}</p>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,background:isPast?'#f0fdf4':isActive?'#fdf2f7':'#fef3c7',color:isPast?'#16a34a':isActive?'#db2777':'#d97706',border:`1px solid ${isPast?'#86efac':isActive?'#f9a8d4':'#fde68a'}`,borderRadius:50,padding:'5px 14px',marginTop:12,fontSize:'0.75rem',fontWeight:500}}>
            {isPast?'✓':isActive?'▶':'⏰'} {label}
          </div>
        </div>
        <label className="sched-label" style={{marginBottom:6}}>Notas</label>
        <textarea value={notes} onChange={e=>saveNotes(e.target.value)} placeholder="Escreve notas sobre este bloco..." style={{width:'100%',border:'1.5px solid #e0e0e0',borderRadius:10,padding:'10px 12px',fontSize:'0.82rem',fontFamily:"'DM Mono',monospace",color:'#1a1a1a',background:'white',resize:'vertical',minHeight:100,outline:'none'}}/>
        <div style={{display:'flex',gap:8,marginTop:18,justifyContent:'center'}}>
          <Btn onClick={onStartPomodoro} solid color="#db2777" bg="#fdf2f7">🍅 Iniciar Pomodoro</Btn>
          <Btn onClick={onClose} bg="#f2f2f2" color="#666">Fechar</Btn>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function SchedulePage({ settings, setSettings, onNavigate, onStartPomodoro }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const [selDate, setSelDate]             = useState(today)
  const dateStr                           = toDateStr(selDate)
  const [blocks, setBlocksRaw]            = useState([])
  const [household, setHouseholdRaw]      = useState(loadHousehold)
  const [dailyTargets, setDailyTargets]   = useState(loadDailyTargets)
  const [doneBlocks, setDoneBlocksRaw]    = useState(()=>loadDoneBlocks(dateStr))
  const [currentMins, setCurrentMins]     = useState(()=>{ const n=new Date(); return n.getHours()*60+n.getMinutes() })
  const [weekView, setWeekView]           = useState(false)
  const [aiLoading, setAiLoading]         = useState(false)
  const [aiError, setAiError]             = useState(null)
  const [summary, setSummary]             = useState(()=>{ try{return localStorage.getItem(`schedule-summary-${toDateStr(today)}`)||''}catch{return''} })
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [focusBlock, setFocusBlock]       = useState(null)
  const [draggingId, setDraggingId]       = useState(null)
  const [dragBlocks, setDragBlocks]       = useState(null)
  const [resizingId, setResizingId]       = useState(null)
  const [prefilledTime, setPrefilledTime] = useState(null)
  const [showClassEditor, setShowClassEditor] = useState(false)
  const [showHouseModal, setShowHouseModal]   = useState(false)
  const [showBlockModal, setShowBlockModal]   = useState(false)
  const [editingBlock, setEditingBlock]       = useState(null)
  const [editingClass, setEditingClass]       = useState(null)
  const [editingHouse, setEditingHouse]       = useState(null)
  const [canUndo, setCanUndo]             = useState(false)
  const [canRedo, setCanRedo]             = useState(false)
  const history    = useRef([])
  const redoStack  = useRef([])
  const dragState  = useRef(null)
  const resizeState= useRef(null)
  const notified   = useRef(new Set())

  const wakeMin  = toMins(settings?.wakeTime  || '08:00')
  const sleepMin = toMins(settings?.sleepTime || '23:00')

  // Persist helpers
  const setBlocks = useCallback(b => {
    setBlocksRaw(prev => {
      const next = typeof b === 'function' ? b(prev) : b
      history.current.push(prev)
      if (history.current.length > 20) history.current.shift()
      redoStack.current = []
      setCanUndo(true); setCanRedo(false)
      saveBlocks(dateStr, next)
      return next
    })
  }, [dateStr])

  const setHousehold = h => { setHouseholdRaw(h); saveHousehold(h) }

  // Load on date change
  useEffect(() => {
    setBlocksRaw(loadBlocks(dateStr))
    setDoneBlocksRaw(loadDoneBlocks(dateStr))
    setAiError(null); setDragBlocks(null); setDraggingId(null)
    history.current=[]; redoStack.current=[]; setCanUndo(false); setCanRedo(false)
    try { setSummary(localStorage.getItem(`schedule-summary-${dateStr}`)||'') } catch { setSummary('') }
    notified.current=new Set()
  }, [dateStr])

  // Clock tick
  useEffect(() => {
    const id=setInterval(()=>{ const n=new Date(); setCurrentMins(n.getHours()*60+n.getMinutes()) },60000)
    return ()=>clearInterval(id)
  }, [])

  // Notification permission
  useEffect(() => {
    if (typeof Notification!=='undefined'&&Notification.permission!=='granted') Notification.requestPermission()
  }, [])

  // Block notifications
  const classBlocks  = useMemo(()=>getClassBlocks(dateStr,settings),[dateStr,settings])
  const gcalTimed    = useMemo(()=>getTimedGCal(dateStr,settings),[dateStr,settings])
  const allDayEvents = useMemo(()=>getAllDayEvents(dateStr),[dateStr])

  const allBlocks = useMemo(()=>{
    const classRanges=classBlocks.map(b=>({start:b.startMins,end:b.endMins}))
    const filtGCal=gcalTimed.filter(g=>!classRanges.some(r=>g.startMins<r.end&&g.endMins>r.start))
    return [...classBlocks,...filtGCal,...(dragBlocks||blocks)].sort((a,b)=>(a.startMins||0)-(b.startMins||0))
  },[classBlocks,gcalTimed,blocks,dragBlocks])

  // Sync focusBlock
  useEffect(()=>{
    if(!focusBlock)return
    const u=allBlocks.find(b=>b.id===focusBlock.id)
    if(u)setFocusBlock(u);else setFocusBlock(null)
  },[allBlocks]) // eslint-disable-line

  useEffect(()=>{
    if(typeof Notification==='undefined'||Notification.permission!=='granted')return
    allBlocks.filter(b=>b.startMins===currentMins+5).forEach(b=>{
      if(notified.current.has(b.id))return
      notified.current.add(b.id)
      try{new Notification((b.emoji?b.emoji+' ':'')+b.title,{body:'Começa em 5 minutos!'})}catch{}
    })
  },[currentMins]) // eslint-disable-line

  // Undo/redo keyboard
  useEffect(()=>{
    const handler=e=>{
      const z=e.key==='z'||e.key==='Z', y=e.key==='y'||e.key==='Y'
      if(!(e.ctrlKey||e.metaKey))return
      if(z&&!e.shiftKey){
        const prev=history.current.pop(); if(!prev)return
        setBlocksRaw(cur=>{redoStack.current.push(cur);setCanRedo(true);return cur})
        setBlocksRaw(prev); saveBlocks(dateStr,prev)
        setCanUndo(history.current.length>0)
      } else if(y||(z&&e.shiftKey)){
        const next=redoStack.current.pop(); if(!next)return
        history.current.push(next); setBlocksRaw(next); saveBlocks(dateStr,next)
        setCanUndo(true); setCanRedo(redoStack.current.length>0)
      }
    }
    window.addEventListener('keydown',handler)
    return ()=>window.removeEventListener('keydown',handler)
  },[dateStr])

  const conflictIds  = useMemo(()=>detectConflicts(allBlocks),[allBlocks])
  const scheduledMins= useMemo(()=>allBlocks.filter(b=>b.startMins!=null).reduce((s,b)=>s+(b.endMins-b.startMins),0),[allBlocks])
  const freeMins     = Math.max(0,(sleepMin-wakeMin)-scheduledMins)
  const totalHours   = (sleepMin-wakeMin)/60
  const isToday      = dateStr===toDateStr(today)
  const dow          = selDate.getDay()
  const subjects     = settings?.subjects||[]
  const todaySubKeys = settings?.schedule?.[dow]||[]
  const todaySubjects= subjects.filter(s=>todaySubKeys.includes(s.key))
  const hours        = []
  for(let m=wakeMin;m<sleepMin;m+=60)hours.push(m)

  // Week data
  const weekDays = useMemo(()=>{
    const mon=getMondayOf(selDate)
    return Array.from({length:7},(_,i)=>{ const d=new Date(mon);d.setDate(mon.getDate()+i);return d })
  },[selDate])
  const weekDotData = useMemo(()=>weekDays.map((d,i)=>{
    const ds=toDateStr(d)
    const has=loadBlocks(ds).length>0||getClassBlocks(ds,settings).length>0||getTimedGCal(ds,settings).length>0
    return {date:d,dateStr:ds,hasBlocks:has,label:DAY_SHORT[(i+1)%7]}
  }),[selDate,settings,gcalTimed]) // eslint-disable-line
  const weekStats = useMemo(()=>weekDays.map((d,i)=>{
    const ds=toDateStr(d)
    const all=[...getClassBlocks(ds,settings),...loadBlocks(ds),...getTimedGCal(ds,settings)]
    const mins=all.filter(b=>b.startMins!=null).reduce((s,b)=>s+(b.endMins-b.startMins),0)
    return {label:DAY_SHORT[(i+1)%7],mins}
  }),[weekDays,settings])
  const weekDayBlocks = useMemo(()=>{
    if(!weekView)return{}
    return Object.fromEntries(weekDays.map(d=>{
      const ds=toDateStr(d),cb=getClassBlocks(ds,settings),gc=getTimedGCal(ds,settings),sb=loadBlocks(ds)
      const cr=cb.map(b=>({start:b.startMins,end:b.endMins}))
      const fg=gc.filter(g=>!cr.some(r=>g.startMins<r.end&&g.endMins>r.start))
      return [ds,[...cb,...fg,...sb].sort((a,b)=>(a.startMins||0)-(b.startMins||0))]
    }))
  },[weekView,weekDays,settings])

  // Templates
  const templateBlocks = useMemo(()=>{ try{return JSON.parse(localStorage.getItem('schedule-template')||'[]')}catch{return[]} },[])
  const saveTemplate   = ()=>{ const t=blocks.filter(b=>!b.locked).map(({id,startMins,endMins,...r})=>r); ls.set('schedule-template',t) }
  const applyTemplate  = ()=>{
    try{
      const t=ls.get('schedule-template',[]); if(!t.length)return
      setBlocks([...blocks.filter(b=>b.locked),...t.map(b=>({...b,id:uid(),startMins:toMins(b.startTime),endMins:toMins(b.endTime)}))])
    }catch{}
  }

  // ICS export
  const exportICS = ()=>{
    const exp=allBlocks.filter(b=>b.startMins!=null&&!b.locked)
    const ds=dateStr.replace(/-/g,'')
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//WhatShouldIDoNext//EN',
      ...exp.flatMap(b=>['BEGIN:VEVENT',`UID:${b.id}@wsidnext`,
        `DTSTART;TZID=Europe/Lisbon:${ds}T${b.startTime.replace(':','')}00`,
        `DTEND;TZID=Europe/Lisbon:${ds}T${b.endTime.replace(':','')}00`,
        `SUMMARY:${b.title}`,'END:VEVENT']),'END:VCALENDAR']
    const url=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/calendar'}))
    const a=document.createElement('a'); a.href=url; a.download=`horario-${dateStr}.ics`; a.click(); URL.revokeObjectURL(url)
  }

  // Auto-schedule
  const handleAutoSchedule = async()=>{
    setAiError(null)
    const key=localStorage.getItem('groq-key')||''
    const kept=blocks.filter(b=>b.locked&&b.type!=='class')
    if(key){
      setAiLoading(true)
      try{
        const gen=await aiSchedule(dateStr,settings,household,key)
        setBlocks([...kept,...gen])
      }catch(e){
        setAiError('Erro IA: '+e.message)
        setBlocks([...kept,...autoScheduleDay(dateStr,settings,household)])
      }finally{setAiLoading(false)}
    }else{
      setBlocks([...kept,...autoScheduleDay(dateStr,settings,household)])
    }
  }

  // AI summary
  const handleAISummary = async()=>{
    const key=localStorage.getItem('groq-key')||''
    if(!key){setAiError('Configura a chave Groq nas definições.');return}
    setSummaryLoading(true)
    try{
      const list=allBlocks.filter(b=>b.startMins!=null).map(b=>`${b.startTime}–${b.endTime}: ${b.emoji||''} ${b.title}`).join('\n')
      const res=await callGroq(key,'És um assistente motivacional para estudantes. Responde em português de Portugal.',`Horário de hoje (${dateStr}):\n${list||'Dia sem blocos.'}\n\nEscreve um resumo motivacional de 2-3 frases.`)
      setSummary(res); ls.set(`schedule-summary-${dateStr}`,res)
    }catch(e){setAiError('Erro resumo: '+e.message)
    }finally{setSummaryLoading(false)}
  }

  // CRUD
  const deleteBlock  = id=>setBlocks(blocks.filter(b=>b.id!==id))
  const snoozeBlock  = block=>{
    setBlocks(blocks.filter(b=>b.id!==block.id))
    const tom=new Date(selDate); tom.setDate(tom.getDate()+1); const ts=toDateStr(tom)
    const sn=loadSnoozed(ts); if(!sn.includes(block.title))saveSnoozed(ts,[...sn,block.title])
  }
  const toggleDone   = id=>{
    setDoneBlocksRaw(prev=>{
      const next=new Set(prev)
      next.has(id)?next.delete(id):next.add(id)
      saveDoneBlocks(dateStr,next); return next
    })
  }
  const saveBlock    = block=>{
    const start=toMins(block.startTime), end=toMins(block.endTime)
    const b={...block,...(STYLES[block.type]||STYLES.manual),startMins:start,endMins:end,id:block.id||uid()}
    if(block.type==='study'&&block.subjectKey){
      const s=settings?.subjects?.find(s=>s.key===block.subjectKey)
      if(s){b.color=s.color;b.emoji=s.emoji}
    }
    setBlocks(editingBlock?.id?blocks.map(x=>x.id===b.id?b:x):[...blocks,b])
    setShowBlockModal(false);setEditingBlock(null);setPrefilledTime(null)
  }
  const saveClassTime = ct=>{
    setSettings(prev=>{
      const cur=prev?.classTimes||[]
      return {...prev,classTimes:ct.id?cur.map(x=>x.id===ct.id?ct:x):[...cur,{...ct,id:uid()}]}
    });setEditingClass(null)
  }
  const deleteClassTime = id=>setSettings(prev=>({...prev,classTimes:(prev.classTimes||[]).filter(ct=>ct.id!==id)}))
  const saveHouseTask = h=>{
    const u=h.id?household.map(x=>x.id===h.id?h:x):[...household,{...h,id:uid()}]
    setHousehold(u);setEditingHouse(null)
  }
  const deleteHouseTask = id=>setHousehold(household.filter(h=>h.id!==id))
  const markHouseDone   = id=>setHousehold(household.map(h=>h.id===id?{...h,lastDone:dateStr}:h))
  const updateTarget    = (k,v)=>{ const n={...dailyTargets,[k]:v}; setDailyTargets(n);saveDailyTargets(n) }

  // Nav
  const prevDay = ()=>{ const d=new Date(selDate);d.setDate(d.getDate()-1);setSelDate(d) }
  const nextDay = ()=>{ const d=new Date(selDate);d.setDate(d.getDate()+1);setSelDate(d) }
  const goToday = ()=>setSelDate(today)

  // Drag
  const handleMouseDown = (e,block)=>{
    if(block.locked)return; e.preventDefault()
    dragState.current={blockId:block.id,startY:e.clientY,origStartMins:block.startMins,origEndMins:block.endMins}
    setDraggingId(block.id); setDragBlocks(blocks.map(b=>({...b})))
  }
  const handleResizeDown = (e,block)=>{
    if(block.locked)return; e.preventDefault(); e.stopPropagation()
    resizeState.current={blockId:block.id,startY:e.clientY,origEndMins:block.endMins}
    setResizingId(block.id); setDragBlocks(blocks.map(b=>({...b})))
  }
  const handleMouseMove = useCallback(e=>{
    if(resizeState.current){
      const{blockId,startY,origEndMins}=resizeState.current
      const delta=Math.round(((e.clientY-startY)/HOUR_H)*60/15)*15
      const block=blocks.find(b=>b.id===blockId); if(!block)return
      const newEnd=Math.max(block.startMins+MIN_BLOCK,Math.min(sleepMin,origEndMins+delta))
      setDragBlocks(prev=>(prev||blocks).map(b=>b.id===blockId?{...b,endMins:newEnd,endTime:toTime(newEnd)}:b))
      return
    }
    if(!dragState.current)return
    const{blockId,startY,origStartMins,origEndMins}=dragState.current
    const delta=Math.round(((e.clientY-startY)/HOUR_H)*60/15)*15
    const dur=origEndMins-origStartMins
    const newStart=Math.max(wakeMin,Math.min(sleepMin-dur,origStartMins+delta))
    const newEnd=newStart+dur
    setDragBlocks(prev=>(prev||blocks).map(b=>b.id===blockId?{...b,startMins:newStart,endMins:newEnd,startTime:toTime(newStart),endTime:toTime(newEnd)}:b))
  },[blocks,wakeMin,sleepMin])
  const handleMouseUp = useCallback(()=>{
    if(resizeState.current){
      const{blockId}=resizeState.current; resizeState.current=null; setResizingId(null)
      if(dragBlocks){ const r=dragBlocks.find(b=>b.id===blockId); if(r)setBlocks(blocks.map(b=>b.id===blockId?{...b,endMins:r.endMins,endTime:r.endTime}:b)); setDragBlocks(null) }
      return
    }
    if(!dragState.current)return
    const{blockId}=dragState.current; dragState.current=null; setDraggingId(null)
    if(dragBlocks){ const m=dragBlocks.find(b=>b.id===blockId); if(m)setBlocks(blocks.map(b=>b.id===blockId?{...b,startMins:m.startMins,endMins:m.endMins,startTime:m.startTime,endTime:m.endTime}:b)); setDragBlocks(null) }
  },[dragBlocks,blocks,setBlocks])

  const handleTimelineClick = e=>{
    if(dragState.current||draggingId)return
    const rect=e.currentTarget.getBoundingClientRect()
    const relY=e.clientY-rect.top-16
    const clicked=Math.round(((relY/HOUR_H)*60+wakeMin)/15)*15
    const snapped=Math.max(wakeMin,Math.min(sleepMin-30,clicked))
    setPrefilledTime(toTime(snapped)); setEditingBlock(null); setShowBlockModal(true)
  }

  // Household due today
  const houseDueToday = household.filter(h=>{
    if(h.preferredDay!==undefined&&h.preferredDay!==dow)return false
    if(!h.lastDone)return true
    const ds=Math.round((new Date(dateStr+'T12:00:00')-new Date(h.lastDone+'T12:00:00'))/86400000)
    const iv=h.frequency==='daily'?1:h.frequency==='weekly'?7:h.frequency==='biweekly'?14:30
    return ds>=iv
  })

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="sched-root" style={{padding:'24px 28px',maxWidth:1120,margin:'0 auto'}} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <Styles/>

      {/* ─── Header ─── */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        {/* Date nav */}
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <button onClick={prevDay} style={{background:'white',border:'1.5px solid #e8e8e8',borderRadius:8,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#666'}}>
            <ChevronLeft size={16}/>
          </button>
          <div style={{textAlign:'center',minWidth:210}}>
            <p style={{fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:'1.2rem',color:'#1a1a1a',letterSpacing:'-0.03em',lineHeight:1.2}}>
              {DAY_FULL[selDate.getDay()]}, {selDate.getDate()} de {MONTHS[selDate.getMonth()]}
            </p>
            {!isToday&&(
              <p style={{fontSize:'0.68rem',color:'#bbb',marginTop:2,fontFamily:"'DM Mono',monospace"}}>
                {selDate>today?`+${Math.round((selDate-today)/86400000)}d`:`-${Math.round((today-selDate)/86400000)}d`}
              </p>
            )}
          </div>
          <button onClick={nextDay} style={{background:'white',border:'1.5px solid #e8e8e8',borderRadius:8,width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#666'}}>
            <ChevronRight size={16}/>
          </button>
        </div>

        <Btn onClick={()=>setWeekView(v=>!v)} bg={weekView?'#1a1a1a':'#f2f2f2'} color={weekView?'#1a1a1a':'#555'} solid={weekView}>
          📅 {weekView?'Vista diária':'Vista semanal'}
        </Btn>
        {!isToday&&<Btn onClick={goToday} bg="#f2f2f2" color="#555">Hoje</Btn>}

        <div style={{marginLeft:'auto',display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}>
          {canUndo&&<Btn onClick={()=>{const p=history.current.pop();if(!p)return;setBlocksRaw(cur=>{redoStack.current.push(cur);setCanRedo(true);return cur});setBlocksRaw(p);saveBlocks(dateStr,p);setCanUndo(history.current.length>0)}} bg="#f5f5f5" color="#666" title="Desfazer (Ctrl+Z)">↩ Desfazer</Btn>}
          {canRedo&&<Btn onClick={()=>{const n=redoStack.current.pop();if(!n)return;history.current.push(n);setBlocksRaw(n);saveBlocks(dateStr,n);setCanUndo(true);setCanRedo(redoStack.current.length>0)}} bg="#f5f5f5" color="#666" title="Refazer (Ctrl+Y)">↪ Refazer</Btn>}
          <Btn onClick={exportICS} bg="#ecfeff" color="#0891b2" title="Exportar para calendário">📤 Exportar</Btn>
          <Btn onClick={()=>setShowClassEditor(true)} bg="#f5f3ff" color="#7c3aed"><Settings2 size={13}/> Aulas</Btn>
          <Btn onClick={()=>setShowHouseModal(true)} bg="#fffbeb" color="#d97706">🏠 Domésticas</Btn>
          <Btn onClick={()=>{setEditingBlock(null);setPrefilledTime(null);setShowBlockModal(true)}} bg="#f0fdf4" color="#16a34a"><Plus size={13}/> Bloco</Btn>
          <Btn onClick={handleAutoSchedule} disabled={aiLoading} solid color="#db2777" bg="#fdf2f7">
            <Zap size={13}/> {aiLoading?'A pensar...':(localStorage.getItem('groq-key')?'Auto-agendar ✨':'Auto-agendar')}
          </Btn>
        </div>
      </div>

      {/* ─── AI error ─── */}
      {aiError&&(
        <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:10,padding:'8px 14px',marginBottom:12,fontSize:'0.75rem',color:'#dc2626',display:'flex',alignItems:'center',gap:8}}>
          ⚠️ {aiError}
          <button onClick={()=>setAiError(null)} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'#dc2626',fontSize:'1rem'}}>✕</button>
        </div>
      )}

      {/* ─── Week dots ─── */}
      <div style={{display:'flex',gap:4,marginBottom:16,alignItems:'center'}}>
        {weekDotData.map((wd,i)=>{
          const isSel=wd.dateStr===dateStr
          return (
            <button key={wd.dateStr} onClick={()=>setSelDate(wd.date)} title={DAY_FULL[(i+1)%7]}
              style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:isSel?'#f5f5f5':'transparent',border:'none',cursor:'pointer',padding:'4px 8px',borderRadius:8}}>
              <span style={{fontSize:'0.58rem',fontWeight:500,color:isSel?'#1a1a1a':'#bbb',textTransform:'uppercase',letterSpacing:'0.06em'}}>{wd.label}</span>
              <div style={{width:8,height:8,borderRadius:'50%',background:wd.hasBlocks?(isSel?'#1a1a1a':'#ccc'):'#f0f0f0',border:isSel?'2px solid #1a1a1a':'1.5px solid transparent'}}/>
            </button>
          )
        })}
      </div>

      {/* ─── Stats bar ─── */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        {[
          {label:'Livre',     value:fmtDur(freeMins),         color:'#16a34a',bg:'#f0fdf4'},
          {label:'Agendado',  value:fmtDur(scheduledMins),    color:'#0891b2',bg:'#ecfeff'},
          {label:'Total dia', value:`${totalHours}h`,         color:'#71717a',bg:'#fafafa'},
          {label:'Aulas',     value:String(classBlocks.length),color:'#7c3aed',bg:'#f5f3ff'},
        ].map(s=>(
          <div key={s.label} style={{background:s.bg,border:`1px solid ${s.color}22`,borderRadius:10,padding:'8px 14px',minWidth:90}}>
            <p style={{fontSize:'0.62rem',fontWeight:500,color:s.color,textTransform:'uppercase',letterSpacing:'0.07em'}}>{s.label}</p>
            <p style={{fontFamily:"'Fraunces',serif",fontSize:'1.1rem',fontWeight:700,color:s.color}}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ─── AI summary ─── */}
      <div style={{background:'white',border:'1px solid #ececec',borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'flex-start',gap:12}}>
        <div style={{flex:1}}>
          {summary
            ?<p style={{fontSize:'0.8rem',color:'#555',lineHeight:1.7}}>{summary}</p>
            :<p style={{fontSize:'0.75rem',color:'#bbb',fontStyle:'italic'}}>Gera um resumo motivacional do teu dia com IA.</p>
          }
        </div>
        <Btn onClick={handleAISummary} disabled={summaryLoading} bg="#f5f3ff" color="#7c3aed">
          {summaryLoading?'...':'✨ Resumo'}
        </Btn>
      </div>

      {/* ─── All-day events ─── */}
      {allDayEvents.length>0&&(
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
          {allDayEvents.map(e=>{
            const s=STYLES[e.type]||STYLES.event
            return <div key={e.id} style={{background:s.bg,border:`1px solid ${s.border}`,borderRadius:8,padding:'4px 10px',fontSize:'0.75rem',fontWeight:500,color:s.color}}>{e.title}</div>
          })}
        </div>
      )}

      {/* ─── Week View ─── */}
      {weekView?(
        <div style={{background:'white',borderRadius:16,border:'1px solid #ececec',overflow:'hidden',overflowX:'auto'}}>
          <div style={{display:'grid',gridTemplateColumns:`48px repeat(7,1fr)`,minWidth:700}}>
            <div style={{borderBottom:'1px solid #ececec'}}/>
            {weekDays.map((d,i)=>{
              const ds=toDateStr(d),isSel=ds===dateStr,isT=ds===toDateStr(today),stat=weekStats[i]
              const fill=Math.min(100,Math.round((stat.mins/(sleepMin-wakeMin))*100))
              return (
                <div key={ds} onClick={()=>{setSelDate(d);setWeekView(false)}}
                  style={{borderBottom:'1px solid #ececec',borderLeft:'1px solid #ececec',padding:'8px 4px 4px',textAlign:'center',cursor:'pointer',background:isSel?'#f7f7f7':'transparent'}}>
                  <p style={{fontSize:'0.6rem',fontWeight:500,color:isT?'#db2777':'#bbb',textTransform:'uppercase',letterSpacing:'0.06em'}}>{DAY_SHORT[(i+1)%7]}</p>
                  <p style={{fontFamily:"'Fraunces',serif",fontSize:'1rem',fontWeight:700,color:isT?'#db2777':'#1a1a1a'}}>{d.getDate()}</p>
                  <div style={{height:3,background:'#f0f0f0',borderRadius:2,margin:'3px 4px 0'}}>
                    <div style={{height:'100%',width:`${fill}%`,background:stat.mins>4*60?'#16a34a':stat.mins>2*60?'#f59e0b':'#d4d4d8',borderRadius:2}}/>
                  </div>
                </div>
              )
            })}
            <div style={{position:'relative'}}>
              {hours.map(m=>(
                <div key={m} style={{height:HOUR_H,borderTop:'1px solid #f0f0f0',display:'flex',alignItems:'flex-start'}}>
                  <span style={{fontSize:'0.62rem',color:'#bbb',padding:'0 4px',marginTop:-8,fontWeight:500}}>{fmtTime(toTime(m))}</span>
                </div>
              ))}
            </div>
            {weekDays.map((d,i)=>{
              const ds=toDateStr(d),dayBs=weekDayBlocks[ds]||[],isSel=ds===dateStr
              return (
                <div key={ds} style={{position:'relative',borderLeft:'1px solid #ececec',background:isSel?'#fafafa':'transparent'}}>
                  {hours.map(m=><div key={m} style={{height:HOUR_H,borderTop:'1px solid #f0f0f0'}}/>)}
                  {dayBs.filter(b=>b.startMins!=null).map(block=>{
                    const top=toPx(block.startMins-wakeMin),h=Math.max(toPx(block.endMins-block.startMins),12)
                    const s=STYLES[block.type]||STYLES.manual
                    return (
                      <div key={block.id} title={block.title}
                        style={{position:'absolute',top,left:2,right:2,height:h,background:block.bg||s.bg,border:`1px solid ${block.border||s.border}`,borderLeft:`3px solid ${block.color||s.color}`,borderRadius:4,overflow:'hidden',fontSize:'0.6rem',fontWeight:500,color:block.color||s.color,padding:'1px 3px',display:'flex',alignItems:'center',gap:2}}>
                        {block.emoji&&<span>{block.emoji}</span>}
                        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{block.title}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      ):(
        /* ─── Day view ─── */
        <div style={{display:'grid',gridTemplateColumns:'1fr 272px',gap:18,alignItems:'start'}}>

          {/* Timeline */}
          <div style={{background:'white',borderRadius:16,border:'1px solid #ececec',overflow:'hidden',position:'relative'}}>
            {aiLoading&&(
              <div style={{position:'absolute',inset:0,background:'rgba(255,255,255,0.9)',zIndex:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12}}>
                <div style={{fontSize:'1.8rem',animation:'spin 1.2s linear infinite'}}>✨</div>
                <p style={{fontSize:'0.82rem',fontWeight:500,color:'#db2777',fontFamily:"'DM Mono',monospace"}}>A gerar horário com IA...</p>
              </div>
            )}
            {!aiLoading&&blocks.length===0&&classBlocks.length===0&&gcalTimed.length===0&&(
              <div style={{padding:'56px 32px',display:'flex',flexDirection:'column',alignItems:'center',gap:14,textAlign:'center'}}>
                <div style={{fontSize:'2.5rem'}}>✨</div>
                <p style={{fontFamily:"'Fraunces',serif",fontWeight:700,fontSize:'1.1rem',color:'#1a1a1a'}}>Dia em branco</p>
                <p style={{fontSize:'0.78rem',color:'#bbb',maxWidth:220,lineHeight:1.7}}>
                  Clica em <strong>Auto-agendar</strong> para gerar o horário deste dia.
                </p>
                <Btn onClick={handleAutoSchedule} solid color="#db2777" bg="#fdf2f7" style={{marginTop:4}}>
                  <Zap size={13}/> Auto-agendar
                </Btn>
              </div>
            )}

            <div style={{position:'relative',paddingLeft:56,paddingTop:16,cursor:'crosshair'}} onClick={handleTimelineClick}>
              {/* Hour lines */}
              {hours.map(m=>(
                <div key={m} style={{height:HOUR_H,borderTop:'1px solid #f5f5f5',position:'relative'}}>
                  <span style={{position:'absolute',left:-50,top:-8,fontSize:'0.66rem',fontWeight:500,color:'#ccc',width:44,textAlign:'right'}}>{fmtTime(toTime(m))}</span>
                </div>
              ))}

              {/* Current time */}
              {isToday&&currentMins>=wakeMin&&currentMins<=sleepMin&&(
                <div style={{position:'absolute',top:16+toPx(currentMins-wakeMin),left:0,right:0,height:2,background:'#ef4444',zIndex:5,pointerEvents:'none'}}>
                  <div style={{position:'absolute',left:48,top:-4,width:10,height:10,borderRadius:'50%',background:'#ef4444'}}/>
                </div>
              )}

              {/* Blocks */}
              <div style={{position:'absolute',top:16,left:56,right:0}}>
                {allBlocks.filter(b=>b.startMins!=null&&b.endMins!=null).map((block,idx)=>{
                  const top=toPx(block.startMins-wakeMin)
                  const height=Math.max(toPx(block.endMins-block.startMins),18)
                  const dur=block.endMins-block.startMins
                  const small=height<36
                  const isDone=doneBlocks.has(block.id)
                  const hasConf=conflictIds.has(block.id)
                  const isDrag=draggingId===block.id
                  const canPom=(block.type==='study'||block.type==='manual')&&!block.locked
                  return (
                    <div key={block.id} className="sched-block"
                      onMouseDown={e=>{e.stopPropagation();handleMouseDown(e,block)}}
                      onClick={e=>{e.stopPropagation();if(!dragState.current&&!resizeState.current&&!isDrag)setFocusBlock(block)}}
                      style={{position:'absolute',top,left:4,right:4,height,
                        background:block.bg||'#f5f3ff',
                        border:`1.5px solid ${hasConf?'#ef4444':(block.border||block.color||'#ccc')}`,
                        borderLeft:`3px solid ${hasConf?'#ef4444':(block.color||'#7c3aed')}`,
                        borderRadius:8,padding:small?'2px 8px':'6px 10px',
                        display:'flex',alignItems:small?'center':'flex-start',flexDirection:small?'row':'column',gap:small?6:2,
                        overflow:'hidden',zIndex:isDrag?20:(block.locked?1:2),
                        opacity:isDone?0.38:1,cursor:block.locked?'default':'grab',
                        boxShadow:isDrag?'0 4px 20px rgba(0,0,0,0.14)':'none',
                        transition:isDrag?'none':'opacity 0.2s',
                        animationDelay:`${idx*0.04}s`}}>
                      {hasConf&&<span style={{position:'absolute',top:2,right:2,fontSize:'0.6rem',zIndex:3}}>⚠️</span>}
                      <div style={{display:'flex',alignItems:'center',gap:5,minWidth:0,flex:1}}>
                        {block.emoji&&<span style={{fontSize:small?'0.72rem':'0.82rem',flexShrink:0}}>{block.emoji}</span>}
                        <span style={{fontSize:small?'0.7rem':'0.76rem',fontWeight:500,color:block.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:isDone?'line-through':'none'}}>
                          {block.title}
                        </span>
                      </div>
                      {!small&&<span style={{fontSize:'0.65rem',color:(block.color||'#666')+'99',fontWeight:400}}>
                        {fmtTime(block.startTime)} – {fmtTime(block.endTime)} · {fmtDur(dur)}
                      </span>}
                      {!block.locked&&(
                        <div style={{marginLeft:'auto',display:'flex',gap:2,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                          {canPom&&!small&&(
                            <button className="sched-icon-btn" title="Iniciar Pomodoro"
                              onMouseDown={e=>e.stopPropagation()}
                              onClick={e=>{e.stopPropagation();if(onStartPomodoro)onStartPomodoro({subjectKey:block.subjectKey,title:block.title});if(onNavigate)onNavigate('hours')}}>🍅</button>
                          )}
                          <button className="sched-icon-btn" title={isDone?'Desfazer':'Marcar feito'}
                            onMouseDown={e=>e.stopPropagation()}
                            onClick={e=>{e.stopPropagation();toggleDone(block.id)}}
                            style={{color:isDone?'#16a34a':block.color}}>
                            <Check size={10}/>
                          </button>
                          <button className="sched-icon-btn" title="Editar"
                            onMouseDown={e=>e.stopPropagation()}
                            onClick={e=>{e.stopPropagation();setEditingBlock(block);setShowBlockModal(true)}}>
                            <Pencil size={10}/>
                          </button>
                          <button className="sched-icon-btn" title="Adiar para amanhã" style={{color:'#d97706'}}
                            onMouseDown={e=>e.stopPropagation()}
                            onClick={e=>{e.stopPropagation();snoozeBlock(block)}}>➡️</button>
                          <button className="sched-icon-btn" title="Apagar" style={{color:'#dc2626'}}
                            onMouseDown={e=>e.stopPropagation()}
                            onClick={e=>{e.stopPropagation();deleteBlock(block.id)}}>
                            <X size={10}/>
                          </button>
                        </div>
                      )}
                      {block.locked&&block.subtitle&&!small&&(
                        <span style={{fontSize:'0.62rem',color:(block.color||'#666')+'88'}}>{block.subtitle}</span>
                      )}
                      {!block.locked&&(
                        <div onMouseDown={e=>handleResizeDown(e,block)}
                          style={{position:'absolute',bottom:0,left:0,right:0,height:8,cursor:'ns-resize',background:'transparent',zIndex:10}}/>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>

            {/* Subjects */}
            {todaySubjects.length>0&&(
              <div className="sched-card">
                <p style={{fontSize:'0.65rem',fontWeight:500,color:'#999',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:12}}>📚 Cadeiras hoje</p>
                {todaySubjects.map(subj=>{
                  const target=dailyTargets[subj.key]
                  return (
                    <div key={subj.key} style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                      <div style={{width:28,height:28,borderRadius:8,background:subj.color||'#f0f0f0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.85rem',flexShrink:0}}>{subj.emoji}</div>
                      <p style={{flex:1,fontSize:'0.75rem',fontWeight:500,color:'#1a1a1a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{subj.name}</p>
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        <input type="number" min="0.25" max="6" step="0.25" value={target||''} placeholder="1.5"
                          onChange={e=>updateTarget(subj.key,e.target.value)}
                          style={{width:44,border:'1.5px solid #e8e8e8',borderRadius:6,padding:'3px 5px',fontSize:'0.72rem',textAlign:'center',fontFamily:"'DM Mono',monospace",color:'#1a1a1a'}}/>
                        <span style={{fontSize:'0.62rem',color:'#bbb'}}>h</span>
                      </div>
                    </div>
                  )
                })}
                <p style={{fontSize:'0.62rem',color:'#ccc',marginTop:4}}>Meta de horas · usado no auto-agendamento</p>
              </div>
            )}

            {/* Household due */}
            {houseDueToday.length>0&&(
              <div className="sched-card">
                <p style={{fontSize:'0.65rem',fontWeight:500,color:'#999',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:12}}>🏠 Domésticas hoje</p>
                {houseDueToday.map(h=>(
                  <div key={h.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                    <span style={{fontSize:'1rem'}}>{h.emoji}</span>
                    <div style={{flex:1}}>
                      <p style={{fontSize:'0.75rem',fontWeight:500,color:'#1a1a1a'}}>{h.name}</p>
                      <p style={{fontSize:'0.62rem',color:'#bbb'}}>{fmtDur(h.duration)}</p>
                    </div>
                    <button className="sched-icon-btn" onClick={()=>markHouseDone(h.id)} style={{color:'#16a34a',background:'#f0fdf4',border:'1px solid #86efac',borderRadius:6,padding:'4px 8px'}}>
                      <Check size={12}/>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Templates */}
            <div className="sched-card">
              <p style={{fontSize:'0.65rem',fontWeight:500,color:'#999',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>💾 Template</p>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <Btn onClick={saveTemplate} bg="#f0fdf4" color="#16a34a">💾 Guardar</Btn>
                {templateBlocks.length>0&&<Btn onClick={applyTemplate} bg="#ecfeff" color="#0891b2">📋 Aplicar ({templateBlocks.length})</Btn>}
              </div>
            </div>

            {/* Week chart */}
            <div className="sched-card">
              <p style={{fontSize:'0.65rem',fontWeight:500,color:'#999',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:10}}>📊 Semana</p>
              <div style={{display:'flex',gap:5,alignItems:'flex-end',height:60}}>
                {weekStats.map(d=>{
                  const maxM=Math.max(...weekStats.map(x=>x.mins),1)
                  const barH=Math.max(4,Math.round((d.mins/maxM)*44))
                  const barC=d.mins>4*60?'#16a34a':d.mins>2*60?'#f59e0b':'#e8e8e8'
                  return (
                    <div key={d.label} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                      <div style={{width:'100%',height:barH,background:barC,borderRadius:3,transition:'height 0.3s'}} title={`${d.label}: ${fmtDur(d.mins)}`}/>
                      <span style={{fontSize:'0.56rem',fontWeight:500,color:'#bbb'}}>{d.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Tip */}
            <div className="sched-card" style={{background:'#fafafa',border:'1px solid #e8e8e8'}}>
              <p style={{fontSize:'0.68rem',color:'#999',lineHeight:1.6}}>
                💡 Clica na linha do tempo para adicionar um bloco à hora escolhida. Arrasta para mover, puxa a borda inferior para redimensionar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Focus overlay */}
      {focusBlock&&(
        <FocusOverlay block={focusBlock} currentMins={currentMins} onClose={()=>setFocusBlock(null)}
          onStartPomodoro={()=>{if(onStartPomodoro)onStartPomodoro({subjectKey:focusBlock.subjectKey,title:focusBlock.title});if(onNavigate)onNavigate('hours');setFocusBlock(null)}}/>
      )}

      {/* Class editor modal */}
      {showClassEditor&&(
        <Modal onClose={()=>{setShowClassEditor(false);setEditingClass(null)}} title="📖 Horário de aulas" wide>
          <div style={{marginBottom:16}}>
            <Btn onClick={()=>setEditingClass({dayOfWeek:dow,startTime:'09:00',endTime:'11:00',subjectKey:'',room:''})} solid color="#0891b2" bg="#ecfeff"><Plus size={13}/> Nova aula</Btn>
          </div>
          {!(settings?.classTimes||[]).length&&<p style={{fontSize:'0.78rem',color:'#bbb'}}>Nenhuma aula configurada.</p>}
          {[0,1,2,3,4,5,6].map(d=>{
            const entries=(settings?.classTimes||[]).filter(ct=>ct.dayOfWeek===d)
            if(!entries.length)return null
            return (
              <div key={d} style={{marginBottom:14}}>
                <p style={{fontSize:'0.65rem',fontWeight:500,color:'#bbb',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:8}}>{DAY_FULL[d]}</p>
                {entries.map(ct=>{
                  const subj=subjects.find(s=>s.key===ct.subjectKey)
                  return (
                    <div key={ct.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'#ecfeff',border:'1px solid #a5f3fc',borderRadius:10,marginBottom:6}}>
                      <span>{subj?.emoji||'📖'}</span>
                      <div style={{flex:1}}>
                        <p style={{fontSize:'0.78rem',fontWeight:500,color:'#0891b2'}}>{subj?.name||ct.label||'Aula'}</p>
                        <p style={{fontSize:'0.65rem',color:'#0891b2aa'}}>{fmtTime(ct.startTime)} – {fmtTime(ct.endTime)}{ct.room?` · ${ct.room}`:''}</p>
                      </div>
                      <button className="sched-icon-btn" onClick={()=>setEditingClass(ct)}><Pencil size={12}/></button>
                      <button className="sched-icon-btn" onClick={()=>deleteClassTime(ct.id)} style={{color:'#dc2626'}}><Trash2 size={12}/></button>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {editingClass&&<ClassTimeForm initial={editingClass} subjects={subjects} onSave={saveClassTime} onCancel={()=>setEditingClass(null)}/>}
        </Modal>
      )}

      {/* Household modal */}
      {showHouseModal&&(
        <Modal onClose={()=>{setShowHouseModal(false);setEditingHouse(null)}} title="🏠 Tarefas domésticas" wide>
          <div style={{marginBottom:16}}>
            <Btn onClick={()=>setEditingHouse({name:'',emoji:'🧹',duration:30,frequency:'weekly',color:'#71717a'})} solid color="#d97706" bg="#fffbeb"><Plus size={13}/> Nova tarefa</Btn>
          </div>
          {household.map(h=>(
            <div key={h.id} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,marginBottom:6}}>
              <span style={{fontSize:'1.1rem'}}>{h.emoji}</span>
              <div style={{flex:1}}>
                <p style={{fontSize:'0.78rem',fontWeight:500,color:'#d97706'}}>{h.name}</p>
                <p style={{fontSize:'0.65rem',color:'#d97706aa'}}>{fmtDur(h.duration)} · {FREQUENCIES.find(f=>f.id===h.frequency)?.label}{h.preferredDay!==undefined?` · ${DAY_FULL[h.preferredDay]}`:''}{h.lastDone?` · Última: ${h.lastDone}`:' · Nunca feito'}</p>
              </div>
              <button className="sched-icon-btn" onClick={()=>markHouseDone(h.id)} style={{color:'#16a34a'}} title="Marcar feito hoje"><Check size={13}/></button>
              <button className="sched-icon-btn" onClick={()=>setEditingHouse(h)}><Pencil size={13}/></button>
              <button className="sched-icon-btn" onClick={()=>deleteHouseTask(h.id)} style={{color:'#dc2626'}}><Trash2 size={13}/></button>
            </div>
          ))}
          {editingHouse&&<HouseholdForm initial={editingHouse} onSave={saveHouseTask} onCancel={()=>setEditingHouse(null)}/>}
        </Modal>
      )}

      {/* Block form */}
      {showBlockModal&&(
        <BlockForm
          initial={editingBlock||{type:'study',startTime:prefilledTime||toTime(wakeMin+120),endTime:prefilledTime?toTime(toMins(prefilledTime)+60):toTime(wakeMin+210),title:'',emoji:''}}
          subjects={subjects} household={household}
          onSave={saveBlock}
          onCancel={()=>{setShowBlockModal(false);setEditingBlock(null);setPrefilledTime(null)}}
        />
      )}
    </div>
  )
}