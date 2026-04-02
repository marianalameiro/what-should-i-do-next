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
}

const LS_KEY = 'user-settings'
const isElectron = typeof window !== 'undefined' && window.electronAPI

function lsGet() { try { return JSON.parse(localStorage.getItem(LS_KEY)) } catch { return null } }
function lsSet(v) { localStorage.setItem(LS_KEY, JSON.stringify(v)) }

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
            setSettingsState(fromDisk)
            lsSet(fromDisk) // sync to localStorage too
            setLoading(false)
            return
          }
        } catch {}
      }

      // 2. Try localStorage
      const cached = lsGet()
      if (cached) {
        setSettingsState(cached)
        // Save to disk if in Electron
        if (isElectron) {
          try { await window.electronAPI.saveSettings(cached) } catch {}
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
      lsSet(next)
      if (isElectron) {
        window.electronAPI.saveSettings(next).catch(() => {})
      }
      return next
    })
  }

  return { settings, setSettings, loading }
}