import { useState, useEffect } from 'react'

const DEFAULT_SETTINGS = {
  name: '',
  userType: 'student',
  appName: 'what should I do next?',
  theme: 'light',
  subjects: [],
  schedule: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
  hoursGoal: 100,
  periodStart: new Date().toISOString().split('T')[0],
  periodEnd: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
  onboardingDone: false,
  wakeTime: '08:00',
  sleepTime: '23:00',
  classTimes: [],
  notifications: {
    studyProgress: true,
    streakRisk: true,
    weeklyReview: true,
    longBreak: true,
    examDay: true,
  },
  sidebarCompact: false,
}

const LS_KEY = 'user-settings'
const isElectron = typeof window !== 'undefined' && window.electronAPI

function lsGet() { try { return JSON.parse(localStorage.getItem(LS_KEY)) } catch { return null } }
function lsSet(v) { localStorage.setItem(LS_KEY, JSON.stringify(v)) }

function normalizeSettings(raw) {
  const next = { ...DEFAULT_SETTINGS, ...(raw || {}) }
  next.subjects = Array.isArray(raw?.subjects) ? raw.subjects : DEFAULT_SETTINGS.subjects
  next.classTimes = Array.isArray(raw?.classTimes) ? raw.classTimes : DEFAULT_SETTINGS.classTimes
  next.schedule = {
    0: Array.isArray(raw?.schedule?.[0]) ? raw.schedule[0] : [],
    1: Array.isArray(raw?.schedule?.[1]) ? raw.schedule[1] : [],
    2: Array.isArray(raw?.schedule?.[2]) ? raw.schedule[2] : [],
    3: Array.isArray(raw?.schedule?.[3]) ? raw.schedule[3] : [],
    4: Array.isArray(raw?.schedule?.[4]) ? raw.schedule[4] : [],
    5: Array.isArray(raw?.schedule?.[5]) ? raw.schedule[5] : [],
    6: Array.isArray(raw?.schedule?.[6]) ? raw.schedule[6] : [],
  }
  next.notifications = {
    ...DEFAULT_SETTINGS.notifications,
    ...(raw?.notifications || {}),
  }
  return next
}

export function useUserSettings() {
  const [settings, setSettingsState] = useState(null)
  const [loading, setLoading]        = useState(true)

  useEffect(() => {
    async function load() {
      // 1. Try Electron file system first (persists across builds)
      if (isElectron) {
        try {
          const fromDisk = await window.electronAPI.loadSettings()
          if (fromDisk) {
            const normalized = normalizeSettings(fromDisk)
            setSettingsState(normalized)
            lsSet(normalized) // sync to localStorage too
            setLoading(false)
            return
          }
        } catch {}
      }

      // 2. Try localStorage
      const cached = lsGet()
      if (cached) {
        const normalized = normalizeSettings(cached)
        setSettingsState(normalized)
        // Save to disk if in Electron
        if (isElectron) {
          try { await window.electronAPI.saveSettings(normalized) } catch {}
        }
        setLoading(false)
        return
      }

      // 3. First time — use defaults, onboarding will collect info
      applySettings(DEFAULT_SETTINGS)

      async function applySettings(s) {
        lsSet(s)
        if (isElectron) {
          try { await window.electronAPI.saveSettings(s) } catch {}
        }
        setSettingsState(s)
        setLoading(false)
      }
    }

    load()
  }, [])

  const setSettings = async (updater) => {
    setSettingsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      const normalized = normalizeSettings(next)
      lsSet(normalized)
      if (isElectron) {
        window.electronAPI.saveSettings(normalized).catch(() => {})
      }
      return normalized
    })
  }

  return { settings, setSettings, loading }
}
