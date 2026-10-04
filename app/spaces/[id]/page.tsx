'use client'

import { use, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Gift,
  Mic,
  MicOff,
  PhoneCall,
  Send,
  Star,
  Users,
  X,
  Crown,
  Armchair,
  Sparkles,
  UserRoundPlus,
  Shield,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VoiceGlowBar } from '@/components/voice-glow-bar'

type Member = {
  user_id: string
  role: string
  profiles: {
    display_name: string | null
    avatar_url: string | null
    mood: string | null
  } | null
}

type VoiceParticipant = {
  user_id: string
  mic_enabled: boolean
  profiles: {
    display_name: string | null
    avatar_url: string | null
  } | null
}

type GiftItem = {
  id: string
  name_ar: string
  emoji: string
  price_stars: number
}

export default function SpaceChat({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const s = useMemo(() => createClient(), [])
  const r = useRouter()

  const [space, setSpace] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [voiceMembers, setVoiceMembers] = useState<VoiceParticipant[]>([])
  const [gifts, setGifts] = useState<GiftItem[]>([])
  const [privateContactPrice, setPrivateContactPrice] = useState(20)
  const [uid, setUid] = useState('')
  const [body, setBody] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [showGifts, setShowGifts] = useState(false)
  const [notice, setNotice] = useState('')
  const [inVoice, setInVoice] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [seats,setSeats]=useState<any[]>([])
  const [queue,setQueue]=useState<any[]>([])
  const [starRequests,setStarRequests]=useState<any[]>([])
  const [spotlight,setSpotlight]=useState<any>(null)
  const [isHost,setIsHost]=useState(false)
  const [voiceStreams,setVoiceStreams]=useState<MediaStream[]>([])

  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const peerStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const voiceChannelRef = useRef<any>(null)

  async function load() {
    const { data: { user } } = await s.auth.getUser()

    if (!user) {
      r.push('/login')
      return
    }

    setUid(user.id)

    const { data: member } = await s
      .from('space_members')
      .select('role')
      .eq('space_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!member) {
      r.push('/spaces')
      return
    }

    const [
      { data: sp },
      { data: ms },
      { data: memberRows },
      { data: voiceRows },
      { data: giftRows },
      { data: priceRow },
    ] = await Promise.all([
      s.from('spaces')
        .select('id,name,emoji,is_public,owner_id,seat_count')
        .eq('id', id)
        .single(),

      s.from('space_messages')
        .select('id,body,created_at,sender_id,profiles!space_messages_sender_id_fkey(display_name,avatar_url)')
        .eq('space_id', id)
        .order('created_at', { ascending: true })
        .limit(200),

      s.from('space_members')
        .select('user_id,role,profiles(display_name,avatar_url,mood)')
        .eq('space_id', id),

      s.from('space_voice_participants')
        .select('user_id,mic_enabled,profiles(display_name,avatar_url)')
        .eq('space_id', id),

      s.from('gift_catalog')
        .select('id,name_ar,emoji,price_stars')
        .eq('active', true)
        .order('sort_order'),

      s.from('feature_prices')
        .select('price_stars')
        .eq('key', 'private_contact_from_lamma')
        .maybeSingle(),
    ])

    setSpace(sp)
    setMessages(ms || [])
    setMembers((memberRows || []) as any)
    setVoiceMembers((voiceRows || []) as any)
    setGifts((giftRows || []) as any)
    if (priceRow?.price_stars != null) {
      setPrivateContactPrice(Number(priceRow.price_stars))
    }

    setInVoice(!!voiceRows?.some((x: any) => x.user_id === user.id))
    setIsHost(sp?.owner_id===user.id)
    const [{data:seatRows},{data:queueRows},{data:reqRows},{data:spotRows}]=await Promise.all([
      s.from('space_seats').select('space_id,seat_no,user_id,seat_type,profiles(display_name,avatar_url)').eq('space_id',id).order('seat_no'),
      s.from('space_mic_queue').select('space_id,user_id,joined_at,profiles(display_name,avatar_url)').eq('space_id',id).order('joined_at'),
      s.from('space_star_seat_requests').select('id,requester_id,cost_stars,status,profiles!space_star_seat_requests_requester_id_fkey(display_name,avatar_url)').eq('space_id',id).eq('status','pending').order('created_at'),
      s.from('space_pair_spotlights').select('*').eq('space_id',id).eq('status','active').order('started_at',{ascending:false}).limit(1).maybeSingle()
    ]);setSeats(seatRows||[]);setQueue(queueRows||[]);setStarRequests(reqRows||[]);setSpotlight(spotRows||null)
  }

  useEffect(() => {
    load()

    const chatChannel = s
      .channel(`space-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'space_messages',
          filter: `space_id=eq.${id}`,
        },
        () => load()
      )
      .subscribe()

    return () => {
      s.removeChannel(chatChannel)
      cleanupVoice()
    }
  }, [id])

  async function joinQueue(){const {error}=await s.rpc('join_mic_queue',{p_space:id});setNotice(error?'تعذر دخول قائمة الميكروفون.':'تمت إضافتك لقائمة انتظار الميكروفون.');await load()}
  async function leaveSeat(){const {error}=await s.rpc('leave_lamma_seat',{p_space:id});setNotice(error?'تعذر مغادرة المقعد.':'غادرت المقعد.');await load()}
  async function starSeat(){const {error}=await s.rpc('request_star_seat',{p_space:id});setNotice(error?(error.message.includes('insufficient_stars')?'رصيد النجوم غير كافٍ.':'تعذر طلب المقعد الملكي.'):'تم إرسال طلب المقعد الملكي للمضيف 👑');await load()}
  async function seatNext(n:number){const {error}=await s.rpc('host_seat_next_from_queue',{p_space:id,p_seat_no:n});setNotice(error?'تعذر إجلاس العضو.':'تم نقل العضو التالي للمقعد.');await load()}
  async function starDecision(req:string,ok:boolean){const {error}=await s.rpc('respond_star_seat_request',{p_request:req,p_accept:ok});setNotice(error?'تعذر تنفيذ القرار.':ok?'تم قبول المقعد الملكي.':'تم رفض الطلب.');await load()}
  async function mystery(enabled:boolean){const {error}=await s.rpc('set_mystery_guest',{p_space:id,p_enabled:enabled});setNotice(error?'تعذر تغيير وضع الضيف الغامض.':enabled?'تم تفعيل الضيف الغامض.':'تم إيقاف الضيف الغامض.')}
  async function revealMystery(){const {error}=await s.rpc('reveal_mystery_guest',{p_space:id});setNotice(error?'تعذر كشف الضيف الآن.':'تم كشف الضيف الغامض 🎭')}
  async function startSpot(){const picks=members.filter(x=>x.user_id!==uid).slice(0,2);if(picks.length<2){setNotice('يلزم عضوان على الأقل.');return}const {error}=await s.rpc('start_lamma_pair_spotlight',{p_space:id,p_user_a:picks[0].user_id,p_user_b:picks[1].user_id});setNotice(error?'تعذر بدء التحدي الثنائي.':'بدأ التحدي الثنائي لمدة محدودة ✨');await load()}
  async function endSpot(){const {error}=await s.rpc('end_lamma_pair_spotlight',{p_space:id});setNotice(error?'تعذر إنهاء التحدي.':'تم إنهاء التحدي.');await load()}
  async function moderate(target:string,action:string){const {error}=await s.rpc('host_moderate_lamma_member',{p_space:id,p_target:target,p_action:action,p_duration_minutes:action==='mute'?10:null,p_reason:'إجراء إدارة من المضيف'});setNotice(error?'تعذر تنفيذ إجراء الإدارة.':'تم تنفيذ إجراء المضيف.');await load()}
  async function send() {
    const text = body.trim()
    if (!text) return

    setBody('')

    await s.from('space_messages').insert({
      space_id: id,
      sender_id: uid,
      body: text,
    })
  }

  async function requestPrivateContact(member: Member) {
    setNotice('')

    const { error } = await s.rpc('request_private_contact_from_space', {
      p_space: id,
      p_target: member.user_id,
      p_message: null,
    })

    if (error) {
      if (error.message.includes('insufficient_stars')) {
        setNotice('رصيد النجوم غير كافٍ.')
      } else if (error.message.includes('already_connected')) {
        setNotice('أنتم بالفعل متصلون في كلامنا.')
      } else if (error.message.includes('target_not_accepting_requests')) {
        setNotice('هذا المستخدم لا يستقبل طلبات تواصل حاليًا.')
      } else {
        setNotice('تعذر إرسال طلب التواصل.')
      }
      return
    }

    setNotice(
      `تم خصم ${privateContactPrice} نجمة وإرسال طلب تواصل خاص. لن يفتح الشات إلا بعد موافقة الطرف الآخر.`
    )
    setSelectedMember(null)
  }

  async function sendGift(gift: GiftItem) {
    if (!selectedMember) return

    setNotice('')

    const { error } = await s.rpc('send_gift', {
      p_target: selectedMember.user_id,
      p_gift: gift.id,
      p_space: id,
    })

    if (error) {
      if (error.message.includes('insufficient_stars')) {
        setNotice('رصيد النجوم غير كافٍ لإرسال الهدية.')
      } else {
        setNotice('تعذر إرسال الهدية.')
      }
      return
    }

    setNotice(
      `تم إرسال ${gift.emoji} ${gift.name_ar}. المنصة تحتفظ بـ15% ويصل للمستلم 85% من قيمة النجوم.`
    )
    setShowGifts(false)
    setSelectedMember(null)
  }

  async function joinVoice() {
    if (inVoice) return

    setNotice('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })

      localStreamRef.current = stream
      setVoiceStreams([stream])

      const { error } = await s.rpc('enter_lamma_voice', {
        p_space: id,
      })

      if (error) {
        stream.getTracks().forEach((t) => t.stop())
        localStreamRef.current = null
        setVoiceStreams([])
        setNotice('تعذر دخول الصوت.')
        return
      }

      setInVoice(true)
      setMicEnabled(true)
      await startVoiceRealtime()
      await refreshVoiceMembers()
    } catch {
      setNotice('اسمح للموقع باستخدام الميكروفون ثم حاول مرة أخرى.')
    }
  }

  async function leaveVoice() {
    await s.rpc('leave_lamma_voice', { p_space: id })
    cleanupVoice()
    setVoiceStreams([])
    setInVoice(false)
    setVoiceMembers((current) => current.filter((x) => x.user_id !== uid))
  }

  async function toggleMic() {
    const next = !micEnabled

    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next
    })

    await s.rpc('set_lamma_mic', {
      p_space: id,
      p_enabled: next,
    })

    setMicEnabled(next)
  }

  async function refreshVoiceMembers() {
    const { data } = await s
      .from('space_voice_participants')
      .select('user_id,mic_enabled,profiles(display_name,avatar_url)')
      .eq('space_id', id)

    const rows = (data || []) as any
    setVoiceMembers(rows)

    for (const participant of rows) {
      if (participant.user_id === uid) continue

      if (uid < participant.user_id) {
        await makeOffer(participant.user_id)
      } else {
        ensurePeer(participant.user_id)
      }
    }
  }

  async function startVoiceRealtime() {
    if (voiceChannelRef.current) return

    const channel = s
      .channel(`lamma-voice-${id}-${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'space_voice_participants',
          filter: `space_id=eq.${id}`,
        },
        async (payload: any) => {
          await refreshVoiceMembers()

          if (payload.eventType === 'DELETE') {
            const peerId = payload.old.user_id
            closePeer(peerId)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'space_voice_signals',
          filter: `space_id=eq.${id}`,
        },
        async (payload: any) => {
          const signal = payload.new
          if (signal.target_id !== uid) return
          await handleSignal(signal)
        }
      )
      .subscribe()

    voiceChannelRef.current = channel
  }

  function ensurePeer(peerId: string) {
    const existing = peersRef.current.get(peerId)
    if (existing) return existing

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!)
    })

    pc.onicecandidate = async (event) => {
      if (!event.candidate) return

      await s.from('space_voice_signals').insert({
        space_id: id,
        sender_id: uid,
        target_id: peerId,
        signal_type: 'ice',
        payload: event.candidate.toJSON(),
      })
    }

    pc.ontrack = (event) => {
      let audio = audiosRef.current.get(peerId)

      if (!audio) {
        audio = new Audio()
        audio.autoplay = true
        audiosRef.current.set(peerId, audio)
      }

      const incoming=event.streams[0]
      peerStreamsRef.current.set(peerId,incoming)
      setVoiceStreams((current)=>current.some((x)=>x.id===incoming.id)?current:[...current,incoming])
      audio.srcObject = incoming
      audio.play().catch(() => {})
    }

    peersRef.current.set(peerId, pc)
    return pc
  }

  async function makeOffer(peerId: string) {
    const pc = ensurePeer(peerId)

    if (pc.signalingState !== 'stable' || pc.localDescription) return

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    await s.from('space_voice_signals').insert({
      space_id: id,
      sender_id: uid,
      target_id: peerId,
      signal_type: 'offer',
      payload: offer,
    })
  }

  async function handleSignal(signal: any) {
    const peerId = signal.sender_id
    const pc = ensurePeer(peerId)

    if (signal.signal_type === 'offer') {
      await pc.setRemoteDescription(signal.payload)

      const queue = pendingIceRef.current.get(peerId) || []
      for (const candidate of queue) {
        await pc.addIceCandidate(candidate).catch(() => {})
      }
      pendingIceRef.current.delete(peerId)

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      await s.from('space_voice_signals').insert({
        space_id: id,
        sender_id: uid,
        target_id: peerId,
        signal_type: 'answer',
        payload: answer,
      })

      return
    }

    if (signal.signal_type === 'answer') {
      if (!pc.remoteDescription) {
        await pc.setRemoteDescription(signal.payload)
      }
      return
    }

    if (signal.signal_type === 'ice') {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(signal.payload).catch(() => {})
      } else {
        const queue = pendingIceRef.current.get(peerId) || []
        queue.push(signal.payload)
        pendingIceRef.current.set(peerId, queue)
      }
    }
  }

  function closePeer(peerId: string) {
    peersRef.current.get(peerId)?.close()
    peersRef.current.delete(peerId)

    const audio = audiosRef.current.get(peerId)
    if (audio) {
      audio.pause()
      audio.srcObject = null
    }
    audiosRef.current.delete(peerId)

    const stream=peerStreamsRef.current.get(peerId)
    if(stream){
      peerStreamsRef.current.delete(peerId)
      setVoiceStreams((current)=>current.filter((x)=>x.id!==stream.id))
    }

    pendingIceRef.current.delete(peerId)
  }

  function cleanupVoice() {
    if (voiceChannelRef.current) {
      s.removeChannel(voiceChannelRef.current)
      voiceChannelRef.current = null
    }

    peersRef.current.forEach((pc) => pc.close())
    peersRef.current.clear()

    audiosRef.current.forEach((audio) => {
      audio.pause()
      audio.srcObject = null
    })
    audiosRef.current.clear()
    peerStreamsRef.current.clear()

    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    pendingIceRef.current.clear()
  }

  return (
    <AppShell>
      <PageHeader
        title={space ? `${space.emoji || '🎙️'} ${space.name}` : 'اللَمّة'}
      />

      <main className="flex min-h-[calc(100vh-160px)] flex-col p-4">
        {notice ? (
          <p className="mb-3 rounded-2xl bg-[#EAF2FC] p-3 text-xs font-bold text-[#1560BD]">
            {notice}
          </p>
        ) : null}

        <section className="glow-card-surface living-card living-card--violet mb-4 rounded-3xl bg-gradient-to-br from-[#1560BD] to-[#0D3D78] p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-[#D7E7FB]">الصوت الجماعي</p>
              <p className="mt-1 font-extrabold">
                {voiceMembers.length} متواجد بالصوت
              </p>
            </div>

            {!inVoice ? (
              <Button
                className="bg-white text-[#1560BD] hover:bg-[#EAF2FC]"
                onClick={joinVoice}
              >
                <PhoneCall size={16} />
                انضم للصوت
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="icon"
                  className="bg-white/15 text-white hover:bg-white/25"
                  onClick={toggleMic}
                >
                  {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                </Button>

                <Button
                  size="sm"
                  variant="danger"
                  onClick={leaveVoice}
                >
                  خروج
                </Button>
              </div>
            )}
          </div>

          <VoiceGlowBar streams={voiceStreams} active={inVoice||voiceMembers.length>0}/>

          {voiceMembers.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {voiceMembers.map((m) => (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => {
                    const full = members.find((x) => x.user_id === m.user_id)
                    if (full && full.user_id !== uid) setSelectedMember(full)
                  }}
                  className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-bold"
                >
                  {m.mic_enabled ? <Mic size={13} /> : <MicOff size={13} />}
                  {m.profiles?.display_name || 'عضو'}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mb-4 rounded-3xl border border-[#DCE8F7] bg-white p-4">
          <div className="flex items-center justify-between"><div><p className="font-extrabold">مقاعد اللَمّة</p><p className="text-xs text-slate-500">المنصة · حتى {space?.seat_count||8} مقاعد</p></div><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={joinQueue}><Mic size={14}/> اطلب المايك</Button><Button size="sm" variant="outline" onClick={starSeat}><Crown size={14}/> المقعد الملكي</Button></div></div>
          <div className="mt-3 grid grid-cols-4 gap-2">{Array.from({length:Math.min(Number(space?.seat_count||8),8)},(_,i)=>i+1).map(n=>{const seat=seats.find(x=>x.seat_no===n);return <button key={n} onClick={()=>isHost&&!seat&&seatNext(n)} className={seat?.seat_type==='star'?'rounded-2xl border border-amber-300 bg-amber-50 p-3 text-center':'rounded-2xl bg-[#F4F8FD] p-3 text-center'}><div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white">{seat?.seat_type==='star'?<Crown size={17} className="text-amber-700"/>:<Armchair size={17} className="text-[#1560BD]"/>}</div><p className="mt-1 truncate text-[10px] font-bold">{seat?.profiles?.display_name||('مقعد '+n)}</p></button>})}</div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>قائمة الانتظار: {queue.length}</span>{seats.some(x=>x.user_id===uid)?<Button size="sm" variant="outline" onClick={leaveSeat}>مغادرة المقعد</Button>:null}</div>
        </section>
        {spotlight?<section className="mb-4 rounded-3xl bg-gradient-to-l from-[#EAF2FC] to-white p-4"><p className="font-extrabold text-[#1560BD]">تحدي ثنائي ✨ نشط الآن</p><p className="mt-1 text-xs text-slate-500">تركيز مؤقت على شخصين داخل اللَمّة.</p>{isHost?<Button className="mt-2" size="sm" variant="outline" onClick={endSpot}>إنهاء التحدي</Button>:null}</section>:null}
        {isHost?<section className="mb-4 rounded-3xl border border-[#DCE8F7] bg-white p-4"><div className="flex items-center gap-2"><Shield size={17} className="text-[#1560BD]"/><p className="font-extrabold">تحكم المضيف</p></div><div className="mt-3 grid grid-cols-3 gap-2"><Button size="sm" variant="secondary" onClick={startSpot}><Sparkles size={14}/> Spotlight</Button><Button size="sm" variant="outline" onClick={()=>mystery(true)}>🎭 ضيف غامض</Button><Button size="sm" variant="outline" onClick={revealMystery}>كشف الضيف</Button></div>{starRequests.length?<div className="mt-3 space-y-2">{starRequests.map((q:any)=><div key={q.id} className="flex items-center gap-2 rounded-2xl bg-[#F4F8FD] p-2"><UserRoundPlus size={16}/><span className="flex-1 text-xs font-bold">{q.profiles?.display_name||'عضو'} · {q.cost_stars} ⭐</span><Button size="sm" onClick={()=>starDecision(q.id,true)}>قبول</Button><Button size="sm" variant="outline" onClick={()=>starDecision(q.id,false)}>رفض</Button></div>)}</div>:null}</section>:null}
        <section className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <Users size={17} className="text-[#1560BD]" />
            <h2 className="font-extrabold">أعضاء اللَمّة</h2>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {members.map((m) => (
              <button
                key={m.user_id}
                type="button"
                disabled={m.user_id === uid}
                onClick={() => setSelectedMember(m)}
                className="min-w-[96px] rounded-2xl border border-slate-200 bg-white p-3 text-center disabled:opacity-60"
              >
                <div className="mx-auto grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-[#EAF2FC] font-black text-[#1560BD]">
                  {m.profiles?.avatar_url ? (
                    <img
                      src={m.profiles.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (m.profiles?.display_name || 'م')[0]
                  )}
                </div>

                <p className="mt-2 truncate text-xs font-bold">
                  {m.user_id === uid
                    ? 'أنت'
                    : m.profiles?.display_name || 'عضو'}
                </p>
              </button>
            ))}
          </div>
        </section>

        {selectedMember ? (
          <section className="mb-4 rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-extrabold">
                  {selectedMember.profiles?.display_name || 'عضو'}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedMember.profiles?.mood || 'عضو في اللَمّة'}
                </p>
              </div>

              <button onClick={() => {
                setSelectedMember(null)
                setShowGifts(false)
              }}>
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => requestPrivateContact(selectedMember)}
              >
                <Star size={16} />
                تواصل خاص · {privateContactPrice} ⭐
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowGifts(!showGifts)}
              >
                <Gift size={16} />
                إرسال هدية
              </Button>
            </div>

            {showGifts ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {gifts.map((gift) => (
                  <button
                    key={gift.id}
                    type="button"
                    onClick={() => sendGift(gift)}
                    className="rounded-2xl bg-slate-50 p-3 text-center"
                  >
                    <div className="text-2xl">{gift.emoji}</div>
                    <p className="mt-1 text-xs font-bold">{gift.name_ar}</p>
                    <p className="text-[11px] text-amber-700">
                      {gift.price_stars} ⭐
                    </p>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="flex-1 space-y-3 pb-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.sender_id === uid
                  ? 'mr-auto max-w-[82%] rounded-3xl rounded-br-lg bg-[#1560BD] p-3 text-white'
                  : 'ml-auto max-w-[82%] rounded-3xl rounded-bl-lg bg-white p-3 shadow-sm'
              }
            >
              <button
                type="button"
                disabled={m.sender_id === uid}
                onClick={() => {
                  const member = members.find((x) => x.user_id === m.sender_id)
                  if (member) setSelectedMember(member)
                }}
                className={
                  m.sender_id === uid
                    ? 'text-[11px] font-bold text-[#D7E7FB]'
                    : 'text-[11px] font-bold text-[#1560BD]'
                }
              >
                {(m.profiles as any)?.display_name || 'عضو'}
              </button>

              <p className="mt-1 text-sm">{m.body}</p>
            </div>
          ))}
        </div>

        <div className="sticky bottom-20 flex gap-2 rounded-3xl border border-slate-200 bg-white p-2">
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
    </AppShell>
  )
}

