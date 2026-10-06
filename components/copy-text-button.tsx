'use client'
import {Copy,Check} from 'lucide-react'
import {useState} from 'react'

export function CopyTextButton({text}:{text:string}){
  const [done,setDone]=useState(false)
  return <button
    type="button"
    aria-label={done?'تم النسخ':'نسخ'}
    title={done?'تم النسخ':'نسخ'}
    onClick={async()=>{
      try{
        await navigator.clipboard.writeText(text)
        setDone(true)
        setTimeout(()=>setDone(false),1400)
      }catch{}
    }}
    className="tap-action grid h-9 w-9 place-items-center rounded-xl bg-[#eef4fb] text-[#24466f]"
  >
    {done?<Check size={17}/>:<Copy size={17}/>}
  </button>
}
