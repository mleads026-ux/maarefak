import { createBrowserClient } from '@supabase/ssr'
import { supabaseUrl, supabasePublishableKey } from './config'

export function createClient() {
  return createBrowserClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  )
}
