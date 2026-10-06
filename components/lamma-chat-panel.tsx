'use client'

import {Gift,Send} from 'lucide-react'
import {LammaMessageList} from '@/components/lamma-message-list'
import type {LammaMember} from '@/lib/lamma-room'
import {useLammaChatScroll} from '@/hooks/use-lamma-chat-scroll'

type Props={
  messages:any[]
  uid:string
  members:LammaMember[]
  body:string
  onSelectMember:(member:LammaMember)=>void
  onBodyChange:(value:string)=>void
  onSend:()=>void
  onOpenGifts:()=>void
}

export function LammaChatPanel({
  messages,uid,members,body,onSelectMember,onBodyChange,onSend,onOpenGifts,
}:Props){
  const {
    scrollRef,
    endRef,
    unreadFromId,
    onScroll,
  }=useLammaChatScroll(messages,uid)

  return <div className="pointer-events-none absolute inset-0 z-20">
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="pointer-events-auto absolute inset-x-2 bottom-[70px] top-[22%] flex flex-col overflow-y-auto overscroll-contain px-2 pb-1 pt-4"
      style={{
        WebkitMaskImage:'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.45) 10%, #000 24%, #000 100%)',
        maskImage:'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.45) 10%, #000 24%, #000 100%)',
      }}
    >
      <div className="mt-auto w-full">
        <LammaMessageList
          messages={messages}
          uid={uid}
          members={members}
          unreadFromId={unreadFromId}
          onSelectMember={onSelectMember}
        />
        <div ref={endRef} className="h-1" aria-hidden="true"/>
      </div>
    </div>

    <div className="pointer-events-auto absolute inset-x-2 bottom-1 rounded-[26px] bg-white/96 p-2 text-[#0b1734] shadow-[0_8px_28px_rgba(7,27,75,.25)] ring-1 ring-white/70 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenGifts}
          className="tap-action grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff2c8] text-[#a76500] ring-1 ring-[#efd892]"
          aria-label="إرسال هدية"
        ><Gift size={19}/></button>
        <input
          placeholder="اكتب رسالة في اللَمّة..."
          value={body}
          onChange={event=>onBodyChange(event.target.value)}
          onKeyDown={event=>{if(event.key==='Enter')onSend()}}
          className="h-11 min-w-0 flex-1 rounded-2xl border border-[#d7e1ec] bg-white px-4 text-sm font-bold text-[#12203d] outline-none placeholder:text-[#8a96a8]"
        />
        <button
          onClick={onSend}
          aria-label="إرسال"
          className="tap-action grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#1560BD] text-white shadow-sm"
        ><Send size={18}/></button>
      </div>
    </div>
  </div>
}
