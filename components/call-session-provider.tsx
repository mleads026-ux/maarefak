'use client'

import {createContext,useContext,useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {
  Camera,Gift,Lock,MessageCircle,Mic,MicOff,Minimize2,
  Phone,PhoneOff,Send,Unlock,Video,Volume2,X
} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import type {ChatCallRow,ChatGiftItem} from '@/lib/chat-room'
import {
  endConversationCall,
  fetchConversationPartnerIdentity,
  insertChatTextMessage,
  requestConversationCall,
  respondConversationCall,
  sendConversationGift,
} from '@/lib/chat-room-actions'
import {useChatWebRtc} from '@/hooks/use-chat-webrtc'

type CallContextValue={
  activeCall:ChatCallRow|null
  incomingCall:ChatCallRow|null
  currentConversationId:string|null
  callLabel:string
  startCall:(conversationId:string,kind:'voice'|'video')=>Promise<boolean>
  endCall:()=>Promise<void>
  restoreCall:()=>void
}

const CallSessionContext=createContext<CallContextValue|null>(null)

export function useCallSession(){
  const value=useContext(CallSessionContext)
  if(!value)throw new Error('useCallSession must be used inside CallSessionProvider')
  return value
}

export function CallSessionProvider({children}:{children:React.ReactNode}){
  const s=useMemo(()=>createClient(),[])
  const router=useRouter()
  const [uid,setUid]=useState('')
  const [incomingCall,setIncomingCall]=useState<ChatCallRow|null>(null)
  const [activeCall,setActiveCall]=useState<ChatCallRow|null>(null)
  const [partner,setPartner]=useState<any>(null)
  const [minimized,setMinimized]=useState(false)
  const [chatOpen,setChatOpen]=useState(false)
  const [controlsLocked,setControlsLocked]=useState(false)
  const [callMessages,setCallMessages]=useState<any[]>([])
  const [body,setBody]=useState('')
  const [notice,setNotice]=useState('')
  const [giftToast,setGiftToast]=useState('')
  const [gifts,setGifts]=useState<ChatGiftItem[]>([])
  const [giftPicker,setGiftPicker]=useState(false)

  const {
    remoteAudioRef,
    bindLocalVideo,
    bindRemoteVideo,
    cleanupPeer,
    micMuted,
    toggleMic,
    switchCamera,
    chooseAudioOutput,
  }=useChatWebRtc({s,uid,activeCall,setNotice})

  useEffect(()=>{
    let alive=true
    void s.auth.getUser().then(({data:{user}}:any)=>{
      if(alive)setUid(user?.id||'')
    })
    const {data:{subscription}}=s.auth.onAuthStateChange((_event:any,session:any)=>{
      setUid(session?.user?.id||'')
    })
    return()=>{
      alive=false
      subscription.unsubscribe()
    }
  },[s])

  function applyCallRow(row:ChatCallRow,currentUid:string){
    if(!currentUid||!(row.caller_id===currentUid||row.callee_id===currentUid))return

    if(row.status==='ringing'){
      if(row.callee_id===currentUid){
        setIncomingCall(row)
      }else{
        setActiveCall(row)
        setIncomingCall(null)
        setMinimized(false)
      }
      return
    }

    if(row.status==='accepted'){
      setIncomingCall(null)
      setActiveCall(row)
      setMinimized(false)
      return
    }

    if(row.status==='rejected'||row.status==='ended'||row.status==='missed'){
      cleanupPeer()
      setIncomingCall(current=>current?.id===row.id?null:current)
      setActiveCall(current=>current?.id===row.id?null:current)
      setMinimized(false)
      setChatOpen(false)
      setControlsLocked(false)
      setGiftPicker(false)
      setNotice(row.status==='rejected'?'تم رفض المكالمة.':row.status==='missed'?'لم يتم الرد على المكالمة.':'انتهت المكالمة.')
    }
  }

  useEffect(()=>{
    if(!uid){
      setIncomingCall(null)
      setActiveCall(null)
      return
    }

    let disposed=false
    let channel:any=null

    void (async()=>{
      const {data:rows}=await s
        .from('voice_call_sessions')
        .select('*')
        .or(`caller_id.eq.${uid},callee_id.eq.${uid}`)
        .in('status',['ringing','accepted'])
        .order('created_at',{ascending:false})
        .limit(1)

      if(disposed)return
      const row=(rows||[])[0] as ChatCallRow|undefined
      if(row)applyCallRow(row,uid)

      channel=s
        .channel(`global-call-${uid}`)
        .on('postgres_changes',{
          event:'INSERT',schema:'public',table:'voice_call_sessions',
          filter:`caller_id=eq.${uid}`,
        },(payload:any)=>applyCallRow(payload.new as ChatCallRow,uid))
        .on('postgres_changes',{
          event:'INSERT',schema:'public',table:'voice_call_sessions',
          filter:`callee_id=eq.${uid}`,
        },(payload:any)=>applyCallRow(payload.new as ChatCallRow,uid))
        .on('postgres_changes',{
          event:'UPDATE',schema:'public',table:'voice_call_sessions',
          filter:`caller_id=eq.${uid}`,
        },(payload:any)=>applyCallRow(payload.new as ChatCallRow,uid))
        .on('postgres_changes',{
          event:'UPDATE',schema:'public',table:'voice_call_sessions',
          filter:`callee_id=eq.${uid}`,
        },(payload:any)=>applyCallRow(payload.new as ChatCallRow,uid))
        .subscribe()
    })()

    return()=>{
      disposed=true
      if(channel)s.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[s,uid])

  const focusCall=activeCall||incomingCall
  const currentConversationId=focusCall?.conversation_id||null

  useEffect(()=>{
    if(!currentConversationId){
      setPartner(null)
      setGifts([])
      return
    }
    let disposed=false
    void (async()=>{
      const [identity,{data:catalog}]=await Promise.all([
        fetchConversationPartnerIdentity(s,currentConversationId),
        s.from('gift_catalog').select('id,name_ar,emoji,price_stars,animation_tier').eq('active',true).order('price_stars'),
      ])
      if(disposed)return
      setPartner(identity||null)
      setGifts((catalog||[]) as ChatGiftItem[])
    })()
    return()=>{disposed=true}
  },[currentConversationId,s])

  useEffect(()=>{
    if(!activeCall?.conversation_id||!uid){
      setCallMessages([])
      return
    }

    const cid=activeCall.conversation_id
    let channel:any=null
    let disposed=false

    function receive(row:any){
      setCallMessages(current=>current.some(item=>item.id===row.id)?current:[...current,row].slice(-40))
      if(row.sender_id!==uid&&(row.message_type==='gift'||row.message_type==='star_transfer')){
        setGiftToast(row.body||'وصلك شيء جديد')
        window.setTimeout(()=>setGiftToast(''),4200)
      }
    }

    void (async()=>{
      const {data}=await s
        .from('messages')
        .select('id,body,created_at,sender_id,message_type,gift_id,gift_recipient_id,star_transfer_id')
        .eq('conversation_id',cid)
        .order('created_at',{ascending:false})
        .limit(30)
      if(!disposed)setCallMessages((data||[]).reverse())

      channel=s
        .channel(`call-feed-${cid}-${uid}`)
        .on('postgres_changes',{
          event:'INSERT',
          schema:'public',
          table:'messages',
          filter:`conversation_id=eq.${cid}`,
        },(payload:any)=>receive(payload.new))
        .subscribe()
    })()

    return()=>{
      disposed=true
      if(channel)s.removeChannel(channel)
    }
  },[activeCall?.conversation_id,s,uid])

  async function startCall(conversationId:string,kind:'voice'|'video'){
    setNotice('')
    const {error,row}=await requestConversationCall(s,conversationId,kind)
    if(error||!row){
      setNotice(kind==='video'?'تعذر بدء مكالمة الفيديو الآن.':'تعذر بدء المكالمة الصوتية الآن.')
      return false
    }
    setActiveCall(row)
    setIncomingCall(null)
    setMinimized(false)
    setChatOpen(false)
    return true
  }

  async function respondToCall(accept:boolean){
    if(!incomingCall)return
    const row=await respondConversationCall(s,incomingCall.id,accept)
    if(!accept){
      setIncomingCall(null)
      return
    }
    if(row){
      setIncomingCall(null)
      setActiveCall(row)
      setMinimized(false)
    }
  }

  async function endCall(){
    const row=activeCall||incomingCall
    if(!row)return
    await endConversationCall(s,row.id)
    cleanupPeer()
    setIncomingCall(null)
    setActiveCall(null)
    setMinimized(false)
    setChatOpen(false)
    setControlsLocked(false)
    setGiftPicker(false)
  }

  async function sendCallMessage(){
    const text=body.trim()
    if(!text||!activeCall?.conversation_id||!uid)return
    setBody('')
    const {data:row,error}=await insertChatTextMessage(s,activeCall.conversation_id,uid,text)
    if(error){
      setNotice('تعذر إرسال الرسالة الآن.')
      setBody(text)
      return
    }
    if(row)setCallMessages(current=>current.some(item=>item.id===row.id)?current:[...current,row].slice(-40))
  }

  async function sendCallGift(gift:ChatGiftItem){
    if(!activeCall?.conversation_id||!partner?.user_id)return
    const {error}=await sendConversationGift(s,activeCall.conversation_id,partner.user_id,gift)
    if(error){
      setNotice(error.message.includes('insufficient_stars')?'رصيد النجوم غير كافٍ لإرسال الهدية.':'تعذر إرسال الهدية.')
      return
    }
    setGiftPicker(false)
    setNotice(`تم إرسال ${gift.emoji} ${gift.name_ar}.`)
  }

  function goToChat(){
    if(!currentConversationId)return
    setMinimized(true)
    setChatOpen(false)
    router.push(`/chats/${currentConversationId}`)
  }

  function restoreCall(){
    setMinimized(false)
  }

  const callLabel=activeCall
    ?activeCall.status==='ringing'
      ?activeCall.call_kind==='video'?'جارٍ الاتصال بالفيديو...':'جارٍ الاتصال...'
      :activeCall.call_kind==='video'?'مكالمة فيديو متصلة':'مكالمة صوتية متصلة'
    :incomingCall
      ?incomingCall.call_kind==='video'?'مكالمة فيديو واردة':'مكالمة صوتية واردة'
      :''

  const value:CallContextValue={
    activeCall,
    incomingCall,
    currentConversationId,
    callLabel,
    startCall,
    endCall,
    restoreCall,
  }

  return <CallSessionContext.Provider value={value}>
    {children}
    <audio ref={remoteAudioRef} autoPlay className="hidden"/>

    {incomingCall&&!activeCall?<div className="fixed inset-0 z-[190] flex items-center justify-center bg-[#061427]/95 px-5 text-white backdrop-blur-xl">
      <div className="w-full max-w-[390px] text-center">
        <div className="mx-auto h-28 w-28 overflow-hidden rounded-full bg-white/10 ring-4 ring-white/20">
          {partner?.avatar_url?<img src={partner.avatar_url} alt="" className="h-full w-full object-cover"/>:<div className="grid h-full w-full place-items-center text-4xl font-black">{(partner?.display_name||'ل')[0]}</div>}
        </div>
        <p className="mt-5 text-2xl font-black">{partner?.display_name||'مستخدم لمتنا'}</p>
        <p className="mt-2 text-sm font-bold text-white/70">{incomingCall.call_kind==='video'?'مكالمة فيديو واردة':'مكالمة صوتية واردة'}</p>
        <div className="mt-8 grid grid-cols-2 gap-4">
          <button onClick={()=>void respondToCall(true)} className="tap-action flex h-16 items-center justify-center gap-2 rounded-full bg-[#20c58a] text-lg font-black"><Phone size={23}/> قبول</button>
          <button onClick={()=>void respondToCall(false)} className="tap-action flex h-16 items-center justify-center gap-2 rounded-full bg-[#ed3f5e] text-lg font-black"><X size={23}/> رفض</button>
        </div>
      </div>
    </div>:null}

    {activeCall&&minimized?<button onClick={restoreCall} className="tap-action fixed left-3 top-[max(14px,env(safe-area-inset-top))] z-[175] flex max-w-[240px] items-center gap-2 rounded-full bg-[#102344]/95 px-3 py-2.5 text-white shadow-2xl ring-1 ring-white/20 backdrop-blur-lg">
      {activeCall.call_kind==='video'?<Video size={18}/>:<Phone size={18}/>}<span className="truncate text-xs font-black">{partner?.display_name||'المكالمة'} · {activeCall.status==='accepted'?'متصلة':'جارٍ الاتصال'}</span>
    </button>:null}

    {activeCall&&!minimized?<div className={`fixed inset-0 z-[180] overflow-hidden ${activeCall.call_kind==='video'&&activeCall.status==='accepted'?'bg-black':'bg-[radial-gradient(circle_at_top,#224b86,#071427_68%)]'} text-white`}>
      {activeCall.call_kind==='video'&&activeCall.status==='accepted'?<>
        <video ref={bindRemoteVideo} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover"/>
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/65"/>
        <video ref={bindLocalVideo} autoPlay playsInline muted className="absolute right-4 top-[max(24px,env(safe-area-inset-top))] h-40 w-28 rounded-[22px] border-2 border-white/70 bg-black object-cover shadow-2xl"/>
      </>:<div className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-44 text-center">
        <div className="h-36 w-36 overflow-hidden rounded-full bg-white/10 ring-4 ring-white/20 shadow-2xl">
          {partner?.avatar_url?<img src={partner.avatar_url} alt="" className="h-full w-full object-cover"/>:<div className="grid h-full w-full place-items-center text-5xl font-black">{(partner?.display_name||'ل')[0]}</div>}
        </div>
        <h2 className="mt-5 text-3xl font-black">{partner?.display_name||'مستخدم لمتنا'}</h2>
        <p className="mt-2 text-sm font-bold text-white/70">{callLabel}</p>
      </div>}

      {giftToast?<div className="absolute left-4 right-4 top-[max(86px,env(safe-area-inset-top))] z-20 rounded-[24px] bg-[linear-gradient(135deg,#fff3ae,#fff)] p-4 text-center text-sm font-black text-[#744d00] shadow-2xl ring-1 ring-[#f2d66e]">{giftToast}</div>:null}

      {notice?<button onClick={()=>setNotice('')} className="absolute left-4 right-4 top-[max(18px,env(safe-area-inset-top))] z-30 rounded-2xl bg-black/55 p-3 text-center text-xs font-bold text-white backdrop-blur-lg">{notice}</button>:null}

      {chatOpen?<div className={`absolute bottom-32 left-3 right-3 z-20 rounded-[26px] p-3 backdrop-blur-xl ${activeCall.call_kind==='video'?'bg-black/42 ring-1 ring-white/20':'bg-white/10 ring-1 ring-white/15'}`}>
        <div className="hide-scrollbar max-h-[31dvh] space-y-1.5 overflow-y-auto pb-2">
          {callMessages.slice(-10).map(message=><div key={message.id} className={`max-w-[86%] rounded-2xl px-3 py-2 text-xs font-bold ${message.message_type==='gift'||message.message_type==='star_transfer'?'mx-auto bg-amber-100/90 text-amber-950':message.sender_id===uid?'mr-auto bg-[#1560BD]/90 text-white':'ml-auto bg-white/85 text-[#17233c]'}`}>
            {message.body}
          </div>)}
        </div>
        <div className="mt-2 flex items-center gap-2" dir="rtl">
          <button onClick={()=>setGiftPicker(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/90 text-[#a76500]"><Gift size={18}/></button>
          <input value={body} onChange={e=>setBody(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void sendCallMessage()}} placeholder="اكتب رسالة..." className="h-11 min-w-0 flex-1 rounded-full border border-white/25 bg-white/90 px-4 text-sm font-bold text-[#17233c] outline-none"/>
          <button onClick={()=>void sendCallMessage()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1560BD] text-white"><Send size={18}/></button>
        </div>
      </div>:null}

      {giftPicker?<div className="absolute inset-x-3 bottom-32 z-40 max-h-[52dvh] overflow-hidden rounded-[28px] bg-white text-[#17233c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-3"><div><p className="font-black">أرسل هدية 🎁</p><p className="text-[10px] font-bold text-slate-500">ستظهر للطرف الآخر فورًا داخل المكالمة والشات</p></div><button onClick={()=>setGiftPicker(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><X size={17}/></button></div>
        <div className="hide-scrollbar grid max-h-[42dvh] grid-cols-3 gap-2 overflow-y-auto p-3">
          {gifts.map(gift=><button key={gift.id} onClick={()=>void sendCallGift(gift)} className="tap-action rounded-[20px] bg-[#f6f9fd] p-3 text-center ring-1 ring-[#e3ebf5]"><div className="text-3xl">{gift.emoji}</div><p className="mt-1 truncate text-[10px] font-black">{gift.name_ar}</p><p className="text-[10px] font-black text-[#a06a00]">{gift.price_stars.toLocaleString()} ⭐</p></button>)}
        </div>
      </div>:null}

      {controlsLocked?<div className="absolute inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm"><button onClick={()=>setControlsLocked(false)} className="flex items-center gap-2 rounded-full bg-white px-6 py-4 font-black text-[#17233c]"><Unlock size={20}/> فتح التحكم</button></div>:null}

      <div className="absolute inset-x-0 bottom-[max(22px,env(safe-area-inset-bottom))] z-30 px-4">
        <div className="mx-auto grid max-w-[420px] grid-cols-6 gap-2 rounded-[28px] bg-black/35 p-3 backdrop-blur-xl ring-1 ring-white/15">
          <CallButton label={micMuted?'تشغيل':'كتم'} onClick={toggleMic}>{micMuted?<MicOff size={20}/>:<Mic size={20}/>}</CallButton>
          {activeCall.call_kind==='video'?<CallButton label="الكاميرا" onClick={()=>void switchCamera()}><Camera size={20}/></CallButton>:<CallButton label="السماعة" onClick={()=>void chooseAudioOutput()}><Volume2 size={20}/></CallButton>}
          <CallButton label="الشات" onClick={()=>setChatOpen(v=>!v)} active={chatOpen}><MessageCircle size={20}/></CallButton>
          <CallButton label="هدية" onClick={()=>setGiftPicker(true)}><Gift size={20}/></CallButton>
          <CallButton label="تصفح" onClick={()=>setMinimized(true)}><Minimize2 size={20}/></CallButton>
          <CallButton label="قفل" onClick={()=>setControlsLocked(true)}><Lock size={20}/></CallButton>
        </div>
        <div className="mx-auto mt-3 grid max-w-[420px] grid-cols-[1fr_auto_1fr] items-center gap-3">
          <button onClick={goToChat} className="tap-action h-12 rounded-full bg-white/15 px-4 text-xs font-black backdrop-blur-lg">الرجوع للشات</button>
          <button onClick={()=>void endCall()} className="tap-action grid h-16 w-16 place-items-center rounded-full bg-[#ed3f5e] shadow-xl"><PhoneOff size={27}/></button>
          <button onClick={()=>setMinimized(true)} className="tap-action h-12 rounded-full bg-white/15 px-4 text-xs font-black backdrop-blur-lg">تصفح التطبيق</button>
        </div>
      </div>
    </div>:null}
  </CallSessionContext.Provider>
}

function CallButton({label,onClick,active,children}:{
  label:string
  onClick:()=>void
  active?:boolean
  children:React.ReactNode
}){
  return <button onClick={onClick} className={`tap-action flex min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-1 py-2 text-[9px] font-black ${active?'bg-white text-[#17233c]':'bg-white/12 text-white'}`}>
    {children}<span className="truncate">{label}</span>
  </button>
}
