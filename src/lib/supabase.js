import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const clientKey = '__arFinanceSupabaseClient'

export const supabase = globalThis[clientKey] || createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      storageKey: 'ar-finance-auth-token',
    },
  }
)

globalThis[clientKey] = supabase
