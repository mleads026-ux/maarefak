'use client'

import {Copy,Star,X} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import type {ChatGiftItem} from '@/lib/chat-room'

type PartnerSheetProps={
  open:boolean
  partner:any
  copiedId:boolean
  transferStars:string
  transferGross:number
  transferFee:number
  transferNet:number
  onClose:()=>void
  onCopy:()=>void
  onChangeTransfer:(value:string)=>void
  onSendStars:()=>void
}

export function ChatPartnerSheet({
  open,partner,copiedId,transferStars,transferGross,transferFee,transferNet,
  onClose,onCopy,onChangeTransfer,onSendStars,
}:PartnerSheetProps){
  if(!open)return null

  return <div className="fixed inset-0 z-[125] flex items-end bg-black/45" onClick={onClose}>
    <section onClick={e=>e.stopPropagation()} className="mx-auto w-full max-w-[432px] rounded-t-[32px] bg-white p-4 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative h-14 w-14 overflow-hidden rounded-full bg-[#eaf3fb]">
            {partner?.avatar_url?<img src={partner.avatar_url} alt="" className="h-full w-full object-cover"/>:<span className="grid h-full w-full place-items-center text-lg font-black text-[#1768f4]">{(partner?.display_name||'م')[0]}</span>}
            <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-full ring-2 ring-white ${partner?.is_online?'bg-[#12d79d]':'bg-slate-400'}`}/>
          </span>
          <div><p className="text-lg font-black">{partner?.display_name||'المستخدم'}</p><p className={`text-[11px] font-black ${partner?.is_online?'text-[#159a70]':'text-[#7d8798]'}`}>{partner?.is_online?'متصل':'غير متصل'}</p></div>
        </div>
        <button onClick={onClose} className="tap-action grid h-9 w-9 place-items-center rounded-full bg-[#eef3f8]"><X size={18}/></button>
      </div>

      <div className="mt-4 rounded-[20px] bg-[#f3f7fc] p-3">
        <p className="text-[10px] font-black text-[#76839a]">User ID</p>
        <div className="mt-1 flex items-center gap-2" dir="ltr">
          <b className="min-w-0 flex-1 truncate text-left tracking-wider">{partner?.public_user_id||'—'}</b>
          <button onClick={onCopy} className="tap-action grid h-9 w-9 place-items-center rounded-xl bg-white text-[#1768f4] ring-1 ring-[#dce7f4]">{copiedId?'✓':<Copy size={16}/>}</button>
        </div>
      </div>

      <div className="mt-3 rounded-[20px] border border-[#dce7f4] p-3">
        <div className="flex items-center gap-2"><Star size={18} fill="#ffc21d" className="text-[#ffc21d]"/><p className="font-black">إرسال نجوم</p></div>
        <Input className="mt-2" type="number" min="1" inputMode="numeric" value={transferStars} onChange={e=>onChangeTransfer(e.target.value)} placeholder="عدد النجوم"/>
        {transferGross>0?<div className="mt-2 grid grid-cols-2 gap-2 text-center text-[10px] font-black">
          <div className="rounded-xl bg-[#fff7e9] p-2"><p className="text-[#7e6848]">عمولة التطبيق 15%</p><p>{transferFee.toLocaleString()} ⭐</p></div>
          <div className="rounded-xl bg-[#eafaf4] p-2"><p className="text-[#55776d]">يصل للمستلم</p><p>{transferNet.toLocaleString()} ⭐</p></div>
        </div>:null}
        <Button className="mt-2 w-full" onClick={onSendStars} disabled={!partner?.public_user_id||transferGross<1}>إرسال النجوم ⭐</Button>
      </div>
    </section>
  </div>
}

type GiftSheetProps={
  open:boolean
  gifts:ChatGiftItem[]
  onClose:()=>void
  onSend:(gift:ChatGiftItem)=>void
}

export function ChatGiftSheet({open,gifts,onClose,onSend}:GiftSheetProps){
  if(!open)return null

  return <div className="fixed inset-0 z-[130] flex items-end bg-black/45" onClick={onClose}>
    <section onClick={e=>e.stopPropagation()} className="mx-auto max-h-[72dvh] w-full max-w-[432px] overflow-hidden rounded-t-[32px] bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#e1eaf4] px-4 py-3">
        <div><p className="text-base font-black">اختر هدية 🎁</p><p className="mt-0.5 text-[10px] font-bold text-[#77849a]">التطبيق 15% · المستلم 85%</p></div>
        <button onClick={onClose} className="tap-action grid h-9 w-9 place-items-center rounded-full bg-[#eef3f8]"><X size={18}/></button>
      </div>
      <div className="hide-scrollbar grid max-h-[60dvh] grid-cols-3 gap-2 overflow-y-auto p-3 pb-[max(24px,env(safe-area-inset-bottom))]">
        {gifts.map(gift=><button key={gift.id} onClick={()=>onSend(gift)} className={`tap-action gift-card-tier gift-${gift.animation_tier||'basic'} rounded-[20px] p-3 text-center`}>
          <div className="gift-emoji text-3xl">{gift.emoji}</div>
          <p className="mt-1 truncate text-[10px] font-black">{gift.name_ar}</p>
          <p className="text-[10px] font-black text-[#a06a00]">{gift.price_stars.toLocaleString()} ⭐</p>
        </button>)}
      </div>
    </section>
  </div>
}
