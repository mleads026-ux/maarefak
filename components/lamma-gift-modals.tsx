'use client'

import {Gift,X} from 'lucide-react'
import type {LammaGiftItem,LammaMember} from '@/lib/lamma-room'

type RecipientPickerProps={
  open:boolean
  members:LammaMember[]
  uid:string
  ownerId?:string|null
  onClose:()=>void
  onChoose:(member:LammaMember)=>void
}

export function LammaGiftRecipientPicker({
  open,members,uid,ownerId,onClose,onChoose
}:RecipientPickerProps){
  if(!open)return null
  const available=members.filter(member=>member.user_id!==uid)

  return <div className="fixed inset-0 z-[122] flex items-end bg-black/45" onClick={onClose}>
    <section onClick={e=>e.stopPropagation()} className="mx-auto max-h-[70dvh] w-full max-w-[432px] overflow-hidden rounded-t-[30px] bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#e1eaf4] px-4 py-3">
        <div><p className="text-base font-black">إرسال هدية 🎁</p><p className="mt-0.5 text-[10px] font-bold text-[#77849a]">اختار الشخص اللي هتبعت له الهدية</p></div>
        <button onClick={onClose} className="tap-action grid h-9 w-9 place-items-center rounded-full bg-[#eef3f8]"><X size={18}/></button>
      </div>
      <div className="hide-scrollbar max-h-[58dvh] space-y-2 overflow-y-auto p-3 pb-[max(24px,env(safe-area-inset-bottom))]">
        {available.map(member=><button
          key={member.user_id}
          onClick={()=>onChoose(member)}
          className="tap-action flex w-full items-center gap-3 rounded-[18px] bg-[#f5f8fc] p-3 text-right ring-1 ring-[#dfe8f2]"
        >
          <span className="ornate-silver-ring relative h-11 w-11 shrink-0 rounded-full p-[3px]">
            {member.profiles?.avatar_url?<img src={member.profiles.avatar_url} alt="" className="h-full w-full rounded-full object-cover"/>:<span className="grid h-full w-full place-items-center rounded-full bg-[#eaf3fb] font-black text-[#1768f4]">{(member.profiles?.display_name||'ض')[0]}</span>}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black">{member.profiles?.display_name||'ضيف'}</span>
            <span className="mt-0.5 block text-[9px] font-bold text-[#7b8798]">{member.user_id===ownerId?'Host اللَمّة':'ضيف في اللَمّة'}</span>
          </span>
          <Gift size={18} className="text-[#a76500]"/>
        </button>)}
        {!available.length?<p className="p-5 text-center text-sm font-bold text-[#7b8798]">مفيش ضيوف تانيين في اللَمّة حاليًا.</p>:null}
      </div>
    </section>
  </div>
}

type GiftPickerProps={
  open:boolean
  gifts:LammaGiftItem[]
  recipient:LammaMember|null
  mode:'profile'|'chat'
  hasSpotlight:boolean
  ownerId?:string|null
  isHost:boolean
  onClose:()=>void
  onSend:(gift:LammaGiftItem)=>void
}

export function LammaGiftPicker({
  open,gifts,recipient,mode,hasSpotlight,ownerId,isHost,onClose,onSend
}:GiftPickerProps){
  if(!open||!recipient)return null

  return <div className="fixed inset-0 z-[125] flex items-end bg-black/45" onClick={onClose}>
    <section onClick={e=>e.stopPropagation()} className="mx-auto max-h-[72dvh] w-full max-w-[432px] overflow-hidden rounded-t-[32px] bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#e1eaf4] px-4 py-3">
        <div>
          <p className="text-base font-black">اختر هدية 🎁</p>
          <p className="mt-0.5 text-[10px] font-bold text-[#77849a]">{mode==='chat'?'هدية الشات تذهب للـHost':`إرسال إلى ${recipient.profiles?.display_name||'الضيف'}`}</p>
        </div>
        <button onClick={onClose} className="tap-action grid h-9 w-9 place-items-center rounded-full bg-[#eef3f8]"><X size={18}/></button>
      </div>
      <div className="bg-[#f7faff] px-4 py-2 text-center text-[10px] font-black text-[#47607e]">
        {mode==='chat'
          ? hasSpotlight
            ? 'التوزيع: التطبيق 15% · Host 55% · كل متحدي 15%'
            : 'التوزيع: التطبيق 15% · Host 85%'
          : recipient.user_id===ownerId||isHost
            ? 'التوزيع: التطبيق 15% · المستلم 85%'
            : 'التوزيع داخل اللَمّة: التطبيق 15% · Host 5% · المستلم 80%'}
      </div>
      <div className="hide-scrollbar grid max-h-[58dvh] grid-cols-3 gap-2 overflow-y-auto p-3 pb-[max(24px,env(safe-area-inset-bottom))]">
        {gifts.map(gift=><button key={gift.id} onClick={()=>onSend(gift)} className={`tap-action gift-card-tier gift-${gift.animation_tier} rounded-[20px] p-3 text-center`}>
          <div className="gift-emoji text-3xl">{gift.emoji}</div>
          <p className="mt-1 truncate text-[10px] font-black">{gift.name_ar}</p>
          <p className="text-[10px] font-black text-[#a06a00]">{gift.price_stars.toLocaleString()} ⭐</p>
        </button>)}
      </div>
    </section>
  </div>
}

export function LammaGiftBurst({gift}:{gift:{emoji:string;name:string}|null}){
  if(!gift)return null
  return <div className="pointer-events-none fixed inset-0 z-[150] grid place-items-center">
    <div className="gift-burst-pop text-center"><div className="text-7xl">{gift.emoji}</div><p className="mt-2 rounded-full bg-black/55 px-4 py-2 text-sm font-black text-white">{gift.name}</p></div>
  </div>
}
