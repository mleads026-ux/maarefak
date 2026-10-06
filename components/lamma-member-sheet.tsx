'use client'

import {Gift,Star,X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import type {LammaMember} from '@/lib/lamma-room'

type Props={
  member:LammaMember|null
  privateContactPrice:number
  onClose:()=>void
  onContact:(member:LammaMember)=>void
  onGift:(member:LammaMember)=>void
}

export function LammaMemberSheet({
  member,privateContactPrice,onClose,onContact,onGift
}:Props){
  if(!member)return null

  return <div className="fixed inset-0 z-[110] flex items-end bg-black/45" onClick={onClose}>
    <section onClick={e=>e.stopPropagation()} className="mx-auto w-full max-w-[432px] rounded-t-[30px] bg-white p-4 pb-[max(24px,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="ornate-silver-ring rounded-full p-[4px]">{member.profiles?.avatar_url?<img src={member.profiles.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover"/>:<span className="grid h-12 w-12 place-items-center rounded-full bg-[#eaf3fb] font-black text-[#1768f4]">{(member.profiles?.display_name||'ض')[0]}</span>}</span>
          <div><p className="font-black">{member.profiles?.display_name||'ضيف'}</p><p className="text-[10px] font-bold text-[#7b879b]">{member.profiles?.mood||'ضيف في اللَمّة'}</p></div>
        </div>
        <button onClick={onClose} className="tap-action grid h-9 w-9 place-items-center rounded-full bg-[#eef3f8]"><X size={18}/></button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={()=>onContact(member)}><Star size={15}/> تواصل · {privateContactPrice} ⭐</Button>
        <Button variant="outline" onClick={()=>onGift(member)}><Gift size={15}/> هدية</Button>
      </div>
    </section>
  </div>
}
