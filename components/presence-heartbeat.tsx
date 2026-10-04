'use client'

import {useEffect,useMemo} from 'react'
import {createClient} from '@/lib/supabase/client'

export function PresenceHeartbeat(){
  const s=useMemo(()=>createClient(),[])

  useEffect(()=>{
    let stopped=false

    async function setPresence(online:boolean){
      if(stopped)return
      try{
        await s.rpc('set_my_presence',{p_online:online})
      }catch{}
    }

    async function forceOffline(){
      try{
        await s.rpc('set_my_presence',{p_online:false})
      }catch{}
    }

    setPresence(true)

    const timer=window.setInterval(()=>{
      if(document.visibilityState==='visible')setPresence(true)
    },30000)

    const onVisibility=()=>{
      setPresence(document.visibilityState==='visible')
    }

    const onPageHide=()=>{
      void forceOffline()
    }

    document.addEventListener('visibilitychange',onVisibility)
    window.addEventListener('pagehide',onPageHide)

    return()=>{
      stopped=true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange',onVisibility)
      window.removeEventListener('pagehide',onPageHide)
      void forceOffline()
    }
  },[s])

  return null
}
