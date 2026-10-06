'use client'

import {use,useEffect,useMemo,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {LammaRoomStage} from '@/components/lamma-room-stage'
import {LammaGiftBurst,LammaGiftPicker,LammaGiftRecipientPicker} from '@/components/lamma-gift-modals'
import {LammaChatPanel} from '@/components/lamma-chat-panel'
import {LammaMemberSheet} from '@/components/lamma-member-sheet'
import {LammaGuestDrawer} from '@/components/lamma-guest-drawer'
import {
  buildLammaGuestLayout,
  findLammaMember,
  type LammaGiftItem,
  type LammaMember,
  type LammaVoiceParticipant,
} from '@/lib/lamma-room'
import {fetchLammaMessages,fetchLammaRoomSnapshot} from '@/lib/lamma-room-data'
import {subscribeLammaRoomRealtime} from '@/lib/lamma-room-realtime'
import {useLammaWebRtc} from '@/hooks/use-lamma-webrtc'
import {useLammaVoiceControls} from '@/hooks/use-lamma-voice-controls'
import {
  assignLammaRoyal,
  controlLammaMember,
  createLammaTextMessage,
  requestLammaPrivateContact,
  requestLammaRoyalSeat,
  respondLammaRoyalSeat,
  sendLammaGift,
  setLammaPairSpotlight,
  type LammaRoyalAction,
} from '@/lib/lamma-actions'

export default function SpaceChat({params}:{params:Promise<{id:string}>}){
  const {id}=use(params)
  const s=useMemo(()=>createClient(),[])
  const r=useRouter()

  const [space,setSpace]=useState<any>(null)
  const [messages,setMessages]=useState<any[]>([])
  const [members,setMembers]=useState<LammaMember[]>([])
  const [voiceMembers,setVoiceMembers]=useState<LammaVoiceParticipant[]>([])
  const [gifts,setGifts]=useState<LammaGiftItem[]>([])
  const [privateContactPrice,setPrivateContactPrice]=useState(20)
  const [uid,setUid]=useState('')
  const [body,setBody]=useState('')
  const messageSyncBusyRef=useRef(false)
  const [selectedMember,setSelectedMember]=useState<LammaMember|null>(null)
  const [showGifts,setShowGifts]=useState(false)
  const [showGiftRecipients,setShowGiftRecipients]=useState(false)
  const [giftRecipient,setGiftRecipient]=useState<LammaMember|null>(null)
  const [giftMode,setGiftMode]=useState<'profile'|'chat'>('profile')
  const [giftBurst,setGiftBurst]=useState<{emoji:string;name:string}|null>(null)
  const [voiceRequestStatus,setVoiceRequestStatus]=useState<'none'|'pending'|'accepted'|'rejected'|'host'>('none')
  const [voiceRequests,setVoiceRequests]=useState<any[]>([])
  const [notice,setNotice]=useState('')
  const [inVoice,setInVoice]=useState(false)
  const [micEnabled,setMicEnabled]=useState(false)
  const [seats,setSeats]=useState<any[]>([])
  const [starRequests,setStarRequests]=useState<any[]>([])
  const [spotlight,setSpotlight]=useState<any>(null)
  const [isHost,setIsHost]=useState(false)
  const [voiceStreams,setVoiceStreams]=useState<MediaStream[]>([])
  const [showGuests,setShowGuests]=useState(false)
  const [challengePick,setChallengePick]=useState<string[]>([])
  const [micPick,setMicPick]=useState<string[]>([])
  const [royalBusy,setRoyalBusy]=useState(false)

  const localStreamRef=useRef<MediaStream|null>(null)

  const {
    refreshVoiceMembers,
    startVoiceRealtime,
    cleanupVoice,
  }=useLammaWebRtc({
    s,
    id,
    uid,
    localStreamRef,
    setVoiceMembers,
    setMicEnabled,
    setVoiceStreams,
    setNotice,
  })

  const {
    requestVoiceApproval,
    hostVoiceDecision,
    joinVoice,
    leaveVoice,
    toggleMic,
  }=useLammaVoiceControls({
    s,
    id,
    uid,
    isHost,
    inVoice,
    micEnabled,
    voiceRequestStatus,
    localStreamRef,
    setVoiceRequestStatus,
    setInVoice,
    setMicEnabled,
    setVoiceMembers,
    setVoiceStreams,
    setNotice,
    startVoiceRealtime,
    refreshVoiceMembers,
    cleanupVoice,
    onReload:load,
  })

  async function load(){
    const {data:{user}}=await s.auth.getUser()
    if(!user){r.push('/login');return}
    setUid(user.id)

    const {data:membership}=await s.from('space_members')
      .select('role').eq('space_id',id).eq('user_id',user.id).maybeSingle()
    if(!membership){r.push('/spaces');return}

    const snapshot=await fetchLammaRoomSnapshot(s,id,user.id)
    const voices=snapshot.voiceMembers
    setSpace(snapshot.space)
    setMessages(snapshot.messages)
    setMembers(snapshot.members)
    setVoiceMembers(voices)
    setGifts(snapshot.gifts)
    setSeats(snapshot.seats)
    setStarRequests(snapshot.starRequests)
    setSpotlight(snapshot.spotlight)
    setIsHost(snapshot.isHost)
    if(snapshot.privateContactPrice!=null)setPrivateContactPrice(snapshot.privateContactPrice)
    setVoiceRequestStatus(snapshot.voiceRequestStatus)
    setVoiceRequests(snapshot.voiceRequests)

    const ownVoice=voices.find(x=>x.user_id===user.id)
    setInVoice(Boolean(ownVoice))
    if(ownVoice){
      const allowed=Boolean(ownVoice.mic_enabled)
      setMicEnabled(allowed)
      localStreamRef.current?.getAudioTracks().forEach(track=>{track.enabled=allowed})
    }
  }

  async function refreshMessages(){
    if(messageSyncBusyRef.current)return
    messageSyncBusyRef.current=true
    try{
      const rows=await fetchLammaMessages(s,id)
      setMessages(rows)
    }catch{
      // Keep the current feed if a transient realtime refresh fails.
    }finally{
      messageSyncBusyRef.current=false
    }
  }

  useEffect(()=>{
    let cancelled=false
    let roomChannel:any=null

    const start=async()=>{
      const {data:{session}}=await s.auth.getSession()
      if(session?.access_token)await s.realtime.setAuth(session.access_token)
      await load()
      if(cancelled)return
      roomChannel=subscribeLammaRoomRealtime(s,id,refreshMessages,load)
    }

    void start()

    const {data:{subscription:authSubscription}}=s.auth.onAuthStateChange((_event,session)=>{
      if(session?.access_token)void s.realtime.setAuth(session.access_token)
    })

    const syncOnFocus=()=>{void refreshMessages()}
    window.addEventListener('focus',syncOnFocus)

    // Realtime is the primary path. This one-second visible-page sync is a
    // lightweight fallback for mobile browsers that occasionally miss a
    // Postgres Changes event while keeping the room open.
    const messagePoll=window.setInterval(()=>{
      if(document.visibilityState==='visible')void refreshMessages()
    },1000)

    return()=>{
      cancelled=true
      window.clearInterval(messagePoll)
      authSubscription.unsubscribe()
      window.removeEventListener('focus',syncOnFocus)
      if(roomChannel)s.removeChannel(roomChannel)
      cleanupVoice()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[id])


  const royalSeat=seats.find((x:any)=>x.seat_type==='star'&&x.user_id)
  const royalId=royalSeat?.user_id||null
  const isRoyal=Boolean(uid&&royalId===uid)

  const memberById=(userId?:string|null)=>findLammaMember(members,userId)
  const hostMember=memberById(space?.owner_id)
  const {
    royalMember,
    challengeA,
    challengeB,
    otherGuests,
    orderedGuests,
  }=buildLammaGuestLayout(
    members,
    royalId,
    spotlight?.user_a,
    spotlight?.user_b
  )

  async function send(){
    const text=body.trim()
    if(!text)return
    setBody('')
    const {data:row,error}=await createLammaTextMessage(s,id,uid,text)

    if(error){
      setNotice(error.message.includes('text_not_allowed')?'الشات مقفول عن حسابك حاليًا.':'تعذر إرسال الرسالة.')
      setBody(text)
      return
    }

    if(row){
      const me=memberById(uid)
      setMessages(current=>current.some((x:any)=>x.id===row.id)
        ? current
        : [...current,{...row,profiles:me?.profiles||{display_name:'أنت',avatar_url:null}}])
    }
  }


  async function requestPrivateContact(member:LammaMember){
    setNotice('')
    const {error}=await requestLammaPrivateContact(s,id,member)
    if(error){
      if(error.message.includes('insufficient_stars'))setNotice('رصيد النجوم غير كافٍ.')
      else if(error.message.includes('already_connected'))setNotice('أنتم بالفعل متصلون في كلامنا.')
      else setNotice('تعذر إرسال طلب التواصل.')
      return
    }
    setNotice(`تم خصم ${privateContactPrice} نجمة وإرسال طلب تواصل خاص.`)
    setSelectedMember(null)
  }

  function chooseGiftRecipient(member:LammaMember){
    setGiftRecipient(member)
    setGiftMode(member.user_id===space?.owner_id&&uid!==space?.owner_id?'chat':'profile')
    setShowGiftRecipients(false)
    setShowGifts(true)
  }

  async function sendGift(gift:LammaGiftItem){
    if(!giftRecipient)return
    const {error}=await sendLammaGift(s,id,gift,giftRecipient,giftMode)
    if(error){
      setNotice(
        error.message.includes('promotional_stars_not_transferable')
          ?'النجوم الترويجية لا تُستخدم في الهدايا التي تتحول إلى أرباح.'
          :error.message.includes('insufficient_stars')
            ?'رصيد النجوم غير كافٍ.'
            :'تعذر إرسال الهدية.'
      )
      return
    }
    setGiftBurst({emoji:gift.emoji,name:gift.name_ar})
    setTimeout(()=>setGiftBurst(null),1500)
    setNotice(`تم إرسال ${gift.emoji} ${gift.name_ar}.`)
    setShowGifts(false)
    setSelectedMember(null)
    setGiftRecipient(null)
  }

  async function assignRoyal(member:LammaMember){
    if(!isHost)return
    const {error}=await assignLammaRoyal(s,id,member)
    setNotice(error
      ? error.message.includes('insufficient_stars')?'رصيدك لا يكفي لتعيين ضيف ملكي بـ150 ⭐.':'تعذر تعيين الضيف الملكي.'
      :`تم تعيين ${member.profiles?.display_name||'الضيف'} كضيف ملكي مقابل 150 ⭐.`)
    await load()
  }

  async function requestRoyalSeat(){
    const {error}=await requestLammaRoyalSeat(s,id)
    setNotice(error
      ? error.message.includes('insufficient_stars')?'رصيد النجوم غير كافٍ.':'تعذر إرسال طلب الضيف الملكي.'
      :'تم إرسال طلب الضيف الملكي للمضيف 👑')
  }

  async function hostStarDecision(requestId:string,accept:boolean){
    const {error}=await respondLammaRoyalSeat(s,requestId,accept)
    setNotice(error?'تعذر تنفيذ القرار.':accept?'تم تعيين الضيف الملكي 👑':'تم رفض الطلب.')
    await load()
  }

  async function royalAction(target:string,action:LammaRoyalAction){
    if(!isRoyal)return
    setRoyalBusy(true)
    const {error}=await controlLammaMember(s,id,target,action)
    setNotice(error
      ? 'تعذر تنفيذ الإجراء الملكي.'
      : action==='kick'?'تم حذف الضيف من اللَمّة.'
      : action==='mute_voice'?'تم قفل المايك عن الضيف.'
      : action==='unmute_voice'?'تم فتح المايك للضيف.'
      : action==='mute_text'?'تم قفل الشات عن الضيف.'
      :'تم فتح الشات للضيف.')
    setRoyalBusy(false)
    await load()
  }

  function toggleChallengePick(userId:string){
    if(!isRoyal||userId===uid)return
    setChallengePick(current=>{
      if(current.includes(userId))return current.filter(x=>x!==userId)
      if(current.length>=2)return [current[1],userId]
      return [...current,userId]
    })
  }

  function toggleMicPick(userId:string){
    if(!isRoyal||userId===uid)return
    setMicPick(current=>current.includes(userId)?current.filter(x=>x!==userId):[...current,userId])
  }

  async function applySelectedMics(){
    if(!isRoyal)return
    setRoyalBusy(true)
    const targets=members.filter(m=>m.user_id!==uid&&m.user_id!==space?.owner_id)
    for(const member of targets){
      await controlLammaMember(
        s,
        id,
        member.user_id,
        micPick.includes(member.user_id)?'unmute_voice':'mute_voice'
      )
    }
    setRoyalBusy(false)
    setNotice('تم تطبيق اختيار المايكات.')
    await load()
  }

  async function setNewChallenge(){
    if(!isRoyal||challengePick.length!==2)return
    setRoyalBusy(true)
    const {error}=await setLammaPairSpotlight(s,id,challengePick[0],challengePick[1])
    setNotice(error
      ? error.message.includes('users_must_join_voice')?'الشخصان لازم يكونا داخل الصوت أولًا.':'تعذر تعيين التحدي الجديد.'
      :'تم تعيين شخصين جديدين للتحدي ⚔️')
    if(!error)setChallengePick([])
    setRoyalBusy(false)
    await load()
  }

  const renderAvatar=(member:LammaMember|null,size='h-12 w-12')=>{
    const name=member?.profiles?.display_name||'ضيف'
    return member?.profiles?.avatar_url
      ? <img src={member.profiles.avatar_url} alt="" className={`${size} rounded-full object-cover`}/>
      : <span className={`${size} grid place-items-center rounded-full bg-white/20 text-lg font-black text-white`}>{name[0]}</span>
  }

  return <AppShell>
    <main className="p-2">
      {notice?<div className="mb-2 rounded-2xl bg-[#edf5ff] px-3 py-2 text-center text-xs font-black text-[#24528d]">{notice}</div>:null}

      <section className="lammetna-gradient animated-gradient-card lamma-room-card relative flex h-[calc(100dvh-144px)] min-h-[650px] flex-col overflow-hidden rounded-[32px] p-3 text-white shadow-[0_24px_60px_rgba(43,72,216,.30)]">
        <div className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full border-[34px] border-white/10"/>
        <div className="pointer-events-none absolute -right-20 top-[28%] h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl"/>

        <LammaRoomStage
          space={space}
          members={members}
          voiceMembers={voiceMembers}
          voiceStreams={voiceStreams}
          inVoice={inVoice}
          isHost={isHost}
          uid={uid}
          hostMember={hostMember}
          royalMember={royalMember}
          challengeA={challengeA}
          challengeB={challengeB}
          otherGuests={otherGuests}
          voiceRequestStatus={voiceRequestStatus}
          micEnabled={micEnabled}
          voiceRequestsCount={voiceRequests.length}
          onShowGuests={()=>setShowGuests(true)}
          onBack={()=>r.push('/spaces')}
          onSelectMember={setSelectedMember}
          onAssignRoyal={assignRoyal}
          onRequestVoiceApproval={requestVoiceApproval}
          onToggleMic={toggleMic}
          onLeaveVoice={leaveVoice}
        />

        <LammaChatPanel
          messages={messages}
          uid={uid}
          members={members}
          body={body}
          onSelectMember={setSelectedMember}
          onBodyChange={setBody}
          onSend={send}
          onOpenGifts={()=>setShowGiftRecipients(true)}
        />
      </section>
    </main>

    <LammaGuestDrawer
      open={showGuests}
      uid={uid}
      isHost={isHost}
      isRoyal={isRoyal}
      royalBusy={royalBusy}
      royalId={royalId}
      ownerId={space?.owner_id}
      orderedGuests={orderedGuests}
      royalMember={royalMember}
      challengeA={challengeA}
      challengeB={challengeB}
      spotlight={spotlight}
      voiceMembers={voiceMembers}
      voiceRequests={voiceRequests}
      challengePick={challengePick}
      micPick={micPick}
      onClose={()=>setShowGuests(false)}
      onSelectMember={setSelectedMember}
      onAssignRoyal={assignRoyal}
      onRoyalAction={royalAction}
      onToggleChallengePick={toggleChallengePick}
      onToggleMicPick={toggleMicPick}
      onApplySelectedMics={applySelectedMics}
      onSetNewChallenge={setNewChallenge}
      onVoiceDecision={hostVoiceDecision}
    />

    <LammaGiftRecipientPicker
      open={showGiftRecipients}
      members={members}
      uid={uid}
      ownerId={space?.owner_id}
      onClose={()=>setShowGiftRecipients(false)}
      onChoose={chooseGiftRecipient}
    />

    <LammaMemberSheet
      member={selectedMember}
      privateContactPrice={privateContactPrice}
      onClose={()=>setSelectedMember(null)}
      onContact={requestPrivateContact}
      onGift={(member)=>{
        setGiftRecipient(member)
        setGiftMode('profile')
        setShowGifts(true)
        setSelectedMember(null)
      }}
    />

    <LammaGiftPicker
      open={showGifts}
      gifts={gifts}
      recipient={giftRecipient}
      mode={giftMode}
      hasSpotlight={Boolean(spotlight)}
      ownerId={space?.owner_id}
      isHost={isHost}
      onClose={()=>{setShowGifts(false);setGiftRecipient(null)}}
      onSend={sendGift}
    />

    <LammaGiftBurst gift={giftBurst}/>
  </AppShell>
}
