'use client'
import {useState} from 'react'
import {Plus,Check} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
export function AddInterestButton({userId}:{userId:string}){
  const [on,setOn]=useState(false)
  const [busy,setBusy]=useState(false)
  return <button type="button" aria-pressed={on} disabled={busy} onClick={async(e)=>{
    e.preventDefault();e.stopPropagation();setBusy(true)
    const s=createClient();const {data,error}=await s.rpc('toggle_interest',{p_target:userId})
    if(!error)setOn(Boolean(data));setBusy(false)
  }} className="tap-action flex w-full items-center justify-center gap-1 rounded-[14px] bg-[#e9f4ff] py-2 text-[11px] font-black text-[#0e67f5]">
    {on?<Check size={15}/>:<Plus size={15}/>} {on?'تمت الإضافة':'إضافة'}
  </button>
}
