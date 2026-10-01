import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseUrl, supabasePublishableKey } from './config'

type CookieItem = {
  name: string
  value: string
  options?: any
}

export async function createClient() {
  const store = await cookies()

  return createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return store.getAll()
        },

        setAll(items: CookieItem[]) {
          try {
            items.forEach(({ name, value, options }) =>
              store.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}