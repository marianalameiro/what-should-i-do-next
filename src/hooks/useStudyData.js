import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── localStorage helpers ──────────────────────────────────────────────────────
const ls = {
  get: (key, fallback = []) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
    catch { return fallback }
  },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
}

function cloneDefaultValue(defaultValue) {
  if (Array.isArray(defaultValue)) return [...defaultValue]
  if (defaultValue && typeof defaultValue === 'object') return { ...defaultValue }
  return defaultValue
}

function normalizeStoredValue(value, defaultValue) {
  if (Array.isArray(defaultValue)) return Array.isArray(value) ? value : cloneDefaultValue(defaultValue)
  if (defaultValue && typeof defaultValue === 'object') {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { ...cloneDefaultValue(defaultValue), ...value }
      : cloneDefaultValue(defaultValue)
  }
  return value ?? defaultValue
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function sbGet(table, userId) {
  const { data, error } = await supabase
    .from(table)
    .select('data')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return data.data
}

async function sbSet(table, userId, value) {
  await supabase
    .from(table)
    .upsert({ user_id: userId, data: value }, { onConflict: 'user_id' })
}

// ── Generic hook ──────────────────────────────────────────────────────────────
export function useStudyData(key, defaultValue = []) {
  const [value, setValue] = useState(defaultValue)
  const [userId, setUserId] = useState(null)
  const [ready, setReady] = useState(false)

  // Get current user
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data?.session?.user?.id ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load data
  useEffect(() => {
    async function load() {
      if (userId) {
        const remote = await sbGet(key, userId)
        if (remote !== null) {
          setValue(normalizeStoredValue(remote, defaultValue))
        } else {
          // First login: migrate localStorage → Supabase
          const local = normalizeStoredValue(ls.get(key, defaultValue), defaultValue)
          setValue(local)
          await sbSet(key, userId, local)
        }
      } else {
        setValue(normalizeStoredValue(ls.get(key, defaultValue), defaultValue))
      }
      setReady(true)
    }
    load()
  }, [userId, key])

  // Save data
  const save = useCallback(async (updater) => {
    setValue(prev => {
      const candidate = typeof updater === 'function' ? updater(prev) : updater
      const next = normalizeStoredValue(candidate, defaultValue)
      ls.set(key, next)
      if (userId) sbSet(key, userId, next)
      return next
    })
  }, [userId, key, defaultValue])

  return [value, save, ready]
}
