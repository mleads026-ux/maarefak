'use client'

import { use, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, ImagePlus, Phone, PhoneOff, Send, X, Sparkles, Images, Timer, Gamepad2, RefreshCw, Video, Copy, Star, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {calculateStarTransferBreakdown,isApprovedChatMedia,type ChatCallRow,type ChatGiftItem} from '@/lib/chat-room'
import {ChatGiftSheet,ChatPartnerSheet} from '@/components/chat-bottom-sheets'

export default function Chat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const s = useMemo(() => createClient(), [])
  const r = useRouter()

  const [uid, setUid] = useState('')
  const [other, setOther] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [body, setBody] = useState('')
  const [notice, setNotice] = useState('')
  const [incomingCall, setIncomingCall] = useState<ChatCallRow | null>(null)
  const [activeCall, setActiveCall] = useState<ChatCallRow | null>(null)
  const [callLabel, setCallLabel] = useState('')
  const [giftItems, setChatGiftItems] = useState<ChatGiftItem[]>([])
  const [showGifts, setShowGifts] = useState(false)
  const [revealedImages, setRevealedImages] = useState<Set<string>>(new Set())
  const [socialOpen,setSocialOpen]=useState(false)
  const [privateStatus,setPrivateStatus]=useState<any>(null)
  const [privatePhotos,setPrivatePhotos]=useState<any[]>([])
  const [duo,setDuo]=useState<any>(null)
  const [speedSession,setSpeedSession]=useState<string|null>(null)
  const [prompt,setPrompt]=useState('')
  const [partner,setPartner]=useState<any>(null)
  const [showPartner,setShowPartner]=useState(false)
  const [transferStars,setTransferStars]=useState('')
  const [transferRef,setTransferRef]=useState(()=>crypto.randomUUID())
  const [copiedId,setCopiedId]=useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const signalChannelRef = useRef<any>(null)
  const handledSignalsRef = useRef<Set<number>>(new Set())
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([])

  async function load() {
    const { data: { user } } = await s.auth.getUser()

    if (!user) {
      r.push('/login')
      return
    }

    setUid(user.id)

    const { data: members } = await s
      .from('conversation_members')
      .select('user_id,profiles(display_name,avatar_url)')
      .eq('conversation_id', id)

    if (!members?.some((m: any) => m.user_id === user.id)) {
      r.push('/chats')
      return
    }

    const otherMember = (members as any[]).find((m) => m.user_id !== user.id)
    setOther(otherMember)

    const { data: giftRows } = await s
      .from('gift_catalog')
      .select('id,name_ar,emoji,price_stars,animation_tier')
      .eq('active', true)
      .order('price_stars')

    setChatGiftItems((giftRows || []) as any)

    const {data:partnerRow}=await s.rpc('conversation_partner_identity',{p_conversation:id})
    const identity=Array.isArray(partnerRow)?partnerRow[0]:partnerRow
    if(identity)setPartner(identity)

    const { data: ms } = await s
      .from('messages')
      .select('id,body,created_at,sender_id,message_type,media_path,media_duration_seconds,moderation_status,moderation_reason,gift_transaction_id,gift_id,gift_recipient_id')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(300)

    const rows = ms || []

    const withUrls = await Promise.all(
      rows.map(async (m: any) => {
        if (isApprovedChatMedia(m)) {
          const { data } = await s.storage
            .from('chat-media-approved')
            .createSignedUrl(m.media_path, 600)

          return { ...m, signedUrl: data?.signedUrl || null }
        }

        return m
      })
    )

    setMessages(withUrls)

    const { data: call } = await s
      .from('voice_call_sessions')
      .select('*')
      .eq('conversation_id', id)
      .in('status', ['ringing', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (call) {
      if (call.status === 'ringing' && call.callee_id === user.id) {
        setIncomingCall(call as ChatCallRow)
      } else {
        setActiveCall(call as ChatCallRow)
        setCallLabel(
          call.status === 'ringing'
            ? 'جارٍ انتظار موافقة الطرف الآخر...'
            : 'المكالمة متصلة'
        )
      }
    }
  }

  useEffect(() => {
    load()

    const ch = s
      .channel(`chat-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        () => load()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        () => load()
      )
      .subscribe()

    return () => {
      s.removeChannel(ch)
    }
  }, [id])

  async function refreshPartnerIdentity(){
    const {data}=await s.rpc('conversation_partner_identity',{p_conversation:id})
    const row=Array.isArray(data)?data[0]:data
    if(row)setPartner(row)
  }

  useEffect(()=>{
    if(!uid)return
    refreshPartnerIdentity()
    const timer=window.setInterval(refreshPartnerIdentity,30000)
    return()=>window.clearInterval(timer)
  },[uid,id])

  useEffect(() => {
    if (!uid) return

    const ch = s
      .channel(`voice-call-${id}-${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voice_call_sessions',
          filter: `conversation_id=eq.${id}`,
        },
        (payload: any) => handleChatCallRow(payload.new)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'voice_call_sessions',
          filter: `conversation_id=eq.${id}`,
        },
        (payload: any) => handleChatCallRow(payload.new)
      )
      .subscribe()

    return () => {
      s.removeChannel(ch)
    }
  }, [uid, id])

  function handleChatCallRow(row: ChatCallRow) {
    if (row.caller_id !== uid && row.callee_id !== uid) return

    if (row.status === 'ringing') {
      if (row.callee_id === uid) {
        setIncomingCall(row)
      } else {
        setActiveCall(row)
        setCallLabel(row.call_kind==='video'?'جارٍ انتظار موافقة الطرف الآخر على الفيديو...':'جارٍ انتظار موافقة الطرف الآخر على المكالمة الصوتية...')
      }
      return
    }

    if (row.status === 'accepted') {
      setIncomingCall(null)
      setActiveCall(row)
      setCallLabel(row.call_kind==='video'?'مكالمة الفيديو متصلة':'المكالمة الصوتية متصلة')
      return
    }

    if (row.status === 'rejected') {
      cleanupPeer()
      setIncomingCall(null)
      setActiveCall(null)
      setCallLabel('')
      setNotice('تم رفض المكالمة.')
      return
    }

    if (row.status === 'ended' || row.status === 'missed') {
      cleanupPeer()
      setIncomingCall(null)
      setActiveCall(null)
      setCallLabel('')
      setNotice(row.status === 'missed' ? 'لم يتم الرد على المكالمة.' : 'انتهت المكالمة.')
    }
  }

  useEffect(() => {
    if (!activeCall || activeCall.status !== 'accepted' || !uid) return

    let cancelled = false
    const callId = activeCall.id
    const callKind:ChatCallRow['call_kind'] = activeCall.call_kind
    const isCaller = activeCall.caller_id === uid

    async function processSignal(signal: any) {
      const pc = peerRef.current
      if (!pc) return
      if (signal.sender_id === uid) return
      if (handledSignalsRef.current.has(signal.id)) return

      handledSignalsRef.current.add(signal.id)

      if (signal.signal_type === 'offer' && !isCaller) {
        await pc.setRemoteDescription(signal.payload)

        for (const candidate of pendingIceRef.current.splice(0)) {
          await pc.addIceCandidate(candidate).catch(() => {})
        }

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        await s.from('voice_call_signals').insert({
          call_id: callId,
          sender_id: uid,
          signal_type: 'answer',
          payload: answer,
        })
        return
      }

      if (signal.signal_type === 'answer' && isCaller) {
        if (!pc.remoteDescription) {
          await pc.setRemoteDescription(signal.payload)

          for (const candidate of pendingIceRef.current.splice(0)) {
            await pc.addIceCandidate(candidate).catch(() => {})
          }
        }
        return
      }

      if (signal.signal_type === 'ice') {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(signal.payload).catch(() => {})
        } else {
          pendingIceRef.current.push(signal.payload)
        }
      }
    }

    async function beginRtc() {
      cleanupPeer()
      handledSignalsRef.current = new Set()
      pendingIceRef.current = []

      try {
        const isVideo=callKind==='video'
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideo,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        localStreamRef.current = stream
        if(callKind==='video'&&localVideoRef.current){
          localVideoRef.current.srcObject=stream
          localVideoRef.current.muted=true
          localVideoRef.current.play().catch(()=>{})
        }

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        })

        peerRef.current = pc

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream)
        })

        pc.ontrack = (event) => {
          const incoming=event.streams[0]
          if(callKind==='video'&&remoteVideoRef.current){
            remoteVideoRef.current.srcObject=incoming
            remoteVideoRef.current.play().catch(()=>{})
          }else if(remoteAudioRef.current){
            remoteAudioRef.current.srcObject=incoming
            remoteAudioRef.current.play().catch(()=>{})
          }
        }

        pc.onicecandidate = async (event) => {
          if (!event.candidate) return

          await s.from('voice_call_signals').insert({
            call_id: callId,
            sender_id: uid,
            signal_type: 'ice',
            payload: event.candidate.toJSON(),
          })
        }

        const signalChannel = s
          .channel(`voice-signal-${callId}-${uid}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'voice_call_signals',
              filter: `call_id=eq.${callId}`,
            },
            async (payload: any) => {
              await processSignal(payload.new)
            }
          )
          .subscribe()

        signalChannelRef.current = signalChannel

        const { data: existing } = await s
          .from('voice_call_signals')
          .select('*')
          .eq('call_id', callId)
          .order('id', { ascending: true })

        for (const signal of existing || []) {
          await processSignal(signal)
        }

        if (isCaller && !pc.localDescription) {
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)

          await s.from('voice_call_signals').insert({
            call_id: callId,
            sender_id: uid,
            signal_type: 'offer',
            payload: offer,
          })
        }
      } catch {
        setNotice(callKind==='video'
          ? 'تعذر تشغيل الكاميرا أو الميكروفون. اسمح بالوصول ثم حاول مرة أخرى.'
          : 'تعذر تشغيل الميكروفون. اسمح للموقع باستخدام الميكروفون وحاول مرة أخرى.')
      }
    }

    beginRtc()

    return () => {
      cancelled = true
      cleanupPeer()
    }
  }, [activeCall?.id, activeCall?.status, uid])

  function cleanupPeer() {
    if (signalChannelRef.current) {
      s.removeChannel(signalChannelRef.current)
      signalChannelRef.current = null
    }

    peerRef.current?.close()
    peerRef.current = null

    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }
    if(localVideoRef.current)localVideoRef.current.srcObject=null
    if(remoteVideoRef.current)remoteVideoRef.current.srcObject=null
  }

  async function copyPartnerId(){
    if(!partner?.public_user_id)return
    try{
      await navigator.clipboard.writeText(partner.public_user_id)
      setCopiedId(true)
      setTimeout(()=>setCopiedId(false),1400)
    }catch{
      setNotice('تعذر نسخ الـID.')
    }
  }

  async function sendStarsToPartner(){
    const amount=Number(transferStars)
    if(!partner?.public_user_id||!Number.isInteger(amount)||amount<1)return
    const {error}=await s.rpc('transfer_stars_by_user_id',{
      p_public_user_id:partner.public_user_id,
      p_amount:amount,
      p_client_reference_id:transferRef
    })
    if(error){
      setNotice(error.message.includes('insufficient_stars')?'رصيد النجوم غير كافٍ.':'تعذر إرسال النجوم.')
      return
    }
    const fee=Math.ceil(amount*0.15)
    setNotice(`تم إرسال ${amount} ⭐ — وصل للطرف الآخر ${amount-fee} ⭐ بعد عمولة التطبيق 15%.`)
    setTransferStars('')
    setTransferRef(crypto.randomUUID())
    setShowPartner(false)
  }

  async function loadSocialTools(){
    const target=other?.user_id;if(!target)return;setSocialOpen(true)
    const {data}=await s.rpc('private_photo_reveal_status',{p_target:target});setPrivateStatus(Array.isArray(data)?data[0]:data)
    const {data:photos}=await s.rpc('mutually_revealed_private_photos',{p_target:target});setPrivatePhotos(photos||[])
  }
  async function privateConsent(){const target=other?.user_id;if(!target)return;const {data,error}=await s.rpc('set_private_photo_reveal_consent',{p_target:target,p_consent:true});if(error)setNotice('تعذر تحديث الموافقة.');else{setNotice(data?'الموافقة متبادلة ويمكن عرض الصور الخاصة.':'تم تسجيل موافقتك وفي انتظار الطرف الآخر.');await loadSocialTools()}}
  async function speedIntro(){const target=other?.user_id;if(!target)return;const {data,error}=await s.rpc('request_speed_intro',{p_target:target});if(error)setNotice('تعذر إرسال طلب دقيقة التعارف.');else{setSpeedSession(data);setNotice('تم إرسال طلب دقيقة التعارف للطرف الآخر.')}}
  async function startDuo(){const {data,error}=await s.rpc('start_duo_challenge_v2',{p_conversation:id});if(error)setNotice('تعذر بدء تحدي الثنائي.');else{setDuo(data);setNotice('بدأ تحدي الثنائي — 5 أسئلة بدون درجة توافق.')}}
  async function surprise(kind:'surprise'|'restart'){const fn=kind==='surprise'?'conversation_surprise_prompt':'smart_restart_prompt';const {data,error}=await s.rpc(fn,{p_conversation:id});if(error)setNotice('تعذر تجهيز السؤال الآن.');else setPrompt(String(data||''))}
  async function send() {
    const text = body.trim()
    if (!text) return

    setBody('')

    const { data:row,error } = await s.from('messages').insert({
      conversation_id: id,
      sender_id: uid,
      body: text,
      message_type:'text',
    }).select('id,body,created_at,sender_id,message_type,media_path,media_duration_seconds,moderation_status,moderation_reason,gift_transaction_id,gift_id,gift_recipient_id').single()

    if (error) {
      setNotice('لا يمكن إرسال الرسالة الآن.')
      setBody(text)
      return
    }

    if(row){
      setMessages(current=>current.some((x:any)=>x.id===row.id)?current:[...current,row])
    }
  }

  async function sendGift(gift: ChatGiftItem) {
    const targetId = other?.user_id
    if (!targetId) return

    setNotice('')

    const { error } = await s.rpc('send_gift', {
      p_target: targetId,
      p_gift: gift.id,
      p_conversation: id,
    })

    if (error) {
      setNotice(
        error.message.includes('insufficient_stars')
          ? 'رصيد النجوم غير كافٍ لإرسال الهدية.'
          : 'تعذر إرسال الهدية.'
      )
      return
    }

    setNotice(
      `تم إرسال ${gift.emoji} ${gift.name_ar}. يصل للطرف الآخر 85% من قيمة النجوم والمنصة تحتفظ بـ15%.`
    )
    setShowGifts(false)
    await load()
  }

  async function startCall(kind:'voice'|'video') {
    setNotice('')

    const { data, error } = await s.rpc('request_chat_call', {
      p_conversation: id,
      p_kind: kind,
    })

    if (error) {
      setNotice(kind==='video'?'تعذر بدء مكالمة الفيديو الآن.':'تعذر بدء المكالمة الصوتية الآن.')
      return
    }

    const { data: row } = await s
      .from('voice_call_sessions')
      .select('*')
      .eq('id', data)
      .single()

    if (row) {
      setActiveCall(row as ChatCallRow)
      setCallLabel(kind==='video'?'جارٍ انتظار موافقة الطرف الآخر على الفيديو...':'جارٍ انتظار موافقة الطرف الآخر على المكالمة الصوتية...')
    }
  }

  async function respondToCall(accept: boolean) {
    if (!incomingCall) return

    await s.rpc('respond_voice_call', {
      p_call: incomingCall.id,
      p_accept: accept,
    })

    if (!accept) {
      setIncomingCall(null)
      return
    }

    const { data: row } = await s
      .from('voice_call_sessions')
      .select('*')
      .eq('id', incomingCall.id)
      .single()

    if (row) {
      setIncomingCall(null)
      setActiveCall(row as ChatCallRow)
      setCallLabel((row as ChatCallRow).call_kind==='video'?'مكالمة الفيديو متصلة':'المكالمة الصوتية متصلة')
    }
  }

  async function endCall() {
    if (!activeCall) return

    await s.rpc('end_voice_call', {
      p_call: activeCall.id,
    })

    cleanupPeer()
    setActiveCall(null)
    setCallLabel('')
  }

  async function readVideoDuration(file:File){
    return await new Promise<number>((resolve,reject)=>{
      const url=URL.createObjectURL(file)
      const video=document.createElement('video')
      video.preload='metadata'
      video.onloadedmetadata=()=>{
        const duration=Number(video.duration||0)
        URL.revokeObjectURL(url)
        resolve(duration)
      }
      video.onerror=()=>{
        URL.revokeObjectURL(url)
        reject(new Error('invalid_video'))
      }
      video.src=url
    })
  }

  async function uploadMedia(file: File) {
    setNotice('')

    const imageTypes=['image/jpeg','image/png','image/webp']
    const videoTypes=['video/mp4','video/webm','video/quicktime']
    const isImage=imageTypes.includes(file.type)
    const isVideo=videoTypes.includes(file.type)

    if(!isImage&&!isVideo){
      setNotice('المسموح صورة JPG/PNG/WEBP أو فيديو MP4/MOV/WEBM.')
      return
    }

    if(file.size>25*1024*1024){
      setNotice('حجم الملف يجب ألا يتجاوز 25MB.')
      return
    }

    let duration:number|null=null
    if(isVideo){
      try{duration=await readVideoDuration(file)}catch{
        setNotice('تعذر قراءة مدة الفيديو.')
        return
      }
      if(!duration||duration>10.05){
        setNotice('الفيديو يجب ألا يتجاوز 10 ثوانٍ.')
        return
      }
    }

    const ext=file.name.split('.').pop()?.toLowerCase()||(isVideo?'mp4':'jpg')
    const path=`${id}/${uid}/${crypto.randomUUID()}.${ext}`

    const {error:uploadError}=await s.storage
      .from('chat-media-approved')
      .upload(path,file,{upsert:false,contentType:file.type})

    if(uploadError){
      setNotice(isVideo?'تعذر رفع الفيديو.':'تعذر رفع الصورة.')
      return
    }

    const {error}=await s.rpc('create_media_message',{
      p_conversation:id,
      p_media_path:path,
      p_kind:isVideo?'video':'image',
      p_duration_seconds:duration,
    })

    if(error){
      setNotice(isVideo?'تعذر إرسال الفيديو.':'تعذر إرسال الصورة.')
      return
    }

    setNotice(isVideo?'تم إرسال الفيديو.':'تم إرسال الصورة. ستظهر للطرف الآخر مموهة حتى يختار إظهارها.')
    await load()
  }

  const visibleMessages = messages

  function revealImage(messageId: string) {
    setRevealedImages((current) => {
      const next = new Set(current)
      next.add(messageId)
      return next
    })
  }

  function hideImage(messageId: string) {
    setRevealedImages((current) => {
      const next = new Set(current)
      next.delete(messageId)
      return next
    })
  }

  const {
    gross:transferGross,
    fee:transferFee,
    net:transferNet,
  }=calculateStarTransferBreakdown(transferStars)

  return (
    <AppShell>
      <PageHeader title={other?.profiles?.display_name || 'الحوار'} />

      <audio ref={remoteAudioRef} autoPlay />

      {activeCall?.status==='accepted'&&activeCall.call_kind==='video'?<div className="fixed inset-0 z-[160] bg-[#07111f]">
        <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover"/>
        <video ref={localVideoRef} autoPlay playsInline muted className="absolute right-4 top-[max(24px,env(safe-area-inset-top))] h-40 w-28 rounded-[22px] border-2 border-white/70 bg-black object-cover shadow-2xl"/>
        <div className="absolute bottom-[max(38px,env(safe-area-inset-bottom))] left-0 right-0 flex justify-center">
          <button onClick={endCall} className="tap-action flex items-center gap-2 rounded-full bg-[#ef3356] px-6 py-3 text-sm font-black text-white"><PhoneOff size={19}/> إنهاء الفيديو</button>
        </div>
      </div>:null}

      <main className="flex min-h-[calc(100vh-160px)] flex-col p-4">
        <button onClick={()=>setShowPartner(true)} className="tap-action mb-3 flex items-center gap-3 rounded-[24px] bg-white p-3 text-right shadow-sm ring-1 ring-[#dfe9f5]">
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#eaf3fb]">
            {partner?.avatar_url||other?.profiles?.avatar_url?<img src={partner?.avatar_url||other?.profiles?.avatar_url} alt="" className="h-full w-full object-cover"/>:<span className="grid h-full w-full place-items-center font-black text-[#1768f4]">{(partner?.display_name||other?.profiles?.display_name||'م')[0]}</span>}
            <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-white ${partner?.is_online?'bg-[#12d79d]':'bg-slate-400'}`}/>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-black">{partner?.display_name||other?.profiles?.display_name||'المستخدم'}</span>
            <span className={`mt-0.5 block text-[10px] font-black ${partner?.is_online?'text-[#159a70]':'text-[#7d8798]'}`}>{partner?.is_online?'متصل':'غير متصل'}</span>
          </span>
          <UserRound size={20} className="text-[#1768f4]"/>
        </button>

        <div className="mb-3">
          <p className="mb-2 truncate text-center text-xs font-bold text-[#1560BD]">{callLabel || 'المكالمات تبدأ فقط بعد قبول الطرف الآخر'}</p>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={()=>setShowGifts(true)}><Gift size={15}/> هدية</Button>
            {activeCall
              ? <Button size="sm" variant="outline" className="gap-1 text-red-600" onClick={endCall}><PhoneOff size={15}/> إنهاء</Button>
              : <Button size="sm" variant="outline" className="gap-1" onClick={()=>startCall('voice')}><Phone size={15}/> صوتي</Button>}
            {!activeCall
              ? <Button size="sm" variant="outline" className="gap-1" onClick={()=>startCall('video')}><Video size={15}/> فيديو</Button>
              : <Button size="sm" variant="outline" disabled className="gap-1"><Video size={15}/> فيديو</Button>}
          </div>
        </div>

        <div className="mb-3 grid grid-cols-4 gap-2">
          <Button size="sm" variant="outline" onClick={loadSocialTools}><Images size={15}/> صور خاصة</Button>
          <Button size="sm" variant="outline" onClick={speedIntro}><Timer size={15}/> دقيقة تعارف</Button>
          <Button size="sm" variant="outline" onClick={startDuo}><Gamepad2 size={15}/> تحدي</Button>
          <Button size="sm" variant="outline" onClick={()=>surprise('surprise')}><Sparkles size={15}/> مفاجأة</Button>
        </div>
        {prompt?<div className="mb-3 rounded-2xl border border-[#DCE8F7] bg-[#EAF2FC] p-3"><p className="text-xs font-bold text-[#1560BD]">اقتراح للكلام</p><p className="mt-1 text-sm font-extrabold">{prompt}</p><Button className="mt-2" size="sm" variant="secondary" onClick={()=>surprise('restart')}><RefreshCw size={14}/> اقتراح آخر</Button></div>:null}
        {socialOpen?<div className="mb-3 rounded-3xl border border-[#DCE8F7] bg-white p-3"><div className="flex items-center justify-between"><div><p className="font-extrabold">الصور الخاصة</p><p className="text-xs text-slate-500">لا تظهر إلا بعد موافقة الطرفين.</p></div><Button size="sm" onClick={privateConsent} disabled={privateStatus?.mutual}>{privateStatus?.mutual?'الموافقة متبادلة ✓':privateStatus?.my_consented?'في انتظار الطرف الآخر':'أوافق على المشاركة'}</Button></div>{privatePhotos.length?<div className="mt-3 grid grid-cols-3 gap-2">{privatePhotos.map((p:any)=><div key={p.photo_id} className="grid aspect-square place-items-center rounded-2xl bg-[#EAF2FC] text-xs font-bold text-[#1560BD]">صورة خاصة ✓</div>)}</div>:<p className="mt-3 text-xs text-slate-500">{privateStatus?.target_has_photos?'لديه صور خاصة؛ ستظهر بعد اكتمال الموافقة.':'لا توجد صور خاصة متاحة حاليًا.'}</p>}</div>:null}
        {duo?<div className="mb-3 rounded-2xl bg-[#F4F8FD] p-3 text-sm font-bold">تحدي الثنائي نشط 🎮 — أجبوا عن 5 أسئلة للتعارف، بدون تقييم أو نسبة توافق.</div>:null}
        {speedSession?<div className="mb-3 rounded-2xl bg-[#F4F8FD] p-3 text-sm font-bold">طلب دقيقة التعارف مرسل ⏱️ — يبدأ فقط بعد موافقة الطرف الآخر.</div>:null}
        {incomingCall ? (
          <div className="mb-4 rounded-3xl border border-[#D7E7FB] bg-[#EAF2FC] p-4">
            <p className="flex items-center gap-2 font-extrabold">
              {incomingCall.call_kind==='video'?<Video size={18}/>:<Phone size={18}/>}
              {other?.profiles?.display_name || 'الطرف الآخر'} يتصل بك {incomingCall.call_kind==='video'?'بالفيديو':'صوتيًا'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              لن تبدأ المكالمة إلا بعد موافقتك.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button onClick={() => respondToCall(true)}>
                <Phone size={16} className="ml-2" />
                قبول
              </Button>

              <Button
                variant="outline"
                onClick={() => respondToCall(false)}
              >
                <X size={16} className="ml-2" />
                رفض
              </Button>
            </div>
          </div>
        ) : null}

        {notice ? (
          <p className="mb-3 rounded-2xl bg-slate-100 p-3 text-xs font-bold text-slate-600">
            {notice}
          </p>
        ) : null}

        <div className="flex-1 space-y-2 pb-4">
          {visibleMessages.map((m: any) => (
            <div
              key={m.id}
              className={
                m.message_type==='gift'
                  ? 'mx-auto max-w-[92%] rounded-3xl bg-[linear-gradient(135deg,#fff0a8,#fff8df)] px-4 py-3 text-[#6f4c00] shadow-sm ring-1 ring-[#efd36f]'
                  : m.sender_id === uid
                    ? 'mr-auto max-w-[82%] rounded-3xl rounded-br-lg bg-[#1560BD] px-4 py-3 text-white'
                    : 'ml-auto max-w-[82%] rounded-3xl rounded-bl-lg bg-white px-4 py-3 shadow-sm'
              }
            >
              {m.message_type === 'image' ? (
                m.signedUrl ? (
                  m.sender_id === uid || revealedImages.has(m.id) ? (
                    <div className="space-y-2">
                      <img
                        src={m.signedUrl}
                        alt="صورة داخل المحادثة"
                        className="max-h-80 w-full rounded-2xl object-cover"
                      />
                      {m.sender_id !== uid ? (
                        <button
                          type="button"
                          onClick={() => hideImage(m.id)}
                          className="text-xs font-bold underline underline-offset-4"
                        >
                          إخفاء الصورة
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="relative overflow-hidden rounded-2xl">
                      <img
                        src={m.signedUrl}
                        alt="صورة مموهة"
                        className="max-h-80 w-full scale-110 rounded-2xl object-cover blur-2xl"
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/30 p-4 text-center text-white">
                        <p className="text-sm font-extrabold">صورة مخفية</p>
                        <p className="mt-1 text-xs text-white/90">
                          اختَر بنفسك إذا كنت تريد رؤية الصورة.
                        </p>
                        <button
                          type="button"
                          onClick={() => revealImage(m.id)}
                          className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-slate-900"
                        >
                          إظهار الصورة
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <p className="text-sm">تعذر تحميل الصورة.</p>
                )
              ) : m.message_type === 'video' ? (
                m.signedUrl ? (
                  <video src={m.signedUrl} controls playsInline preload="metadata" className="max-h-80 w-full rounded-2xl bg-black object-contain"/>
                ) : (
                  <p className="text-sm">تعذر تحميل الفيديو.</p>
                )
              ) : m.message_type === 'gift' ? (
                <div className="text-center"><Gift className="mx-auto mb-1 text-[#b77900]" size={22}/><p className="text-sm font-black leading-6">{m.body}</p></div>
              ) : (
                <p className="text-sm leading-6">{m.body}</p>
              )}

              <p
                className={
                  m.sender_id === uid
                    ? 'mt-1 text-[10px] text-[#D7E7FB]'
                    : 'mt-1 text-[10px] text-slate-400'
                }
              >
                {new Date(m.created_at).toLocaleTimeString('ar-EG', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) uploadMedia(file)
            e.currentTarget.value = ''
          }}
        />

        <div className="sticky bottom-20 flex gap-2 rounded-3xl border border-slate-200 bg-white p-2">
          <Button
            size="icon"
            variant="ghost"
            aria-label="إرسال هدية"
            onClick={()=>setShowGifts(true)}
            className="text-[#a76500]"
          >
            <Gift size={19}/>
          </Button>

          <Button
            size="icon"
            variant="ghost"
            aria-label="إرسال صورة أو فيديو حتى 10 ثواني"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={19} />
          </Button>

          <Input
            placeholder="اكتب رسالة..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
          />

          <Button size="icon" onClick={send}>
            <Send size={18} />
          </Button>
        </div>
      </main>

      <ChatPartnerSheet
        open={showPartner}
        partner={partner}
        copiedId={copiedId}
        transferStars={transferStars}
        transferGross={transferGross}
        transferFee={transferFee}
        transferNet={transferNet}
        onClose={()=>setShowPartner(false)}
        onCopy={copyPartnerId}
        onChangeTransfer={setTransferStars}
        onSendStars={sendStarsToPartner}
      />

      <ChatGiftSheet
        open={showGifts}
        gifts={giftItems}
        onClose={()=>setShowGifts(false)}
        onSend={sendGift}
      />
    </AppShell>
  )
}
