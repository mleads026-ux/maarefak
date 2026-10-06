'use client'

import {useEffect,useRef,type RefObject} from 'react'
import {
  Camera,Gift,Lock,MessageCircle,Mic,MicOff,Minimize2,
  Phone,PhoneOff,Send,Unlock,Video,Volume2,X,
} from 'lucide-react'
import type {ChatCallRow,ChatGiftItem} from '@/lib/chat-room'
import type {CallFeedMessage,CallPartner} from '@/lib/call-session'

type Props={
  uid:string
  activeCall:ChatCallRow|null
  incomingCall:ChatCallRow|null
  partner:CallPartner|null
  minimized:boolean
  callLabel:string
  notice:string
  giftToast:string
  chatOpen:boolean
  giftPicker:boolean
  controlsLocked:boolean
  callMessages:CallFeedMessage[]
  body:string
  gifts:ChatGiftItem[]
  micMuted:boolean
  remoteAudioRef:RefObject<HTMLAudioElement|null>
  bindLocalVideo:(element:HTMLVideoElement|null)=>void
  bindRemoteVideo:(element:HTMLVideoElement|null)=>void
  onAccept:()=>void
  onReject:()=>void
  onRestore:()=>void
  onDismissNotice:()=>void
  onToggleChat:()=>void
  onOpenGifts:()=>void
  onCloseGifts:()=>void
  onBodyChange:(value:string)=>void
  onSendMessage:()=>void
  onSendGift:(gift:ChatGiftItem)=>void
  onToggleMic:()=>void
  onSwitchCamera:()=>void
  onChooseAudioOutput:()=>void
  onMinimize:()=>void
  onLockControls:()=>void
  onUnlockControls:()=>void
  onGoToChat:()=>void
  onEndCall:()=>void
}

export function CallSessionOverlay(props:Props){
  const {
    uid,activeCall,incomingCall,partner,minimized,callLabel,notice,giftToast,
    chatOpen,giftPicker,controlsLocked,callMessages,body,gifts,micMuted,
    remoteAudioRef,bindLocalVideo,bindRemoteVideo,onAccept,onReject,onRestore,
    onDismissNotice,onToggleChat,onOpenGifts,onCloseGifts,onBodyChange,onSendMessage,
    onSendGift,onToggleMic,onSwitchCamera,onChooseAudioOutput,onMinimize,
    onLockControls,onUnlockControls,onGoToChat,onEndCall,
  }=props

  return <>
    <audio ref={remoteAudioRef} autoPlay className="hidden"/>

    {incomingCall&&!activeCall?<IncomingCall
      call={incomingCall}
      partner={partner}
      onAccept={onAccept}
      onReject={onReject}
    />:null}

    {activeCall&&minimized?<button
      onClick={onRestore}
      className="tap-action fixed left-3 top-[max(14px,env(safe-area-inset-top))] z-[175] flex max-w-[240px] items-center gap-2 rounded-full bg-[#102344]/95 px-3 py-2.5 text-white shadow-2xl ring-1 ring-white/20 backdrop-blur-lg"
    >
      {activeCall.call_kind==='video'?<Video size={18}/>:<Phone size={18}/>}
      <span className="truncate text-xs font-black">
        {partner?.display_name||'المكالمة'} · {activeCall.status==='accepted'?'متصلة':'جارٍ الاتصال'}
      </span>
    </button>:null}

    {activeCall&&!minimized?<ActiveCallScreen
      uid={uid}
      call={activeCall}
      partner={partner}
      callLabel={callLabel}
      notice={notice}
      giftToast={giftToast}
      chatOpen={chatOpen}
      giftPicker={giftPicker}
      controlsLocked={controlsLocked}
      callMessages={callMessages}
      body={body}
      gifts={gifts}
      micMuted={micMuted}
      bindLocalVideo={bindLocalVideo}
      bindRemoteVideo={bindRemoteVideo}
      onDismissNotice={onDismissNotice}
      onToggleChat={onToggleChat}
      onOpenGifts={onOpenGifts}
      onCloseGifts={onCloseGifts}
      onBodyChange={onBodyChange}
      onSendMessage={onSendMessage}
      onSendGift={onSendGift}
      onToggleMic={onToggleMic}
      onSwitchCamera={onSwitchCamera}
      onChooseAudioOutput={onChooseAudioOutput}
      onMinimize={onMinimize}
      onLockControls={onLockControls}
      onUnlockControls={onUnlockControls}
      onGoToChat={onGoToChat}
      onEndCall={onEndCall}
    />:null}
  </>
}

function IncomingCall({call,partner,onAccept,onReject}:{
  call:ChatCallRow
  partner:CallPartner|null
  onAccept:()=>void
  onReject:()=>void
}){
  return <div className="fixed inset-0 z-[190] flex items-center justify-center bg-[#061427]/95 px-5 text-white backdrop-blur-xl">
    <div className="w-full max-w-[390px] text-center">
      <PartnerAvatar partner={partner} size="large"/>
      <p className="mt-5 text-2xl font-black">{partner?.display_name||'مستخدم لمتنا'}</p>
      <p className="mt-2 text-sm font-bold text-white/70">{call.call_kind==='video'?'مكالمة فيديو واردة':'مكالمة صوتية واردة'}</p>
      <div className="mt-8 grid grid-cols-2 gap-4">
        <button onClick={onAccept} className="tap-action flex h-16 items-center justify-center gap-2 rounded-full bg-[#20c58a] text-lg font-black"><Phone size={23}/> قبول</button>
        <button onClick={onReject} className="tap-action flex h-16 items-center justify-center gap-2 rounded-full bg-[#ed3f5e] text-lg font-black"><X size={23}/> رفض</button>
      </div>
    </div>
  </div>
}

function ActiveCallScreen(props:{
  uid:string
  call:ChatCallRow
  partner:CallPartner|null
  callLabel:string
  notice:string
  giftToast:string
  chatOpen:boolean
  giftPicker:boolean
  controlsLocked:boolean
  callMessages:CallFeedMessage[]
  body:string
  gifts:ChatGiftItem[]
  micMuted:boolean
  bindLocalVideo:(element:HTMLVideoElement|null)=>void
  bindRemoteVideo:(element:HTMLVideoElement|null)=>void
  onDismissNotice:()=>void
  onToggleChat:()=>void
  onOpenGifts:()=>void
  onCloseGifts:()=>void
  onBodyChange:(value:string)=>void
  onSendMessage:()=>void
  onSendGift:(gift:ChatGiftItem)=>void
  onToggleMic:()=>void
  onSwitchCamera:()=>void
  onChooseAudioOutput:()=>void
  onMinimize:()=>void
  onLockControls:()=>void
  onUnlockControls:()=>void
  onGoToChat:()=>void
  onEndCall:()=>void
}){
  const {
    uid,call,partner,callLabel,notice,giftToast,chatOpen,giftPicker,
    controlsLocked,callMessages,body,gifts,micMuted,bindLocalVideo,
    bindRemoteVideo,onDismissNotice,onToggleChat,onOpenGifts,onCloseGifts,
    onBodyChange,onSendMessage,onSendGift,onToggleMic,onSwitchCamera,
    onChooseAudioOutput,onMinimize,onLockControls,onUnlockControls,
    onGoToChat,onEndCall,
  }=props
  const videoConnected=call.call_kind==='video'&&call.status==='accepted'

  return <div className={`fixed inset-0 z-[180] overflow-hidden ${videoConnected?'bg-black':'bg-[radial-gradient(circle_at_top,#224b86,#071427_68%)]'} text-white`}>
    {videoConnected?<>
      <video ref={bindRemoteVideo} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover"/>
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/65"/>
      <video ref={bindLocalVideo} autoPlay playsInline muted className="absolute right-4 top-[max(24px,env(safe-area-inset-top))] h-40 w-28 rounded-[22px] border-2 border-white/70 bg-black object-cover shadow-2xl"/>
    </>:<div className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-44 text-center">
      <PartnerAvatar partner={partner} size="hero"/>
      <h2 className="mt-5 text-3xl font-black">{partner?.display_name||'مستخدم لمتنا'}</h2>
      <p className="mt-2 text-sm font-bold text-white/70">{callLabel}</p>
    </div>}

    {giftToast?<div className="absolute left-4 right-4 top-[max(86px,env(safe-area-inset-top))] z-20 rounded-[24px] bg-[linear-gradient(135deg,#fff3ae,#fff)] p-4 text-center text-sm font-black text-[#744d00] shadow-2xl ring-1 ring-[#f2d66e]">{giftToast}</div>:null}
    {notice?<button onClick={onDismissNotice} className="absolute left-4 right-4 top-[max(18px,env(safe-area-inset-top))] z-30 rounded-2xl bg-black/55 p-3 text-center text-xs font-bold text-white backdrop-blur-lg">{notice}</button>:null}

    {chatOpen?<CallChatPanel
      uid={uid}
      messages={callMessages}
      body={body}
      isVideo={call.call_kind==='video'}
      onBodyChange={onBodyChange}
      onSendMessage={onSendMessage}
      onOpenGifts={onOpenGifts}
    />:null}

    {giftPicker?<GiftPicker gifts={gifts} onClose={onCloseGifts} onSend={onSendGift}/>:null}

    {controlsLocked?<div className="absolute inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm">
      <button onClick={onUnlockControls} className="flex items-center gap-2 rounded-full bg-white px-6 py-4 font-black text-[#17233c]"><Unlock size={20}/> فتح التحكم</button>
    </div>:null}

    <div className="absolute inset-x-0 bottom-[max(22px,env(safe-area-inset-bottom))] z-30 px-4">
      <div className="mx-auto grid max-w-[420px] grid-cols-6 gap-2 rounded-[28px] bg-black/35 p-3 backdrop-blur-xl ring-1 ring-white/15">
        <CallButton label={micMuted?'تشغيل':'كتم'} onClick={onToggleMic}>{micMuted?<MicOff size={20}/>:<Mic size={20}/>}</CallButton>
        {call.call_kind==='video'
          ?<CallButton label="الكاميرا" onClick={onSwitchCamera}><Camera size={20}/></CallButton>
          :<CallButton label="السماعة" onClick={onChooseAudioOutput}><Volume2 size={20}/></CallButton>}
        <CallButton label="الشات" onClick={onToggleChat} active={chatOpen}><MessageCircle size={20}/></CallButton>
        <CallButton label="هدية" onClick={onOpenGifts}><Gift size={20}/></CallButton>
        <CallButton label="تصفح" onClick={onMinimize}><Minimize2 size={20}/></CallButton>
        <CallButton label="قفل" onClick={onLockControls}><Lock size={20}/></CallButton>
      </div>
      <div className="mx-auto mt-3 grid max-w-[420px] grid-cols-[1fr_auto_1fr] items-center gap-3">
        <button onClick={onGoToChat} className="tap-action h-12 rounded-full bg-white/15 px-4 text-xs font-black backdrop-blur-lg">الرجوع للشات</button>
        <button onClick={onEndCall} className="tap-action grid h-16 w-16 place-items-center rounded-full bg-[#ed3f5e] shadow-xl"><PhoneOff size={27}/></button>
        <button onClick={onMinimize} className="tap-action h-12 rounded-full bg-white/15 px-4 text-xs font-black backdrop-blur-lg">تصفح التطبيق</button>
      </div>
    </div>
  </div>
}

function CallChatPanel({uid,messages,body,isVideo,onBodyChange,onSendMessage,onOpenGifts}:{
  uid:string
  messages:CallFeedMessage[]
  body:string
  isVideo:boolean
  onBodyChange:(value:string)=>void
  onSendMessage:()=>void
  onOpenGifts:()=>void
}){
  const endRef=useRef<HTMLDivElement|null>(null)
  const latestMessageId=messages[messages.length-1]?.id

  useEffect(()=>{
    endRef.current?.scrollIntoView({behavior:'smooth',block:'end'})
  },[latestMessageId])

  return <div
    className="absolute left-3 right-3 z-20"
    style={{bottom:'calc(max(22px, env(safe-area-inset-bottom)) + 150px)'}}
  >
    <div className={`hide-scrollbar max-h-[34dvh] space-y-1.5 overflow-y-auto rounded-[22px] p-2 backdrop-blur-xl ${isVideo?'bg-black/30 ring-1 ring-white/15':'bg-black/12 ring-1 ring-white/10'}`}>
      {messages.slice(-12).map(message=><div key={message.id} className={`w-fit max-w-[86%] rounded-2xl px-3 py-2 text-xs font-bold ${message.message_type==='gift'||message.message_type==='star_transfer'?'mx-auto bg-amber-100/90 text-amber-950':message.sender_id===uid?'mr-auto bg-[#1560BD]/90 text-white':'ml-auto bg-white/90 text-[#17233c]'}`}>
        {message.body}
      </div>)}
      <div ref={endRef} className="h-px" aria-hidden="true"/>
    </div>

    <div className={`mt-2 flex items-center gap-2 rounded-full p-2 shadow-lg backdrop-blur-xl ${isVideo?'bg-black/45 ring-1 ring-white/20':'bg-white/14 ring-1 ring-white/15'}`} dir="rtl">
      <button onClick={onOpenGifts} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/90 text-[#a76500]"><Gift size={18}/></button>
      <input value={body} onChange={event=>onBodyChange(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')onSendMessage()}} placeholder="اكتب رسالة..." className="h-11 min-w-0 flex-1 rounded-full border border-white/25 bg-white/95 px-4 text-sm font-bold text-[#17233c] outline-none"/>
      <button onClick={onSendMessage} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1560BD] text-white"><Send size={18}/></button>
    </div>
  </div>
}

function GiftPicker({gifts,onClose,onSend}:{
  gifts:ChatGiftItem[]
  onClose:()=>void
  onSend:(gift:ChatGiftItem)=>void
}){
  return <div className="absolute inset-x-3 bottom-32 z-40 max-h-[52dvh] overflow-hidden rounded-[28px] bg-white text-[#17233c] shadow-2xl">
    <div className="flex items-center justify-between border-b border-slate-100 p-3">
      <div><p className="font-black">أرسل هدية 🎁</p><p className="text-[10px] font-bold text-slate-500">ستظهر للطرف الآخر فورًا داخل المكالمة والشات</p></div>
      <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><X size={17}/></button>
    </div>
    <div className="hide-scrollbar grid max-h-[42dvh] grid-cols-3 gap-2 overflow-y-auto p-3">
      {gifts.map(gift=><button key={gift.id} onClick={()=>onSend(gift)} className="tap-action rounded-[20px] bg-[#f6f9fd] p-3 text-center ring-1 ring-[#e3ebf5]">
        <div className="text-3xl">{gift.emoji}</div>
        <p className="mt-1 truncate text-[10px] font-black">{gift.name_ar}</p>
        <p className="text-[10px] font-black text-[#a06a00]">{gift.price_stars.toLocaleString()} ⭐</p>
      </button>)}
    </div>
  </div>
}

function PartnerAvatar({partner,size}:{partner:CallPartner|null;size:'large'|'hero'}){
  const className=size==='large'
    ?'mx-auto h-28 w-28 overflow-hidden rounded-full bg-white/10 ring-4 ring-white/20'
    :'h-36 w-36 overflow-hidden rounded-full bg-white/10 ring-4 ring-white/20 shadow-2xl'
  const textClass=size==='large'?'text-4xl':'text-5xl'

  return <div className={className}>
    {partner?.avatar_url
      ?<img src={partner.avatar_url} alt="" className="h-full w-full object-cover"/>
      :<div className={`grid h-full w-full place-items-center ${textClass} font-black`}>{(partner?.display_name||'ل')[0]}</div>}
  </div>
}


function CallButton({label,onClick,active,children}:{
  label:string
  onClick:()=>void
  active?:boolean
  children:React.ReactNode
}){
  return <button
    onClick={onClick}
    className={`tap-action flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1 py-2 text-[9px] font-black ${active?'bg-white text-[#17233c]':'bg-white/12 text-white'}`}
  >
    {children}
    <span className="truncate">{label}</span>
  </button>
}
