'use client'

import type {PointerEvent,RefObject} from 'react'
import {Gift,MessageSquare,Send} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {LammaMessageList} from '@/components/lamma-message-list'
import type {LammaMember} from '@/lib/lamma-room'

type Props={
  chatExpanded:boolean
  messages:any[]
  uid:string
  members:LammaMember[]
  body:string
  messagesEndRef:RefObject<HTMLDivElement|null>
  onSelectMember:(member:LammaMember)=>void
  onBodyChange:(value:string)=>void
  onSend:()=>void
  onOpenGifts:()=>void
  onDragStart:(event:PointerEvent<HTMLDivElement>)=>void
  onDragMove:(event:PointerEvent<HTMLDivElement>)=>void
  onDragEnd:(event:PointerEvent<HTMLDivElement>)=>void
  onToggleExpanded:()=>void
}

export function LammaChatPanel({
  chatExpanded,messages,uid,members,body,messagesEndRef,
  onSelectMember,onBodyChange,onSend,onOpenGifts,
  onDragStart,onDragMove,onDragEnd,onToggleExpanded,
}:Props){
  return <div className="relative z-30 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px] border border-white/40 bg-[#f1f5fa]/95 text-[#0b1734] shadow-[0_-8px_30px_rgba(5,40,110,.12)] backdrop-blur transition-all duration-300">
    <div
      onPointerDown={onDragStart}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      className="touch-none cursor-ns-resize border-b border-[#ccd8e7] bg-[#f1f5fa] px-4 pb-3 pt-2"
    >
      <button
        type="button"
        aria-label={chatExpanded?'تصغير الشات':'تكبير الشات'}
        onClick={onToggleExpanded}
        className="tap-action mx-auto mb-2 block h-1.5 w-14 rounded-full bg-white shadow-[0_1px_4px_rgba(40,80,130,.32)]"
      />
      <div className="flex items-center justify-between">
        <div><p className="text-sm font-black">شات اللَمّة</p><p className="text-[9px] font-bold text-[#77849b]">كل رسالة باسم صاحبها</p></div>
        <span className="flex items-center gap-1 rounded-full bg-[#eaf4ff] px-3 py-1.5 text-[10px] font-black text-[#1768f4]"><MessageSquare size={13}/>{messages.length}</span>
      </div>
    </div>

    <LammaMessageList
      messages={messages}
      uid={uid}
      members={members}
      onSelectMember={onSelectMember}
      messagesEndRef={messagesEndRef}
    />

    <div className="flex gap-2 border-t border-[#cbd7e5] bg-[#f1f5fa] p-2">
      <button
        onClick={onOpenGifts}
        className="tap-action grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff2c8] text-[#a76500] shadow-sm ring-1 ring-[#efd892]"
        aria-label="إرسال هدية"
      ><Gift size={19}/></button>
      <Input
        placeholder="اكتب رسالة في اللَمّة..."
        value={body}
        onChange={e=>onBodyChange(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter')onSend()}}
        className="h-11 rounded-2xl border border-[#d7e1ec] bg-[#f1f5fa]"
      />
      <Button size="icon" onClick={onSend} className="h-11 w-11 shrink-0 rounded-2xl"><Send size={18}/></Button>
    </div>
  </div>
}
