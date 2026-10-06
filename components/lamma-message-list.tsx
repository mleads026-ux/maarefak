'use client'

import type {LammaMember} from '@/lib/lamma-room'

type Props={
  messages:any[]
  uid:string
  members:LammaMember[]
  unreadFromId:string|null
  onSelectMember:(member:LammaMember)=>void
}

export function LammaMessageList({
  messages,uid,members,unreadFromId,onSelectMember,
}:Props){
  return <div className="space-y-2.5 text-right" dir="rtl">
    {messages.map((message:any)=>{
      const mine=message.sender_id===uid
      const profile=message.profiles as any
      const member=members.find(item=>item.user_id===message.sender_id)

      return <div key={message.id}>
        {message.id===unreadFromId?<div className="my-3 flex items-center gap-2" aria-label="رسائل غير مقروءة">
          <span className="h-px flex-1 bg-white/55"/>
          <span className="rounded-full bg-white/16 px-3 py-1 text-[10px] font-black text-white backdrop-blur">غير مقروء</span>
          <span className="h-px flex-1 bg-white/55"/>
        </div>:null}

        {message.message_type==='gift'
          ? <div className="ml-auto w-fit max-w-[90%] rounded-full bg-[#fff1a8]/92 px-3 py-1.5 text-right text-[11px] font-black text-[#704a00] shadow-sm">
              {message.body}
            </div>
          : <div className="flex items-start justify-end gap-2" dir="ltr">
              <p dir="rtl" className={`ml-auto w-fit min-w-0 max-w-[88%] whitespace-pre-wrap break-words text-right text-[12px] leading-5 [overflow-wrap:anywhere] ${mine?'text-white':'text-white/95'}`}>
                <button
                  type="button"
                  onClick={()=>!mine&&member&&onSelectMember(member)}
                  className={`font-black ${mine?'text-[#dff6ff]':'text-[#ffe78e]'}`}
                >
                  {mine?'أنت':profile?.display_name||'ضيف'}:
                </button>{' '}
                <span className="font-medium">{message.body}</span>
              </p>
              {!mine?<button
                onClick={()=>member&&onSelectMember(member)}
                className="tap-action mt-0.5 h-6 w-6 shrink-0 overflow-hidden rounded-full bg-white/18 ring-1 ring-white/30"
              >
                {profile?.avatar_url
                  ?<img src={profile.avatar_url} alt="" className="h-full w-full object-cover"/>
                  :<span className="grid h-full w-full place-items-center text-[9px] font-black text-white">{(profile?.display_name||'ض')[0]}</span>}
              </button>:null}
            </div>}
      </div>
    })}

    {!messages.length?<div className="grid min-h-28 place-items-center text-center text-xs font-bold text-white/65">
      ابدأوا الكلام 👋<br/>الرسائل هتظهر هنا مباشرة
    </div>:null}
  </div>
}
