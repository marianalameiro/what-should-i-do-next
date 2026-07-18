import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Fail loudly at startup if env vars are missing rather than making silent
// requests with an undefined URL (which would expose a misconfiguration).
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  logger.api.error('init', new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check your .env file'))
}

const isElectron = typeof window !== 'undefined' && !!window.electronAPI
const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()
const isNative = isElectron || isCapacitor

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'app-auth',
    autoRefreshToken: true,
    flowType: 'pkce', // necessário para OAuth nativo (deep-link) no Electron/iOS
    detectSessionInUrl: !isNative, // web apanha o token no URL; nativo trata via deep-link
  }
})

// Log all auth state transitions so unusual patterns are visible in logs.
supabase.auth.onAuthStateChange((event, session) => {
  logger.auth.stateChange(event, session?.user?.id)
  if (event === 'SIGNED_IN') {
    logger.auth.sessionRestored(session?.user?.id)
  }
})