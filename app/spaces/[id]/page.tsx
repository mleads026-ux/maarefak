'use client'

import {use,useEffect,useMemo,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {
  Crown,Gift,Mic,MicOff,PhoneCall,Send,Star,Users,X,Swords,
  ChevronLeft,Volume2,VolumeX,UserMinus,MessageSquareOff,
  MessageSquare,Check,Headphones,ShieldCheck
} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {LammaRoomStage} from '@/components/lamma-room-stage'
import {LammaGiftBurst,LammaGiftPicker,LammaGiftRecipientPicker} from '@/components/lamma-gift-modals'
import {LammaChatPanel} from '@/components/lamma-chat-panel'
import {LammaMemberSheet} from '@/components/lamma-member-sheet'
import {LammaGuestDrawer} from '@/components/lamma-guest-drawer'
import {
  buildLammaGuestLayout,
  findLammaMember,
  findLammaVoiceParticipant,
  type LammaGiftItem,
  type LammaMember,
  type LammaVoiceParticipant,
} from '@/lib/lamma-room'
import {fetchLammaRoomSnapshot} from '@/lib/lamma-room-data'
import {subscribeLammaRoomRealtime} from '@/lib/lamma-room-realtime'

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
  const [chatExpanded,setChatExpanded]=useState(false)

  const localStreamRef=useRef<MediaStream|null>(null)
  const peersRef=useRef<Map<string,RTCPeerConnection>>(new Map())
  const audiosRef=useRef<Map<string,HTMLAudioElement>>(new Map())
  const peerStreamsRef=useRef<Map<string,MediaStream>>(new Map())
  const pendingIceRef=useRef<Map<string,RTCIceCandidateInit[]>>(new Map())
  const voiceChannelRef=useRef<any>(null)
  const messagesEndRef=useRef<HTMLDivElement|null>(null)
  const chatDragStartRef=useRef<number|null>(null)
  const chatDragMovedRef=useRef(false)

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

  useEffect(()=>{
    load()
    const roomChannel=subscribeLammaRoomRealtime(s,id,load)

    return()=>{
      s.removeChannel(roomChannel)
      cleanupVoice()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[id])

  useEffect(()=>{
    messagesEndRef.current?.scrollIntoView({behavior:'smooth',block:'end'})
  },[messages.length])

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

  const voiceState=(userId:string)=>findLammaVoiceParticipant(voiceMembers,userId)

  async function send(){
    const text=body.trim()
    if(!text)return
    setBody('')
    const {data:row,error}=await s.from('space_messages')
      .insert({space_id:id,sender_id:uid,body:text,message_type:'text'})
      .select('id,body,created_at,sender_id,message_type,gift_transaction_id,gift_id,gift_recipient_id')
      .single()

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

  function chatDragStart(e:any){
    chatDragStartRef.current=e.clientY
    chatDragMovedRef.current=false
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function chatDragMove(e:any){
    const start=chatDragStartRef.current
    if(start==null)return
    const delta=e.clientY-start
    if(Math.abs(delta)>10)chatDragMovedRef.current=true
    if(delta<-24&&!chatExpanded)setChatExpanded(true)
    if(delta>24&&chatExpanded)setChatExpanded(false)
  }

  function chatDragEnd(e:any){
    chatDragStartRef.current=null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  async function requestVoiceApproval(){
    if(isHost){await joinVoice();return}
    if(voiceRequestStatus==='accepted'){await joinVoice();return}
    const {error}=await s.rpc('request_lamma_voice_join',{p_space:id})
    if(error){setNotice('تعذر إرسال طلب الانضمام للصوت.');return}
    setVoiceRequestStatus('pending')
    setNotice('تم إرسال طلب المايك إلى الـHost.')
  }

  async function hostVoiceDecision(userId:string,accept:boolean){
    const {error}=await s.rpc('host_respond_lamma_voice_request',{p_space:id,p_user:userId,p_accept:accept})
    setNotice(error?'تعذر تنفيذ القرار.':accept?'تمت الموافقة على طلب المايك.':'تم رفض طلب المايك.')
    await load()
  }

  async function joinVoice(){
    if(inVoice)return
    setNotice('')
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false})
      localStreamRef.current=stream
      setVoiceStreams([stream])

      const {error}=await s.rpc('enter_lamma_voice',{p_space:id})
      if(error){
        stream.getTracks().forEach(t=>t.stop())
        localStreamRef.current=null
        setVoiceStreams([])
        setNotice(error.message.includes('voice_requires_host_approval')?'لازم موافقة الـHost أولًا.':'تعذر دخول الصوت.')
        return
      }

      setInVoice(true)
      await startVoiceRealtime()
      await refreshVoiceMembers()
    }catch{
      setNotice('اسمح للموقع باستخدام الميكروفون ثم حاول مرة أخرى.')
    }
  }

  async function leaveVoice(){
    await s.rpc('leave_lamma_voice',{p_space:id})
    cleanupVoice()
    setVoiceStreams([])
    setInVoice(false)
    setMicEnabled(false)
    setVoiceMembers(current=>current.filter(x=>x.user_id!==uid))
  }

  async function toggleMic(){
    const next=!micEnabled
    const {error}=await s.rpc('set_lamma_mic',{p_space:id,p_enabled:next})
    if(error){
      setNotice(error.message.includes('mic_requires_seat')?'المايك متاح للمضيف أو الأشخاص الذين سمح لهم النظام بالكلام.':'تعذر تغيير حالة الميكروفون.')
      return
    }
    localStreamRef.current?.getAudioTracks().forEach(track=>{track.enabled=next})
    setMicEnabled(next)
  }

  async function refreshVoiceMembers(){
    const {data}=await s.from('space_voice_participants')
      .select('user_id,mic_enabled,profiles(display_name,avatar_url)')
      .eq('space_id',id)

    const rows=(data||[]) as any[]
    setVoiceMembers(rows)

    const own=rows.find(x=>x.user_id===uid)
    if(own){
      const allowed=Boolean(own.mic_enabled)
      setMicEnabled(allowed)
      localStreamRef.current?.getAudioTracks().forEach(track=>{track.enabled=allowed})
    }

    for(const participant of rows){
      if(participant.user_id===uid)continue
      if(uid<participant.user_id)await makeOffer(participant.user_id)
      else ensurePeer(participant.user_id)
    }
  }

  async function startVoiceRealtime(){
    if(voiceChannelRef.current)return

    const channel=s.channel(`lamma-voice-${id}-${uid}`)
      .on('postgres_changes',{
        event:'*',schema:'public',table:'space_voice_participants',filter:`space_id=eq.${id}`
      },async(payload:any)=>{
        await refreshVoiceMembers()
        if(payload.eventType==='DELETE')closePeer(payload.old.user_id)
      })
      .on('postgres_changes',{
        event:'INSERT',schema:'public',table:'space_voice_signals',filter:`space_id=eq.${id}`
      },async(payload:any)=>{
        const signal=payload.new
        if(signal.target_id!==uid)return
        await handleSignal(signal)
      })
      .subscribe()

    voiceChannelRef.current=channel
  }

  function ensurePeer(peerId:string){
    const existing=peersRef.current.get(peerId)
    if(existing)return existing

    const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]})
    localStreamRef.current?.getTracks().forEach(track=>pc.addTrack(track,localStreamRef.current!))

    pc.onicecandidate=async(event)=>{
      if(!event.candidate)return
      await s.from('space_voice_signals').insert({
        space_id:id,sender_id:uid,target_id:peerId,signal_type:'ice',payload:event.candidate.toJSON()
      })
    }

    pc.ontrack=(event)=>{
      let audio=audiosRef.current.get(peerId)
      if(!audio){
        audio=new Audio()
        audio.autoplay=true
        audiosRef.current.set(peerId,audio)
      }
      const incoming=event.streams[0]
      peerStreamsRef.current.set(peerId,incoming)
      setVoiceStreams(current=>current.some(x=>x.id===incoming.id)?current:[...current,incoming])
      audio.srcObject=incoming
      audio.play().catch(()=>{})
    }

    peersRef.current.set(peerId,pc)
    return pc
  }

  async function makeOffer(peerId:string){
    const pc=ensurePeer(peerId)
    if(pc.signalingState!=='stable'||pc.localDescription)return
    const offer=await pc.createOffer()
    await pc.setLocalDescription(offer)
    await s.from('space_voice_signals').insert({
      space_id:id,sender_id:uid,target_id:peerId,signal_type:'offer',payload:offer
    })
  }

  async function handleSignal(signal:any){
    const peerId=signal.sender_id
    const pc=ensurePeer(peerId)

    if(signal.signal_type==='offer'){
      await pc.setRemoteDescription(signal.payload)
      const queue=pendingIceRef.current.get(peerId)||[]
      for(const candidate of queue)await pc.addIceCandidate(candidate).catch(()=>{})
      pendingIceRef.current.delete(peerId)
      const answer=await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await s.from('space_voice_signals').insert({
        space_id:id,sender_id:uid,target_id:peerId,signal_type:'answer',payload:answer
      })
      return
    }

    if(signal.signal_type==='answer'){
      if(!pc.remoteDescription)await pc.setRemoteDescription(signal.payload)
      return
    }

    if(signal.signal_type==='ice'){
      if(pc.remoteDescription)await pc.addIceCandidate(signal.payload).catch(()=>{})
      else{
        const queue=pendingIceRef.current.get(peerId)||[]
        queue.push(signal.payload)
        pendingIceRef.current.set(peerId,queue)
      }
    }
  }

  function closePeer(peerId:string){
    peersRef.current.get(peerId)?.close()
    peersRef.current.delete(peerId)

    const audio=audiosRef.current.get(peerId)
    if(audio){audio.pause();audio.srcObject=null}
    audiosRef.current.delete(peerId)

    const stream=peerStreamsRef.current.get(peerId)
    if(stream){
      peerStreamsRef.current.delete(peerId)
      setVoiceStreams(current=>current.filter(x=>x.id!==stream.id))
    }
    pendingIceRef.current.delete(peerId)
  }

  function cleanupVoice(){
    if(voiceChannelRef.current){
      s.removeChannel(voiceChannelRef.current)
      voiceChannelRef.current=null
    }
    peersRef.current.forEach(pc=>pc.close())
    peersRef.current.clear()
    audiosRef.current.forEach(audio=>{audio.pause();audio.srcObject=null})
    audiosRef.current.clear()
    peerStreamsRef.current.clear()
    localStreamRef.current?.getTracks().forEach(track=>track.stop())
    localStreamRef.current=null
    pendingIceRef.current.clear()
  }

  async function requestPrivateContact(member:LammaMember){
    setNotice('')
    const {error}=await s.rpc('request_private_contact_from_space',{
      p_space:id,p_target:member.user_id,p_message:null
    })
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
    const {error}=giftMode==='chat'
      ? await s.rpc('send_lamma_chat_gift',{p_space:id,p_gift:gift.id})
      : await s.rpc('send_gift',{p_target:giftRecipient.user_id,p_gift:gift.id,p_space:id})
    if(error){
      setNotice(error.message.includes('insufficient_stars')?'رصيد النجوم غير كافٍ.':'تعذر إرسال الهدية.')
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
    const {error}=await s.rpc('host_assign_royal',{p_space:id,p_target:member.user_id})
    setNotice(error
      ? error.message.includes('insufficient_stars')?'رصيدك لا يكفي لتعيين ضيف ملكي بـ150 ⭐.':'تعذر تعيين الضيف الملكي.'
      :`تم تعيين ${member.profiles?.display_name||'الضيف'} كضيف ملكي مقابل 150 ⭐.`)
    await load()
  }

  async function requestRoyalSeat(){
    const {error}=await s.rpc('request_star_seat',{p_space:id})
    setNotice(error
      ? error.message.includes('insufficient_stars')?'رصيد النجوم غير كافٍ.':'تعذر إرسال طلب الضيف الملكي.'
      :'تم إرسال طلب الضيف الملكي للمضيف 👑')
  }

  async function hostStarDecision(requestId:string,accept:boolean){
    const {error}=await s.rpc('respond_star_seat_request',{p_request:requestId,p_accept:accept})
    setNotice(error?'تعذر تنفيذ القرار.':accept?'تم تعيين الضيف الملكي 👑':'تم رفض الطلب.')
    await load()
  }

  async function royalAction(target:string,action:'mute_voice'|'unmute_voice'|'mute_text'|'unmute_text'|'kick'){
    if(!isRoyal)return
    setRoyalBusy(true)
    const {error}=await s.rpc('royal_control_lamma_member',{
      p_space:id,p_target:target,p_action:action
    })
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
      await s.rpc('royal_control_lamma_member',{
        p_space:id,
        p_target:member.user_id,
        p_action:micPick.includes(member.user_id)?'unmute_voice':'mute_voice'
      })
    }
    setRoyalBusy(false)
    setNotice('تم تطبيق اختيار المايكات.')
    await load()
  }

  async function setNewChallenge(){
    if(!isRoyal||challengePick.length!==2)return
    setRoyalBusy(true)
    const {error}=await s.rpc('royal_set_lamma_pair_spotlight',{
      p_space:id,p_user_a:challengePick[0],p_user_b:challengePick[1]
    })
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
          chatExpanded={chatExpanded}
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
          chatExpanded={chatExpanded}
          messages={messages}
          uid={uid}
          members={members}
          body={body}
          messagesEndRef={messagesEndRef}
          onSelectMember={setSelectedMember}
          onBodyChange={setBody}
          onSend={send}
          onOpenGifts={()=>setShowGiftRecipients(true)}
          onDragStart={chatDragStart}
          onDragMove={chatDragMove}
          onDragEnd={chatDragEnd}
          onToggleExpanded={()=>{if(!chatDragMovedRef.current)setChatExpanded(v=>!v)}}
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
