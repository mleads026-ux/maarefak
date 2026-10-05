'use client'

import type {RefObject} from 'react'
import type {LammaMember} from '@/lib/lamma-room'

type Props={
  messages:any[]
  uid:string
  members:LammaMember[]
  onSelectMember:(member:LammaMember)=>void
  messagesEndRef:RefObject<HTMLDivElement|null>
}

export function LammaMessageList({
  messages,uid,members,onSelectMember,messagesEndRef
}:Props){
  return <div className="hide-scrollbar flex-1 space-y-2 overflow-y-auto bg-[#f1f5fa] px-3 py-3">
    {messages.map((m:any)=>{
      const mine=m.sender_id===uid
      const profile=(m.profiles as any)
      return <div key={m.id} className={`flex items-end gap-2 ${mine?'justify-start':'justify-end'}`}>
        {!mine?<button onClick={()=>{
          const member=members.find(x=>x.user_id===m.sender_id)
          if(member)onSelectMember(member)
        }} className="tap-action h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#eaf3fb]">{profile?.avatar_url?<img src={profile.avatar_url} alt="" className="h-full w-full object-cover"/>:<span className="grid h-full w-full place-items-center text-[10px] font-black text-[#1768f4]">{(profile?.display_name||'ض')[0]}</span>}</button>:null}
        <div className={`min-w-0 max-w-[86%] rounded-[18px] px-3 py-2 ${m.message_type==='gift'?'bg-[linear-gradient(135deg,#fff0a8,#fff8df)] text-[#6f4c00] ring-1 ring-[#f0d169]':mine?'bg-[#1768f4] text-white':'bg-white text-[#12203d] ring-1 ring-[#dce6f2]'}`}>
          <p className="min-w-0 whitespace-pre-wrap break-words text-[12px] font-medium leading-5 [overflow-wrap:anywhere]">
            <span className={`font-black ${mine?'text-white':'text-[#1768f4]'}`}>{mine?'أنت':profile?.display_name||'ضيف'}: </span>
            <span>{m.body}</span>
          </p>
        </div>
      </div>
    })}
    {!messages.length?<div className="grid h-full min-h-28 place-items-center text-center text-xs font-bold text-[#8490a5]">ابدأوا الكلام 👋<br/>الرسائل هتظهر هنا مباشرة</div>:null}
    <div ref={messagesEndRef}/>
  </div>
}
