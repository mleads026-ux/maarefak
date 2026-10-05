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
import {VoiceGlowBar} from '@/components/voice-glow-bar'

type Member={
  user_id:string
  role:string
  profiles:{
    display_name:string|null
    avatar_url:string|null
    mood:string|null
  }|null
}

type VoiceParticipant={
  user_id:string
  mic_enabled:boolean
  profiles:{
    display_name:string|null
    avatar_url:string|null
  }|null
}

type GiftItem={
  id:string
  name_ar:string
  emoji:string
  price_stars:number
  animation_tier:string
}

const fallback=['/demo/face-1.jpg','/demo/face-2.jpg','/demo/face-3.jpg','/demo/face-4.jpg']

export default function SpaceChat({params}:{params:Promise<{id:string}>}){
  const {id}=use(params)
  const s=useMemo(()=>createClient(),[])
  const r=useRouter()

  const [space,setSpace]=useState<any>(null)
  const [messages,setMessages]=useState<any[]>([])
  const [members,setMembers]=useState<Member[]>([])
  const [voiceMembers,setVoiceMembers]=useState<VoiceParticipant[]>([])
  const [gifts,setGifts]=useState<GiftItem[]>([])
  const [privateContactPrice,setPrivateContactPrice]=useState(20)
  const [uid,setUid]=useState('')
  const [body,setBody]=useState('')
  const [selectedMember,setSelectedMember]=useState<Member|null>(null)
  const [showGifts,setShowGifts]=useState(false)
  const [showGiftRecipients,setShowGiftRecipients]=useState(false)
  const [giftRecipient,setGiftRecipient]=useState<Member|null>(null)
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

    const [
      {data:sp},
      {data:ms},
      {data:memberRows},
      {data:voiceRows},
      {data:giftRows},
      {data:priceRow},
      {data:seatRows},
      {data:reqRows},
      {data:spotRow},
    ]=await Promise.all([
      s.from('spaces').select('id,name,emoji,is_public,owner_id,seat_count,description,public_lamma_id').eq('id',id).single(),
      s.from('space_messages')
        .select('id,body,created_at,sender_id,message_type,gift_transaction_id,gift_id,gift_recipient_id,profiles!space_messages_sender_id_fkey(display_name,avatar_url)')
        .eq('space_id',id).order('created_at',{ascending:true}).limit(200),
      s.from('space_members').select('user_id,role,profiles(display_name,avatar_url,mood)').eq('space_id',id),
      s.from('space_voice_participants').select('user_id,mic_enabled,profiles(display_name,avatar_url)').eq('space_id',id),
      s.from('gift_catalog').select('id,name_ar,emoji,price_stars,animation_tier').eq('active',true).order('price_stars'),
      s.from('feature_prices').select('price_stars').eq('key','private_contact_from_lamma').maybeSingle(),
      s.from('space_seats').select('space_id,seat_no,user_id,seat_type,profiles(display_name,avatar_url)').eq('space_id',id).order('seat_no'),
      s.from('space_star_seat_requests')
        .select('id,requester_id,cost_stars,status,profiles!space_star_seat_requests_requester_id_fkey(display_name,avatar_url)')
        .eq('space_id',id).eq('status','pending').order('created_at'),
      s.from('space_pair_spotlights').select('*').eq('space_id',id).eq('status','active').order('started_at',{ascending:false}).limit(1).maybeSingle(),
    ])

    const voices=(voiceRows||[]) as any[]
    setSpace(sp)
    setMessages(ms||[])
    setMembers((memberRows||[]) as any)
    setVoiceMembers(voices)
    setGifts((giftRows||[]) as any)
    setSeats(seatRows||[])
    setStarRequests(reqRows||[])
    setSpotlight(spotRow||null)
    const hostNow=sp?.owner_id===user.id
    setIsHost(hostNow)
    if(priceRow?.price_stars!=null)setPrivateContactPrice(Number(priceRow.price_stars))

    const {data:voiceStatus}=await s.rpc('my_lamma_voice_request_status',{p_space:id})
    setVoiceRequestStatus(((voiceStatus as any)||'none') as any)
    if(hostNow){
      const {data:pendingVoice}=await s.rpc('host_lamma_voice_requests',{p_space:id})
      setVoiceRequests((pendingVoice||[]) as any[])
    }else{
      setVoiceRequests([])
    }

    const ownVoice=voices.find((x:any)=>x.user_id===user.id)
    setInVoice(Boolean(ownVoice))
    if(ownVoice){
      const allowed=Boolean(ownVoice.mic_enabled)
      setMicEnabled(allowed)
      localStreamRef.current?.getAudioTracks().forEach(track=>{track.enabled=allowed})
    }
  }

  useEffect(()=>{
    load()
    const roomChannel=s.channel(`lamma-room-ui-${id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'space_messages',filter:`space_id=eq.${id}`},()=>load())
      .on('postgres_changes',{event:'*',schema:'public',table:'space_members',filter:`space_id=eq.${id}`},()=>load())
      .on('postgres_changes',{event:'*',schema:'public',table:'space_seats',filter:`space_id=eq.${id}`},()=>load())
      .on('postgres_changes',{event:'*',schema:'public',table:'space_pair_spotlights',filter:`space_id=eq.${id}`},()=>load())
      .on('postgres_changes',{event:'*',schema:'public',table:'space_star_seat_requests',filter:`space_id=eq.${id}`},()=>load())
      .on('postgres_changes',{event:'*',schema:'public',table:'space_mic_queue',filter:`space_id=eq.${id}`},()=>load())
      .subscribe()

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

  function memberById(userId?:string|null){
    if(!userId)return null
    return members.find(x=>x.user_id===userId)||null
  }

  const royalMember=memberById(royalId)
  const hostMember=memberById(space?.owner_id)
  const challengeA=memberById(spotlight?.user_a)
  const challengeB=memberById(spotlight?.user_b)
  const reserved=new Set([royalId,spotlight?.user_a,spotlight?.user_b].filter(Boolean))
  const otherGuests=members.filter(x=>!reserved.has(x.user_id)).slice(0,8)
  const orderedGuests=[
    ...(royalMember?[royalMember]:[]),
    ...(challengeA?[challengeA]:[]),
    ...(challengeB?[challengeB]:[]),
    ...members.filter(x=>!reserved.has(x.user_id)),
  ]

  function voiceState(userId:string){
    return voiceMembers.find(x=>x.user_id===userId)
  }

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

  async function requestPrivateContact(member:Member){
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

  function chooseGiftRecipient(member:Member){
    setGiftRecipient(member)
    setGiftMode(member.user_id===space?.owner_id&&uid!==space?.owner_id?'chat':'profile')
    setShowGiftRecipients(false)
    setShowGifts(true)
  }

  async function sendGift(gift:GiftItem){
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

  async function assignRoyal(member:Member){
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

  const renderAvatar=(member:Member|null,size='h-12 w-12')=>{
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

        <div className={`relative z-10 flex shrink-0 flex-col overflow-hidden transition-[height] duration-300 ${chatExpanded?'h-[18%]':'h-[55%]'}`}>
          <div className="relative flex items-center justify-center pt-1">
            <button onClick={()=>setShowGuests(true)} className="tap-action absolute right-0 top-0 flex items-center gap-2 rounded-full border border-white/30 bg-white/16 px-3 py-2 text-xs font-black backdrop-blur">
              <Users size={17}/> الضيوف <span className="rounded-full bg-white/20 px-2 py-0.5">{members.length}</span>
            </button>
            <button onClick={()=>r.push('/spaces')} aria-label="رجوع" className="tap-action absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-white/16">
              <ChevronLeft size={20}/>
            </button>
            <div className="max-w-[210px] text-center">
              <p className="truncate text-[18px] font-black">{space?.emoji||'🎙️'} {space?.name||'اللَمّة'}</p>
              <p className="mt-0.5 text-[10px] font-bold text-white/75">اللَمّة شغالة · {voiceMembers.length} بالصوت {space?.public_lamma_id?` · ${space.public_lamma_id}`:""}</p>
            </div>
          </div>

          <VoiceGlowBar streams={voiceStreams} active={inVoice||voiceMembers.length>0} compact/>

          <div className="mt-2 grid grid-cols-[1fr_1.25fr] items-center gap-3">
            <div className="rounded-[20px] border border-white/25 bg-white/10 p-2 text-center">
              <p className="mb-1 text-[10px] font-black text-[#ffe083]">👑 الضيف الملكي</p>
              {royalMember
                ? <button onClick={()=>royalMember.user_id!==uid&&setSelectedMember(royalMember)} className="tap-action">
                    <span className="royal-avatar-frame mx-auto block h-[72px] w-[72px] rounded-full p-[3px]">
                      {renderAvatar(royalMember,'h-full w-full')}
                    </span>
                    <span className="mt-1 block max-w-[110px] truncate text-[11px] font-black">{royalMember.profiles?.display_name||'الضيف الملكي'}</span>
                  </button>
                : isHost&&hostMember
                  ? <button onClick={()=>assignRoyal(hostMember)} className="tap-action mx-auto flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border-2 border-dashed border-[#ffe28e]/70 bg-white/10 text-[9px] font-black">
                      <Crown size={18}/><span>عيّن نفسك ملكي</span><span className="text-[#ffe083]">150 ⭐</span>
                    </button>
                  : <div className="mx-auto flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border-2 border-dashed border-[#ffe28e]/70 bg-white/10 text-[9px] font-black">
                      <Crown size={18}/><span>يختاره الـHost</span><span className="text-[#ffe083]">150 ⭐</span>
                    </div>
              }
            </div>

            <div className="rounded-[20px] border border-white/25 bg-white/10 p-2">
              <p className="mb-1 text-center text-[10px] font-black">⚔️ التحدي الآن</p>
              <div className="flex items-center justify-center gap-2">
                {[challengeA,challengeB].map((member,index)=>
                  member
                    ? <button key={member.user_id} onClick={()=>member.user_id!==uid&&setSelectedMember(member)} className="tap-action min-w-0 text-center">
                        <span className="challenge-avatar-frame mx-auto block h-[58px] w-[58px] rounded-full p-[3px]">{renderAvatar(member,'h-full w-full')}</span>
                        <span className="mt-1 block max-w-[70px] truncate text-[9px] font-black">{member.profiles?.display_name||'متحدي'}</span>
                      </button>
                    : <span key={index} className="grid h-[58px] w-[58px] place-items-center rounded-full border-2 border-dashed border-white/45 text-lg font-black">؟</span>
                )}
                <Swords size={19} className="shrink-0 text-[#ffe27b]"/>
              </div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {Array.from({length:8},(_,index)=>{
              const member=otherGuests[index]||null
              const voice=member?voiceState(member.user_id):null
              return <button
                key={member?.user_id||`empty-${index}`}
                disabled={!member}
                onClick={()=>member&&member.user_id!==uid&&setSelectedMember(member)}
                className="tap-action min-w-0 disabled:opacity-45"
              >
                <span className="block px-0.5 py-1 text-center">
                  <span className="ornate-silver-ring relative mx-auto block h-[54px] w-[54px] rounded-full p-[4px]">
                    {member?renderAvatar(member,'h-full w-full'):<span className="grid h-full w-full place-items-center rounded-full bg-white/12 text-[9px]">فارغ</span>}
                    {member&&voice?<span className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full ring-1 ring-white ${voice.mic_enabled?'bg-[#12d79d]':'bg-[#5e7193]'}`}>{voice.mic_enabled?<Mic size={9}/>:<MicOff size={9}/>}</span>:null}
                  </span>
                  <span className="mt-1 block truncate text-[8px] font-black">{member?.profiles?.display_name||`ضيف ${index+1}`}</span>
                </span>
              </button>
            })}
          </div>

        </div>

        <div className={`relative z-20 mt-2 shrink-0 items-center justify-center gap-2 ${chatExpanded?'hidden':'flex'}`}>
          {!inVoice
            ? <button
                onClick={requestVoiceApproval}
                disabled={!isHost&&voiceRequestStatus==='pending'}
                className="tap-action flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] font-black text-[#5e25d8] shadow-lg disabled:opacity-65"
              >
                <Headphones size={16}/>
                {isHost?'طلب المايك':voiceRequestStatus==='accepted'?'تمت الموافقة · افتح المايك':voiceRequestStatus==='pending'?'طلب المايك قيد الانتظار':'طلب المايك'}
              </button>
            : <>
                <button onClick={toggleMic} className={`tap-action grid h-9 w-9 place-items-center rounded-full ${micEnabled?'bg-[#14d29b]':'bg-white/18'}`}>{micEnabled?<Mic size={17}/>:<MicOff size={17}/>}</button>
                <button onClick={leaveVoice} className="tap-action rounded-full bg-[#ff337d] px-4 py-2 text-[11px] font-black">خروج من الصوت</button>
              </>
          }
          {isHost&&voiceRequests.length?<span className="rounded-full bg-[#ffe16d] px-3 py-2 text-[10px] font-black text-[#694000]">{voiceRequests.length} طلب صوت</span>:null}
        </div>

        <div className="relative z-30 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px] border border-white/40 bg-[#f1f5fa]/95 text-[#0b1734] shadow-[0_-8px_30px_rgba(5,40,110,.12)] backdrop-blur transition-all duration-300">
          <div
            onPointerDown={chatDragStart}
            onPointerMove={chatDragMove}
            onPointerUp={chatDragEnd}
            onPointerCancel={chatDragEnd}
            className="touch-none cursor-ns-resize border-b border-[#ccd8e7] bg-[#f1f5fa] px-4 pb-3 pt-2"
          >
            <button
              type="button"
              aria-label={chatExpanded?'تصغير الشات':'تكبير الشات'}
              onClick={()=>{if(!chatDragMovedRef.current)setChatExpanded(v=>!v)}}
              className="tap-action mx-auto mb-2 block h-1.5 w-14 rounded-full bg-white shadow-[0_1px_4px_rgba(40,80,130,.32)]"
            />
            <div className="flex items-center justify-between">
            <div><p className="text-sm font-black">شات اللَمّة</p><p className="text-[9px] font-bold text-[#77849b]">كل رسالة باسم صاحبها</p></div>
            <span className="flex items-center gap-1 rounded-full bg-[#eaf4ff] px-3 py-1.5 text-[10px] font-black text-[#1768f4]"><MessageSquare size={13}/>{messages.length}</span>
            </div>
          </div>

          <div className="hide-scrollbar flex-1 space-y-2 overflow-y-auto bg-[#f1f5fa] px-3 py-3">
            {messages.map((m:any)=>{
              const mine=m.sender_id===uid
              const profile=(m.profiles as any)
              return <div key={m.id} className={`flex items-end gap-2 ${mine?'justify-start':'justify-end'}`}>
                {!mine?<button onClick={()=>{const member=members.find(x=>x.user_id===m.sender_id);if(member)setSelectedMember(member)}} className="tap-action h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#eaf3fb]">{profile?.avatar_url?<img src={profile.avatar_url} alt="" className="h-full w-full object-cover"/>:<span className="grid h-full w-full place-items-center text-[10px] font-black text-[#1768f4]">{(profile?.display_name||'ض')[0]}</span>}</button>:null}
                <div className={`min-w-0 max-w-[86%] rounded-[18px] px-3 py-2 ${m.message_type==='gift'?'bg-[linear-gradient(135deg,#fff0a8,#fff8df)] text-[#6f4c00] ring-1 ring-[#f0d169]':mine?'bg-[#1768f4] text-white':'bg-white text-[#12203d] ring-1 ring-[#dce6f2]'}`}>
                  <p className="min-w-0 whitespace-pre-wrap break-words text-[12px] font-medium leading-5 [overflow-wrap:anywhere]">
                    <span className={`font-black ${mine?'text-white':'text-[#1768f4]'}`}>{mine?'أنت':profile?.display_name||'ضيف'}: </span>
                    <span>{m.body}</span>
                  </p>
                </div>
              </div>
            })}
            {!messages.length?<div className="grid h-full min-h-28 place-items-center text-center text-xs font-bold text-[#8490a5]">ابدأوا الكلام 👋<br/>الرسائل هتظهر هنا مباشرة</div>:null}
            <div ref={messagesEndRef}/>
          </div>

          <div className="flex gap-2 border-t border-[#cbd7e5] bg-[#f1f5fa] p-2">
            <button
              onClick={()=>setShowGiftRecipients(true)}
              className="tap-action grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff2c8] text-[#a76500] shadow-sm ring-1 ring-[#efd892]"
              aria-label="إرسال هدية"
            ><Gift size={19}/></button>
            <Input
              placeholder="اكتب رسالة في اللَمّة..."
              value={body}
              onChange={e=>setBody(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')send()}}
              className="h-11 rounded-2xl border border-[#d7e1ec] bg-[#f1f5fa]"
            />
            <Button size="icon" onClick={send} className="h-11 w-11 shrink-0 rounded-2xl"><Send size={18}/></Button>
          </div>
        </div>
      </section>
    </main>

    {showGuests?<div className="fixed inset-0 z-[100] bg-black/45" onClick={()=>setShowGuests(false)}>
      <div className="relative mx-auto h-full w-full max-w-[432px]">
        <aside onClick={e=>e.stopPropagation()} className="absolute right-0 top-0 h-full w-[89%] overflow-y-auto rounded-l-[30px] bg-white p-4 pb-28 text-[#0b1734] shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-white pb-3">
            <div><h3 className="text-xl font-black">الضيوف</h3><p className="text-[10px] font-bold text-[#78849a]">بالترتيب داخل اللَمّة</p></div>
            <button onClick={()=>setShowGuests(false)} className="tap-action grid h-10 w-10 place-items-center rounded-full bg-[#eef3f8]"><X size={20}/></button>
          </div>

          {isRoyal?<div className="mb-3 rounded-[20px] bg-[linear-gradient(135deg,#fff8d8,#fff,#eef7ff)] p-3 ring-1 ring-[#ead38a]">
            <div className="flex items-center gap-2"><Crown size={18} className="text-[#b67a00]"/><p className="text-sm font-black">تحكم الضيف الملكي</p></div>
            <p className="mt-1 text-[10px] font-bold text-[#7d6b42]">اختر شخصين للتحدي، أو حدد مين مسموح له بالمايك.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button disabled={challengePick.length!==2||royalBusy} onClick={setNewChallenge} className="tap-action rounded-xl bg-[#6e32e8] px-3 py-2 text-[10px] font-black text-white disabled:opacity-40">تعيين التحدي ({challengePick.length}/2)</button>
              <button disabled={royalBusy} onClick={applySelectedMics} className="tap-action rounded-xl bg-[#1768f4] px-3 py-2 text-[10px] font-black text-white disabled:opacity-40">تطبيق المايكات المحددة</button>
            </div>
          </div>:null}

          {isHost&&voiceRequests.length?<div className="mb-3 rounded-[20px] bg-[#eef7ff] p-3 ring-1 ring-[#cfe3fb]">
            <p className="mb-2 text-xs font-black">طلبات المايك 🎙️</p>
            <div className="space-y-2">{voiceRequests.map((q:any)=><div key={q.user_id} className="flex items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-[#e3ebf5]">
              {q.avatar_url?<img src={q.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover"/>:<span className="grid h-8 w-8 place-items-center rounded-full bg-[#edf4fb] text-xs font-black">{(q.display_name||'ض')[0]}</span>}
              <span className="flex-1 truncate text-[10px] font-black">{q.display_name||'ضيف'}</span>
              <button onClick={()=>hostVoiceDecision(q.user_id,true)} className="tap-action rounded-lg bg-[#17b984] px-2 py-1 text-[9px] font-black text-white">قبول</button>
              <button onClick={()=>hostVoiceDecision(q.user_id,false)} className="tap-action rounded-lg bg-[#fff0f2] px-2 py-1 text-[9px] font-black text-[#d62449]">رفض</button>
            </div>)}</div>
          </div>:null}

          <div className="space-y-2">
            {orderedGuests.map((member,index)=>{
              const isRoyalRow=member.user_id===royalId
              const isChallenge=member.user_id===spotlight?.user_a||member.user_id===spotlight?.user_b
              const voice=voiceState(member.user_id)
              const canRoyalControl=isRoyal&&member.user_id!==uid&&member.user_id!==space?.owner_id

              return <div key={member.user_id} className={`rounded-[20px] p-3 ring-1 ${isRoyalRow?'bg-[#fff8dc] ring-[#edd57e]':isChallenge?'bg-[#f4edff] ring-[#cdb8ff]':'bg-[#f7f9fc] ring-[#e3eaf3]'}`}>
                <div className="flex items-center gap-3">
                  <span className={`shrink-0 rounded-full p-[2px] ${isRoyalRow?'royal-avatar-frame':isChallenge?'challenge-avatar-frame':'ornate-silver-ring'}`}>
                    {member.profiles?.avatar_url?<img src={member.profiles.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover"/>:<span className="grid h-11 w-11 place-items-center rounded-full bg-[#dfeaf7] font-black text-[#1768f4]">{(member.profiles?.display_name||'ض')[0]}</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{member.profiles?.display_name||'ضيف'}</p>
                    <p className="mt-0.5 text-[9px] font-bold text-[#77849a]">
                      {isRoyalRow?'👑 الضيف الملكي':isChallenge?`⚔️ تحدي ${member.user_id===spotlight?.user_a?'1':'2'}`:`ضيف ${Math.max(1,index-(royalMember?1:0)-(challengeA?1:0)-(challengeB?1:0)+1)}`}
                      {voice?` · ${voice.mic_enabled?'المايك مفتوح':'المايك مقفول'}`:' · خارج الصوت'}
                    </p>
                  </div>
                  {member.user_id!==uid?<button onClick={()=>setSelectedMember(member)} className="tap-action rounded-full bg-white px-2 py-1 text-[9px] font-black text-[#1768f4] ring-1 ring-[#dce7f4]">الملف</button>:null}
                </div>

                {isHost&&!isRoyalRow?<button onClick={()=>assignRoyal(member)} className="tap-action mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-[#fff5c9] px-3 py-2 text-[10px] font-black text-[#8d6200] ring-1 ring-[#f0d777]"><Crown size={13}/> {member.user_id===uid?'عيّن نفسك ضيف ملكي':'تعيين ضيف ملكي'} · 150 ⭐</button>:null}

                {canRoyalControl?<div className="mt-2 grid grid-cols-3 gap-1.5">
                  <button onClick={()=>royalAction(member.user_id,voice?.mic_enabled?'mute_voice':'unmute_voice')} disabled={royalBusy} className="tap-action flex items-center justify-center gap-1 rounded-xl bg-white px-2 py-2 text-[9px] font-black ring-1 ring-[#e0e8f2]">
                    {voice?.mic_enabled?<VolumeX size={12}/>:<Volume2 size={12}/>} {voice?.mic_enabled?'قفل المايك':'فتح المايك'}
                  </button>
                  <button onClick={()=>royalAction(member.user_id,'mute_text')} disabled={royalBusy} className="tap-action flex items-center justify-center gap-1 rounded-xl bg-white px-2 py-2 text-[9px] font-black ring-1 ring-[#e0e8f2]"><MessageSquareOff size={12}/> قفل الشات</button>
                  <button onClick={()=>royalAction(member.user_id,'kick')} disabled={royalBusy} className="tap-action flex items-center justify-center gap-1 rounded-xl bg-[#fff0f2] px-2 py-2 text-[9px] font-black text-[#d62449] ring-1 ring-[#ffd1da]"><UserMinus size={12}/> حذف</button>

                  <button onClick={()=>toggleChallengePick(member.user_id)} className={`tap-action col-span-2 flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-[9px] font-black ${challengePick.includes(member.user_id)?'bg-[#6e32e8] text-white':'bg-[#f0eaff] text-[#6e32e8]'}`}>
                    <Swords size={12}/>{challengePick.includes(member.user_id)?'مختار للتحدي':'اختيار للتحدي'}
                  </button>
                  <button onClick={()=>toggleMicPick(member.user_id)} className={`tap-action flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-[9px] font-black ${micPick.includes(member.user_id)?'bg-[#1768f4] text-white':'bg-[#eaf3ff] text-[#1768f4]'}`}>
                    {micPick.includes(member.user_id)?<Check size={12}/>:<Mic size={12}/>} مايك
                  </button>

                  <button onClick={()=>royalAction(member.user_id,'unmute_text')} disabled={royalBusy} className="tap-action col-span-3 flex items-center justify-center gap-1 rounded-xl bg-[#ebfaf4] px-2 py-2 text-[9px] font-black text-[#12855f]"><MessageSquare size={12}/> فتح الشات لهذا الضيف</button>
                </div>:null}
              </div>
            })}
          </div>

          {isRoyal?<div className="mt-4 flex items-center gap-2 rounded-[18px] bg-[#eef7ff] p-3 text-[10px] font-bold text-[#315b91]"><ShieldCheck size={18} className="shrink-0 text-[#1768f4]"/>صلاحيات التحكم دي تظهر وتعمل للضيف الملكي الحالي فقط.</div>:null}
        </aside>
      </div>
    </div>:null}

    {showGiftRecipients?<div className="fixed inset-0 z-[122] flex items-end bg-black/45" onClick={()=>setShowGiftRecipients(false)}>
      <section onClick={e=>e.stopPropagation()} className="mx-auto max-h-[70dvh] w-full max-w-[432px] overflow-hidden rounded-t-[30px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e1eaf4] px-4 py-3">
          <div><p className="text-base font-black">إرسال هدية 🎁</p><p className="mt-0.5 text-[10px] font-bold text-[#77849a]">اختار الشخص اللي هتبعت له الهدية</p></div>
          <button onClick={()=>setShowGiftRecipients(false)} className="tap-action grid h-9 w-9 place-items-center rounded-full bg-[#eef3f8]"><X size={18}/></button>
        </div>
        <div className="hide-scrollbar max-h-[58dvh] space-y-2 overflow-y-auto p-3 pb-[max(24px,env(safe-area-inset-bottom))]">
          {members.filter(member=>member.user_id!==uid).map(member=><button
            key={member.user_id}
            onClick={()=>chooseGiftRecipient(member)}
            className="tap-action flex w-full items-center gap-3 rounded-[18px] bg-[#f5f8fc] p-3 text-right ring-1 ring-[#dfe8f2]"
          >
            <span className="ornate-silver-ring relative h-11 w-11 shrink-0 rounded-full p-[3px]">
              {member.profiles?.avatar_url?<img src={member.profiles.avatar_url} alt="" className="h-full w-full rounded-full object-cover"/>:<span className="grid h-full w-full place-items-center rounded-full bg-[#eaf3fb] font-black text-[#1768f4]">{(member.profiles?.display_name||'ض')[0]}</span>}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black">{member.profiles?.display_name||'ضيف'}</span>
              <span className="mt-0.5 block text-[9px] font-bold text-[#7b8798]">{member.user_id===space?.owner_id?'Host اللَمّة':'ضيف في اللَمّة'}</span>
            </span>
            <Gift size={18} className="text-[#a76500]"/>
          </button>)}
          {!members.some(member=>member.user_id!==uid)?<p className="p-5 text-center text-sm font-bold text-[#7b8798]">مفيش ضيوف تانيين في اللَمّة حاليًا.</p>:null}
        </div>
      </section>
    </div>:null}

    {selectedMember?<div className="fixed inset-0 z-[110] flex items-end bg-black/45" onClick={()=>setSelectedMember(null)}>
      <section onClick={e=>e.stopPropagation()} className="mx-auto w-full max-w-[432px] rounded-t-[30px] bg-white p-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="ornate-silver-ring rounded-full p-[4px]">{selectedMember.profiles?.avatar_url?<img src={selectedMember.profiles.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover"/>:<span className="grid h-12 w-12 place-items-center rounded-full bg-[#eaf3fb] font-black text-[#1768f4]">{(selectedMember.profiles?.display_name||'ض')[0]}</span>}</span>
            <div><p className="font-black">{selectedMember.profiles?.display_name||'ضيف'}</p><p className="text-[10px] font-bold text-[#7b879b]">{selectedMember.profiles?.mood||'ضيف في اللَمّة'}</p></div>
          </div>
          <button onClick={()=>setSelectedMember(null)} className="tap-action grid h-9 w-9 place-items-center rounded-full bg-[#eef3f8]"><X size={18}/></button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={()=>requestPrivateContact(selectedMember)}><Star size={15}/> تواصل · {privateContactPrice} ⭐</Button>
          <Button variant="outline" onClick={()=>{setGiftRecipient(selectedMember);setGiftMode('profile');setShowGifts(true);setSelectedMember(null)}}><Gift size={15}/> هدية</Button>
        </div>

      </section>
    </div>:null}

    {showGifts&&giftRecipient?<div className="fixed inset-0 z-[125] flex items-end bg-black/45" onClick={()=>{setShowGifts(false);setGiftRecipient(null)}}>
      <section onClick={e=>e.stopPropagation()} className="mx-auto max-h-[72dvh] w-full max-w-[432px] overflow-hidden rounded-t-[32px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e1eaf4] px-4 py-3">
          <div>
            <p className="text-base font-black">اختر هدية 🎁</p>
            <p className="mt-0.5 text-[10px] font-bold text-[#77849a]">{giftMode==='chat'?'هدية الشات تذهب للـHost':`إرسال إلى ${giftRecipient.profiles?.display_name||'الضيف'}`}</p>
          </div>
          <button onClick={()=>{setShowGifts(false);setGiftRecipient(null)}} className="tap-action grid h-9 w-9 place-items-center rounded-full bg-[#eef3f8]"><X size={18}/></button>
        </div>
        <div className="bg-[#f7faff] px-4 py-2 text-center text-[10px] font-black text-[#47607e]">
          {giftMode==='chat'
            ? spotlight
              ? 'التوزيع: التطبيق 15% · Host 55% · كل متحدي 15%'
              : 'التوزيع: التطبيق 15% · Host 85%'
            : giftRecipient.user_id===space?.owner_id||isHost
              ? 'التوزيع: التطبيق 15% · المستلم 85%'
              : 'التوزيع داخل اللَمّة: التطبيق 15% · Host 5% · المستلم 80%'}
        </div>
        <div className="hide-scrollbar grid max-h-[58dvh] grid-cols-3 gap-2 overflow-y-auto p-3 pb-[max(24px,env(safe-area-inset-bottom))]">
          {gifts.map(gift=><button key={gift.id} onClick={()=>sendGift(gift)} className={`tap-action gift-card-tier gift-${gift.animation_tier} rounded-[20px] p-3 text-center`}>
            <div className="gift-emoji text-3xl">{gift.emoji}</div>
            <p className="mt-1 truncate text-[10px] font-black">{gift.name_ar}</p>
            <p className="text-[10px] font-black text-[#a06a00]">{gift.price_stars.toLocaleString()} ⭐</p>
          </button>)}
        </div>
      </section>
    </div>:null}

    {giftBurst?<div className="pointer-events-none fixed inset-0 z-[150] grid place-items-center">
      <div className="gift-burst-pop text-center"><div className="text-7xl">{giftBurst.emoji}</div><p className="mt-2 rounded-full bg-black/55 px-4 py-2 text-sm font-black text-white">{giftBurst.name}</p></div>
    </div>:null}
  </AppShell>
}
