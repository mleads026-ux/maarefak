'use client'

import {createContext,useContext,useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {createClient} from '@/lib/supabase/client'
import type {ChatCallRow,ChatGiftItem} from '@/lib/chat-room'
import type {CallFeedMessage,CallPartner} from '@/lib/call-session'
import {
  CALL_FEED_SELECT,
  callGiftError,
  callRequestError,
  callResponseError,
  getCallLabel,
  isCallValueEvent,
  isTerminalCallStatus,
  terminalCallNotice,
  upsertCallFeedMessage,
} from '@/lib/call-session'
import {
  endConversationCall,
  fetchConversationPartnerIdentity,
  insertChatTextMessage,
  requestConversationCall,
  respondConversationCall,
  sendConversationGift,
} from '@/lib/chat-room-actions'
import {useChatWebRtc} from '@/hooks/use-chat-webrtc'
import {CallSessionOverlay} from '@/components/call-session-overlay'

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
  const [partner,setPartner]=useState<CallPartner|null>(null)
  const [minimized,setMinimized]=useState(false)
  const [chatOpen,setChatOpen]=useState(false)
  const [controlsLocked,setControlsLocked]=useState(false)
  const [callMessages,setCallMessages]=useState<CallFeedMessage[]>([])
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

  function resetTransientUi(){
    setMinimized(false)
    setChatOpen(false)
    setControlsLocked(false)
    setGiftPicker(false)
  }

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

    if(isTerminalCallStatus(row.status)){
      cleanupPeer()
      setIncomingCall(current=>current?.id===row.id?null:current)
      setActiveCall(current=>current?.id===row.id?null:current)
      resetTransientUi()
      setNotice(terminalCallNotice(row.status))
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
      await s.rpc('expire_my_stale_voice_calls')

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

      const handle=(payload:any)=>applyCallRow(payload.new as ChatCallRow,uid)
      channel=s
        .channel(`global-call-${uid}`)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'voice_call_sessions',filter:`caller_id=eq.${uid}`},handle)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'voice_call_sessions',filter:`callee_id=eq.${uid}`},handle)
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'voice_call_sessions',filter:`caller_id=eq.${uid}`},handle)
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'voice_call_sessions',filter:`callee_id=eq.${uid}`},handle)
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
        s.from('gift_catalog')
          .select('id,name_ar,emoji,price_stars,animation_tier')
          .eq('active',true)
          .order('price_stars'),
      ])
      if(disposed)return
      setPartner((identity||null) as CallPartner|null)
      setGifts((catalog||[]) as ChatGiftItem[])
    })()

    return()=>{disposed=true}
  },[currentConversationId,s])

  useEffect(()=>{
    const conversationId=activeCall?.conversation_id
    if(!conversationId||!uid){
      setCallMessages([])
      return
    }

    let channel:any=null
    let disposed=false

    function receive(row:CallFeedMessage){
      setCallMessages(current=>upsertCallFeedMessage(current,row))
      if(isCallValueEvent(row,uid)){
        setGiftToast(row.body||'وصلك شيء جديد')
        window.setTimeout(()=>setGiftToast(''),4200)
      }
    }

    void (async()=>{
      const {data}=await s
        .from('messages')
        .select(CALL_FEED_SELECT)
        .eq('conversation_id',conversationId)
        .order('created_at',{ascending:false})
        .limit(30)
      if(!disposed)setCallMessages(((data||[]) as CallFeedMessage[]).reverse())

      channel=s
        .channel(`call-feed-${conversationId}-${uid}`)
        .on('postgres_changes',{
          event:'INSERT',
          schema:'public',
          table:'messages',
          filter:`conversation_id=eq.${conversationId}`,
        },(payload:any)=>receive(payload.new as CallFeedMessage))
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
      setNotice(callRequestError(kind,error?.message))
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

    const {row,error}=await respondConversationCall(s,incomingCall.id,accept)
    if(error){
      setNotice(callResponseError(error.message))
      if(error.message?.includes('user_already_in_call')||error.message?.includes('call_not_available')){
        setIncomingCall(null)
      }
      return
    }

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
    resetTransientUi()
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

    if(row){
      setCallMessages(current=>upsertCallFeedMessage(current,row as CallFeedMessage))
    }
  }

  async function sendCallGift(gift:ChatGiftItem){
    if(!activeCall?.conversation_id||!partner?.user_id)return

    const {error}=await sendConversationGift(
      s,
      activeCall.conversation_id,
      partner.user_id,
      gift,
    )
    if(error){
      setNotice(callGiftError(error.message))
      return
    }

    setGiftPicker(false)
    setNotice(`تم إرسال ${gift.emoji} ${gift.name_ar}.`)
    window.dispatchEvent(new Event('lammetna:wallet-change'))
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

  const callLabel=getCallLabel(activeCall,incomingCall)
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
    <CallSessionOverlay
      uid={uid}
      activeCall={activeCall}
      incomingCall={incomingCall}
      partner={partner}
      minimized={minimized}
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
      remoteAudioRef={remoteAudioRef}
      bindLocalVideo={bindLocalVideo}
      bindRemoteVideo={bindRemoteVideo}
      onAccept={()=>void respondToCall(true)}
      onReject={()=>void respondToCall(false)}
      onRestore={restoreCall}
      onDismissNotice={()=>setNotice('')}
      onToggleChat={()=>setChatOpen(value=>!value)}
      onOpenGifts={()=>setGiftPicker(true)}
      onCloseGifts={()=>setGiftPicker(false)}
      onBodyChange={setBody}
      onSendMessage={()=>void sendCallMessage()}
      onSendGift={gift=>void sendCallGift(gift)}
      onToggleMic={toggleMic}
      onSwitchCamera={()=>void switchCamera()}
      onChooseAudioOutput={()=>void chooseAudioOutput()}
      onMinimize={()=>setMinimized(true)}
      onLockControls={()=>setControlsLocked(true)}
      onUnlockControls={()=>setControlsLocked(false)}
      onGoToChat={goToChat}
      onEndCall={()=>void endCall()}
    />
  </CallSessionContext.Provider>
}
