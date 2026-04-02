import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'app-auth',
    autoRefreshToken: true,
    detectSessionInUrl: !isElectron, // web needs this to catch OAuth token in redirect URL
  }
})