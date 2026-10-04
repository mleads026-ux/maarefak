'use client'

import {useEffect,useMemo} from 'react'
import {createClient} from '@/lib/supabase/client'

export function PresenceHeartbeat(){
  const s=useMemo(()=>createClient(),[])

  useEffect(()=>{
    let stopped=false

    async function setPresence(online:boolean){
      if(stopped)return
      await s.rpc('set_my_presence',{p_online:online}).catch(()=>{})
    }

    setPresence(true)

    const timer=window.setInterval(()=>{
      if(document.visibilityState==='visible')setPresence(true)
    },30000)

    const onVisibility=()=>{
      setPresence(document.visibilityState==='visible')
    }

    const onPageHide=()=>{
      s.rpc('set_my_presence',{p_online:false}).catch(()=>{})
    }

    document.addEventListener('visibilitychange',onVisibility)
    window.addEventListener('pagehide',onPageHide)

    return()=>{
      stopped=true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange',onVisibility)
      window.removeEventListener('pagehide',onPageHide)
      s.rpc('set_my_presence',{p_online:false}).catch(()=>{})
    }
  },[s])

  return null
}
