'use client'

import {useEffect,useMemo} from 'react'
import {useRouter} from 'next/navigation'
import {createClient} from '@/lib/supabase/client'

export function WalletSync(){
  const s=useMemo(()=>createClient(),[])
  const router=useRouter()

  useEffect(()=>{
    let channel:any=null
    let disposed=false

    void (async()=>{
      const {data:{user}}=await s.auth.getUser()
      if(!user||disposed)return

      const refresh=()=>{
        window.dispatchEvent(new Event('lammetna:wallet-change'))
        router.refresh()
      }

      channel=s
        .channel(`wallet-sync-${user.id}`)
        .on('postgres_changes',{
          event:'*',schema:'public',table:'star_wallets',filter:`user_id=eq.${user.id}`,
        },refresh)
        .on('postgres_changes',{
          event:'*',schema:'public',table:'earning_wallets',filter:`user_id=eq.${user.id}`,
        },refresh)
        .subscribe()
    })()

    return()=>{
      disposed=true
      if(channel)s.removeChannel(channel)
    }
  },[router,s])

  return null
}
