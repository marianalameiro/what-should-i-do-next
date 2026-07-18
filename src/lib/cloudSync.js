import { supabase } from './supabase'
import { logger } from './logger'

// ── Camada de sincronização: espelha o localStorage ↔ Supabase (tabela app_data) ──
// A app guarda tudo em localStorage. Este módulo, quando há sessão iniciada:
//  1. puxa os dados da cloud e funde com os locais (last-write-wins por chave),
//  2. envia para a cloud as chaves locais que ainda não lá estão,
//  3. observa escritas no localStorage e empurra-as (debounce),
//  4. ouve mudanças remotas (tempo real) e atualiza o localStorage.

const TABLE = 'app_data'

const STATIC_KEYS = [
  'user-settings', 'study-sessions', 'exams', 'topics', 'exam-schedule', 'extra-tasks',
  'diary-entries', 'weekly-reviews', 'projects-v2', 'household-tasks', 'subject-targets',
  'weekly-targets', 'eisenhower-overrides', 'energy-levels', 'show-matrix',
  'calendar-events', 'gcal-events', 'quick-links', 'schedule-blocks', 'daily-study-targets',
  'subject-ects', 'old-grades', 'weekly-plans', 'archived-semesters',
]
const DYNAMIC_PREFIXES = ['tasks-', 'schedule-blocks-', 'schedule-done-', 'schedule-snoozed-']
const isSyncedKey = (k) => typeof k === 'string' && (STATIC_KEYS.includes(k) || DYNAMIC_PREFIXES.some(p => k.startsWith(p)))

const META_KEY = '__cloud_sync_meta' // { [key]: updated_at } — o que já está sincronizado
const RELOAD_GUARD = '__cloud_sync_reloaded'

function getMeta() { try { return JSON.parse(localStorage.getItem(META_KEY)) || {} } catch { return {} } }
function setMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)) } catch {} }
function safeParse(s) { try { return JSON.parse(s) } catch { return s } }

let userId = null
let channel = null
let patched = false
let applyingRemote = false          // a aplicar dados remotos → não voltar a empurrar
const pushQueue = new Map()         // key -> raw string | null (removido)
let pushTimer = null

function patchLocalStorage() {
  if (patched) return
  patched = true
  const origSet = localStorage.setItem.bind(localStorage)
  const origRemove = localStorage.removeItem.bind(localStorage)
  localStorage.setItem = (k, v) => {
    origSet(k, v)
    if (!applyingRemote && userId && isSyncedKey(k)) queuePush(k, v)
  }
  localStorage.removeItem = (k) => {
    origRemove(k)
    if (!applyingRemote && userId && isSyncedKey(k)) queuePush(k, null)
  }
}

function queuePush(key, rawValue) {
  pushQueue.set(key, rawValue)
  clearTimeout(pushTimer)
  pushTimer = setTimeout(flushPush, 1200)
}

async function flushPush() {
  if (!userId || pushQueue.size === 0) return
  const entries = [...pushQueue.entries()]
  pushQueue.clear()
  const now = new Date().toISOString()
  const rows = entries.map(([key, raw]) => ({
    user_id: userId, key,
    value: raw === null ? null : safeParse(raw),
    updated_at: now,
  }))
  try {
    const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'user_id,key' })
    if (error) throw error
    const m = getMeta()
    rows.forEach(r => { m[r.key] = now })
    setMeta(m)
  } catch (e) {
    logger?.api?.error?.('cloudSync.push', e)
    // volta a meter na fila para tentar mais tarde
    entries.forEach(([k, v]) => pushQueue.set(k, v))
  }
}

function localSyncedKeys() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (isSyncedKey(k)) keys.push(k)
  }
  return keys
}

async function pullAndMerge() {
  let changed = false
  const { data, error } = await supabase.from(TABLE).select('key,value,updated_at').eq('user_id', userId)
  if (error) { logger?.api?.error?.('cloudSync.pull', error); return false }
  const remoteKeys = new Set()
  const meta = getMeta()
  applyingRemote = true
  try {
    for (const r of data || []) {
      remoteKeys.add(r.key)
      if (meta[r.key] !== r.updated_at) {       // remoto desconhecido/mais recente → aplicar
        if (r.value === null) localStorage.removeItem(r.key)
        else localStorage.setItem(r.key, JSON.stringify(r.value))
        meta[r.key] = r.updated_at
        changed = true
      }
    }
  } finally { applyingRemote = false }
  setMeta(meta)
  // chaves locais que ainda não estão na cloud → enviar (primeira sincronização)
  for (const k of localSyncedKeys()) {
    if (!remoteKeys.has(k)) queuePush(k, localStorage.getItem(k))
  }
  await flushPush()
  return changed
}

function notify(key) {
  try {
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: localStorage.getItem(key) }))
    window.dispatchEvent(new CustomEvent('cloud-sync-updated', { detail: { key } }))
  } catch {}
}

function subscribeRealtime() {
  channel = supabase
    .channel(`app_data_${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` }, (payload) => {
      const r = payload.new || payload.old
      if (!r?.key) return
      const meta = getMeta()
      if (payload.eventType === 'DELETE') {
        applyingRemote = true; try { localStorage.removeItem(r.key) } finally { applyingRemote = false }
        delete meta[r.key]; setMeta(meta); notify(r.key)
        return
      }
      if (meta[r.key] === r.updated_at) return  // eco da nossa própria escrita
      applyingRemote = true
      try {
        if (r.value === null) localStorage.removeItem(r.key)
        else localStorage.setItem(r.key, JSON.stringify(r.value))
      } finally { applyingRemote = false }
      meta[r.key] = r.updated_at; setMeta(meta); notify(r.key)
    })
    .subscribe()
}

export async function startCloudSync(uid) {
  if (!uid || userId === uid) return
  userId = uid
  patchLocalStorage()
  const changed = await pullAndMerge()
  subscribeRealtime()
  // Se puxámos dados novos da cloud, recarrega uma vez para tudo (incl. definições) refletir.
  if (changed && !sessionStorage.getItem(RELOAD_GUARD)) {
    sessionStorage.setItem(RELOAD_GUARD, '1')
    window.location.reload()
  } else {
    sessionStorage.removeItem(RELOAD_GUARD)
  }
}

export function stopCloudSync() {
  userId = null
  if (channel) { supabase.removeChannel(channel); channel = null }
}
