'use client'

import {useEffect,useRef} from 'react'
import {Gift,Star} from 'lucide-react'

type Props={
  messages:any[]
  uid:string
  revealedImages:Set<string>
  onRevealImage:(messageId:string)=>void
  onHideImage:(messageId:string)=>void
}

export function ChatMessageList({
  messages,uid,revealedImages,onRevealImage,onHideImage,
}:Props){
  const endRef=useRef<HTMLDivElement|null>(null)
  const lastMessageId=messages[messages.length-1]?.id

  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{
      endRef.current?.scrollIntoView({behavior:'smooth',block:'end'})
    })
    return()=>cancelAnimationFrame(frame)
  },[lastMessageId])

  return <div className="flex-1 space-y-2 pb-4">
    {messages.map((m:any)=>(
      <div
        key={m.id}
        className={
          m.message_type==='gift'
            ? 'mx-auto max-w-[92%] rounded-3xl bg-[linear-gradient(135deg,#fff0a8,#fff8df)] px-4 py-3 text-[#6f4c00] shadow-sm ring-1 ring-[#efd36f]'
            : m.message_type==='star_transfer'
              ? 'mx-auto max-w-[92%] rounded-3xl bg-[linear-gradient(135deg,#e7f5ff,#eef0ff)] px-4 py-3 text-[#164a91] shadow-sm ring-1 ring-[#bfd5f5]'
              : m.sender_id===uid
                ? 'mr-auto max-w-[82%] rounded-3xl rounded-br-lg bg-[#1560BD] px-4 py-3 text-white'
                : 'ml-auto max-w-[82%] rounded-3xl rounded-bl-lg bg-white px-4 py-3 shadow-sm'
        }
      >
        {m.message_type==='image'?(
          m.signedUrl?(
            m.sender_id===uid||revealedImages.has(m.id)?(
              <div className="space-y-2">
                <img
                  src={m.signedUrl}
                  alt="صورة داخل المحادثة"
                  className="max-h-80 w-full rounded-2xl object-cover"
                />
                {m.sender_id!==uid?(
                  <button
                    type="button"
                    onClick={()=>onHideImage(m.id)}
                    className="text-xs font-bold underline underline-offset-4"
                  >
                    إخفاء الصورة
                  </button>
                ):null}
              </div>
            ):(
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src={m.signedUrl}
                  alt="صورة مموهة"
                  className="max-h-80 w-full scale-110 rounded-2xl object-cover blur-2xl"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/30 p-4 text-center text-white">
                  <p className="text-sm font-extrabold">صورة مخفية</p>
                  <p className="mt-1 text-xs text-white/90">اختَر بنفسك إذا كنت تريد رؤية الصورة.</p>
                  <button
                    type="button"
                    onClick={()=>onRevealImage(m.id)}
                    className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-slate-900"
                  >
                    إظهار الصورة
                  </button>
                </div>
              </div>
            )
          ):(
            <p className="text-sm">تعذر تحميل الصورة.</p>
          )
        ):m.message_type==='video'?(
          m.signedUrl?(
            <video src={m.signedUrl} controls playsInline preload="metadata" className="max-h-80 w-full rounded-2xl bg-black object-contain"/>
          ):(
            <p className="text-sm">تعذر تحميل الفيديو.</p>
          )
        ):m.message_type==='gift'?(
          <div className="text-center"><Gift className="mx-auto mb-1 text-[#b77900]" size={22}/><p className="text-sm font-black leading-6">{m.body}</p></div>
        ):m.message_type==='star_transfer'?(
          <div className="text-center"><Star className="mx-auto mb-1 text-[#1560BD]" size={22} fill="currentColor"/><p className="text-sm font-black leading-6">{m.body}</p></div>
        ):(
          <p className="text-sm leading-6">{m.body}</p>
        )}

        <p className={m.sender_id===uid&&m.message_type==='text'?'mt-1 text-[10px] text-[#D7E7FB]':'mt-1 text-[10px] text-slate-400'}>
          {new Date(m.created_at).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}
        </p>
      </div>
    ))}
    <div ref={endRef} aria-hidden="true" className="h-1"/>
  </div>
}
