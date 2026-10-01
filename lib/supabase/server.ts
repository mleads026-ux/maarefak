import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseUrl, supabasePublishableKey } from './config'
export async function createClient(){
  const store=await cookies()
  return createServerClient(supabaseUrl,supabasePublishableKey,{cookies:{getAll(){return store.getAll()},setAll(items){try{items.forEach(({name,value,options})=>store.set(name,value,options))}catch{}}}})
}