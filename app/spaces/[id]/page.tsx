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

  const localStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map())
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

  async function joinQueue(){const {error}=await s.rpc('join_mic_queue',{p_space:id});setNotice(error?'ØªØ¹Ø°Ø± Ø¯Ø®ÙˆÙ„ Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…ÙŠÙƒØ±ÙˆÙÙˆÙ†.':'ØªÙ…Øª Ø¥Ø¶Ø§ÙØªÙƒ Ù„Ù‚Ø§Ø¦Ù…Ø© Ø§Ù†ØªØ¸Ø§Ø± Ø§Ù„Ù…ÙŠÙƒØ±ÙˆÙÙˆÙ†.');await load()}
  async function leaveSeat(){const {error}=await s.rpc('leave_lamma_seat',{p_space:id});setNotice(error?'ØªØ¹Ø°Ø± Ù…ØºØ§Ø¯Ø±Ø© Ø§Ù„Ù…Ù‚Ø¹Ø¯.':'ØºØ§Ø¯Ø±Øª Ø§Ù„Ù…Ù‚Ø¹Ø¯.');await load()}
  async function starSeat(){const {error}=await s.rpc('request_star_seat',{p_space:id});setNotice(error?(error.message.includes('insufficient_stars')?'Ø±ØµÙŠØ¯ Ø§Ù„Ù†Ø¬ÙˆÙ… ØºÙŠØ± ÙƒØ§ÙÙ.':'ØªØ¹Ø°Ø± Ø·Ù„Ø¨ Ø§Ù„Ù…Ù‚Ø¹Ø¯ Ø§Ù„Ù…Ù„ÙƒÙŠ.'):'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø·Ù„Ø¨ Ø§Ù„Ù…Ù‚Ø¹Ø¯ Ø§Ù„Ù…Ù„ÙƒÙŠ Ù„Ù„Ù…Ø¶ÙŠÙ ðŸ‘‘');await load()}
  async function seatNext(n:number){const {error}=await s.rpc('host_seat_next_from_queue',{p_space:id,p_seat_no:n});setNotice(error?'ØªØ¹Ø°Ø± Ø¥Ø¬Ù„Ø§Ø³ Ø§Ù„Ø¹Ø¶Ùˆ.':'ØªÙ… Ù†Ù‚Ù„ Ø§Ù„Ø¹Ø¶Ùˆ Ø§Ù„ØªØ§Ù„ÙŠ Ù„Ù„Ù…Ù‚Ø¹Ø¯.');await load()}
  async function starDecision(req:string,ok:boolean){const {error}=await s.rpc('respond_star_seat_request',{p_request:req,p_accept:ok});setNotice(error?'ØªØ¹Ø°Ø± ØªÙ†ÙÙŠØ° Ø§Ù„Ù‚Ø±Ø§Ø±.':ok?'ØªÙ… Ù‚Ø¨ÙˆÙ„ Ø§Ù„Ù…Ù‚Ø¹Ø¯ Ø§Ù„Ù…Ù„ÙƒÙŠ.':'ØªÙ… Ø±ÙØ¶ Ø§Ù„Ø·Ù„Ø¨.');await load()}
  async function mystery(enabled:boolean){const {error}=await s.rpc('set_mystery_guest',{p_space:id,p_enabled:enabled});setNotice(error?'ØªØ¹Ø°Ø± ØªØºÙŠÙŠØ± ÙˆØ¶Ø¹ Ø§Ù„Ø¶ÙŠÙ Ø§Ù„ØºØ§Ù…Ø¶.':enabled?'ØªÙ… ØªÙØ¹ÙŠÙ„ Ø§Ù„Ø¶ÙŠÙ Ø§Ù„ØºØ§Ù…Ø¶.':'ØªÙ… Ø¥ÙŠÙ‚Ø§Ù Ø§Ù„Ø¶ÙŠÙ Ø§Ù„ØºØ§Ù…Ø¶.')}
  async function revealMystery(){const {error}=await s.rpc('reveal_mystery_guest',{p_space:id});setNotice(error?'ØªØ¹Ø°Ø± ÙƒØ´Ù Ø§Ù„Ø¶ÙŠÙ Ø§Ù„Ø¢Ù†.':'ØªÙ… ÙƒØ´Ù Ø§Ù„Ø¶ÙŠÙ Ø§Ù„ØºØ§Ù…Ø¶ ðŸŽ­')}
  async function startSpot(){const picks=members.filter(x=>x.user_id!==uid).slice(0,2);if(picks.length<2){setNotice('ÙŠÙ„Ø²Ù… Ø¹Ø¶ÙˆØ§Ù† Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„.');return}const {error}=await s.rpc('start_lamma_pair_spotlight',{p_space:id,p_user_a:picks[0].user_id,p_user_b:picks[1].user_id});setNotice(error?'ØªØ¹Ø°Ø± Ø¨Ø¯Ø¡ Pair Spotlight.':'Ø¨Ø¯Ø£ Pair Spotlight Ù„Ù…Ø¯Ø© Ù…Ø­Ø¯ÙˆØ¯Ø© âœ¨');await load()}
  async function endSpot(){const {error}=await s.rpc('end_lamma_pair_spotlight',{p_space:id});setNotice(error?'ØªØ¹Ø°Ø± Ø¥Ù†Ù‡Ø§Ø¡ Spotlight.':'ØªÙ… Ø¥Ù†Ù‡Ø§Ø¡ Spotlight.');await load()}
  async function moderate(target:string,action:string){const {error}=await s.rpc('host_moderate_lamma_member',{p_space:id,p_target:target,p_action:action,p_duration_minutes:action==='mute'?10:null,p_reason:'Ø¥Ø¬Ø±Ø§Ø¡ Ø¥Ø¯Ø§Ø±Ø© Ù…Ù† Ø§Ù„Ù…Ø¶ÙŠÙ'});setNotice(error?'ØªØ¹Ø°Ø± ØªÙ†ÙÙŠØ° Ø¥Ø¬Ø±Ø§Ø¡ Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©.':'ØªÙ… ØªÙ†ÙÙŠØ° Ø¥Ø¬Ø±Ø§Ø¡ Ø§Ù„Ù…Ø¶ÙŠÙ.');await load()}
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
        setNotice('Ø±ØµÙŠØ¯ Ø§Ù„Ù†Ø¬ÙˆÙ… ØºÙŠØ± ÙƒØ§ÙÙ.')
      } else if (error.message.includes('already_connected')) {
        setNotice('Ø£Ù†ØªÙ… Ø¨Ø§Ù„ÙØ¹Ù„ Ù…ØªØµÙ„ÙˆÙ† ÙÙŠ ÙƒÙ„Ø§Ù…Ù†Ø§.')
      } else if (error.message.includes('target_not_accepting_requests')) {
        setNotice('Ù‡Ø°Ø§ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ù„Ø§ ÙŠØ³ØªÙ‚Ø¨Ù„ Ø·Ù„Ø¨Ø§Øª ØªÙˆØ§ØµÙ„ Ø­Ø§Ù„ÙŠÙ‹Ø§.')
      } else {
        setNotice('ØªØ¹Ø°Ø± Ø¥Ø±Ø³Ø§Ù„ Ø·Ù„Ø¨ Ø§Ù„ØªÙˆØ§ØµÙ„.')
      }
      return
    }

    setNotice(
      `ØªÙ… Ø®ØµÙ… ${privateContactPrice} Ù†Ø¬Ù…Ø© ÙˆØ¥Ø±Ø³Ø§Ù„ Ø·Ù„Ø¨ ØªÙˆØ§ØµÙ„ Ø®Ø§Øµ. Ù„Ù† ÙŠÙØªØ­ Ø§Ù„Ø´Ø§Øª Ø¥Ù„Ø§ Ø¨Ø¹Ø¯ Ù…ÙˆØ§ÙÙ‚Ø© Ø§Ù„Ø·Ø±Ù Ø§Ù„Ø¢Ø®Ø±.`
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
        setNotice('Ø±ØµÙŠØ¯ Ø§Ù„Ù†Ø¬ÙˆÙ… ØºÙŠØ± ÙƒØ§ÙÙ Ù„Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù‡Ø¯ÙŠØ©.')
      } else {
        setNotice('ØªØ¹Ø°Ø± Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù‡Ø¯ÙŠØ©.')
      }
      return
    }

    setNotice(
      `ØªÙ… Ø¥Ø±Ø³Ø§Ù„ ${gift.emoji} ${gift.name_ar}. Ø§Ù„Ù…Ù†ØµØ© ØªØ­ØªÙØ¸ Ø¨Ù€15% ÙˆÙŠØµÙ„ Ù„Ù„Ù…Ø³ØªÙ„Ù… 85% Ù…Ù† Ù‚ÙŠÙ…Ø© Ø§Ù„Ù†Ø¬ÙˆÙ….`
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

      const { error } = await s.rpc('enter_lamma_voice', {
        p_space: id,
      })

      if (error) {
        stream.getTracks().forEach((t) => t.stop())
        localStreamRef.current = null
        setNotice('ØªØ¹Ø°Ø± Ø¯Ø®ÙˆÙ„ Ø§Ù„ØµÙˆØª.')
        return
      }

      setInVoice(true)
      setMicEnabled(true)
      await startVoiceRealtime()
      await refreshVoiceMembers()
    } catch {
      setNotice('Ø§Ø³Ù…Ø­ Ù„Ù„Ù…ÙˆÙ‚Ø¹ Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ù…ÙŠÙƒØ±ÙˆÙÙˆÙ† Ø«Ù… Ø­Ø§ÙˆÙ„ Ù…Ø±Ø© Ø£Ø®Ø±Ù‰.')
    }
  }

  async function leaveVoice() {
    await s.rpc('leave_lamma_voice', { p_space: id })
    cleanupVoice()
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

      audio.srcObject = event.streams[0]
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

    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    pendingIceRef.current.clear()
  }

  return (
    <AppShell>
      <PageHeader
        title={space ? `${space.emoji || 'ðŸŽ™ï¸'} ${space.name}` : 'Ø§Ù„Ù„ÙŽÙ…Ù‘Ø©'}
      />

      <main className="flex min-h-[calc(100vh-160px)] flex-col p-4">
        {notice ? (
          <p className="mb-3 rounded-2xl bg-[#EAF2FC] p-3 text-xs font-bold text-[#1560BD]">
            {notice}
          </p>
        ) : null}

        <section className="mb-4 rounded-3xl bg-gradient-to-br from-[#1560BD] to-[#0D3D78] p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-[#D7E7FB]">Ø§Ù„ØµÙˆØª Ø§Ù„Ø¬Ù…Ø§Ø¹ÙŠ</p>
              <p className="mt-1 font-extrabold">
                {voiceMembers.length} Ù…ØªÙˆØ§Ø¬Ø¯ Ø¨Ø§Ù„ØµÙˆØª
              </p>
            </div>

            {!inVoice ? (
              <Button
                className="bg-white text-[#1560BD] hover:bg-[#EAF2FC]"
                onClick={joinVoice}
              >
                <PhoneCall size={16} />
                Ø§Ù†Ø¶Ù… Ù„Ù„ØµÙˆØª
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
                  Ø®Ø±ÙˆØ¬
                </Button>
              </div>
            )}
          </div>

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
                  {m.profiles?.display_name || 'Ø¹Ø¶Ùˆ'}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mb-4 rounded-3xl border border-[#DCE8F7] bg-white p-4">
          <div className="flex items-center justify-between"><div><p className="font-extrabold">Ù…Ù‚Ø§Ø¹Ø¯ Ø§Ù„Ù„ÙŽÙ…Ù‘Ø©</p><p className="text-xs text-slate-500">Stage Ø­ØªÙ‰ {space?.seat_count||8} Ù…Ù‚Ø§Ø¹Ø¯</p></div><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={joinQueue}><Mic size={14}/> Ø§Ø·Ù„Ø¨ Ø§Ù„Ù…Ø§ÙŠÙƒ</Button><Button size="sm" variant="outline" onClick={starSeat}><Crown size={14}/> Ø§Ù„Ù…Ù‚Ø¹Ø¯ Ø§Ù„Ù…Ù„ÙƒÙŠ</Button></div></div>
          <div className="mt-3 grid grid-cols-4 gap-2">{Array.from({length:Math.min(Number(space?.seat_count||8),8)},(_,i)=>i+1).map(n=>{const seat=seats.find(x=>x.seat_no===n);return <button key={n} onClick={()=>isHost&&!seat&&seatNext(n)} className={seat?.seat_type==='star'?'rounded-2xl border border-amber-300 bg-amber-50 p-3 text-center':'rounded-2xl bg-[#F4F8FD] p-3 text-center'}><div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white">{seat?.seat_type==='star'?<Crown size={17} className="text-amber-700"/>:<Armchair size={17} className="text-[#1560BD]"/>}</div><p className="mt-1 truncate text-[10px] font-bold">{seat?.profiles?.display_name||('Ù…Ù‚Ø¹Ø¯ '+n)}</p></button>})}</div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø±: {queue.length}</span>{seats.some(x=>x.user_id===uid)?<Button size="sm" variant="outline" onClick={leaveSeat}>Ù…ØºØ§Ø¯Ø±Ø© Ø§Ù„Ù…Ù‚Ø¹Ø¯</Button>:null}</div>
        </section>
        {spotlight?<section className="mb-4 rounded-3xl bg-gradient-to-l from-[#EAF2FC] to-white p-4"><p className="font-extrabold text-[#1560BD]">Pair Spotlight âœ¨ Ù†Ø´Ø· Ø§Ù„Ø¢Ù†</p><p className="mt-1 text-xs text-slate-500">ØªØ±ÙƒÙŠØ² Ù…Ø¤Ù‚Øª Ø¹Ù„Ù‰ Ø´Ø®ØµÙŠÙ† Ø¯Ø§Ø®Ù„ Ø§Ù„Ù„ÙŽÙ…Ù‘Ø©.</p>{isHost?<Button className="mt-2" size="sm" variant="outline" onClick={endSpot}>Ø¥Ù†Ù‡Ø§Ø¡ Spotlight</Button>:null}</section>:null}
        {isHost?<section className="mb-4 rounded-3xl border border-[#DCE8F7] bg-white p-4"><div className="flex items-center gap-2"><Shield size={17} className="text-[#1560BD]"/><p className="font-extrabold">ØªØ­ÙƒÙ… Ø§Ù„Ù…Ø¶ÙŠÙ</p></div><div className="mt-3 grid grid-cols-3 gap-2"><Button size="sm" variant="secondary" onClick={startSpot}><Sparkles size={14}/> Spotlight</Button><Button size="sm" variant="outline" onClick={()=>mystery(true)}>ðŸŽ­ Ø¶ÙŠÙ ØºØ§Ù…Ø¶</Button><Button size="sm" variant="outline" onClick={revealMystery}>ÙƒØ´Ù Ø§Ù„Ø¶ÙŠÙ</Button></div>{starRequests.length?<div className="mt-3 space-y-2">{starRequests.map((q:any)=><div key={q.id} className="flex items-center gap-2 rounded-2xl bg-[#F4F8FD] p-2"><UserRoundPlus size={16}/><span className="flex-1 text-xs font-bold">{q.profiles?.display_name||'Ø¹Ø¶Ùˆ'} Â· {q.cost_stars} â­</span><Button size="sm" onClick={()=>starDecision(q.id,true)}>Ù‚Ø¨ÙˆÙ„</Button><Button size="sm" variant="outline" onClick={()=>starDecision(q.id,false)}>Ø±ÙØ¶</Button></div>)}</div>:null}</section>:null}
        <section className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <Users size={17} className="text-[#1560BD]" />
            <h2 className="font-extrabold">Ø£Ø¹Ø¶Ø§Ø¡ Ø§Ù„Ù„ÙŽÙ…Ù‘Ø©</h2>
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
                    (m.profiles?.display_name || 'Ù…')[0]
                  )}
                </div>

                <p className="mt-2 truncate text-xs font-bold">
                  {m.user_id === uid
                    ? 'Ø£Ù†Øª'
                    : m.profiles?.display_name || 'Ø¹Ø¶Ùˆ'}
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
                  {selectedMember.profiles?.display_name || 'Ø¹Ø¶Ùˆ'}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedMember.profiles?.mood || 'Ø¹Ø¶Ùˆ ÙÙŠ Ø§Ù„Ù„ÙŽÙ…Ù‘Ø©'}
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
                ØªÙˆØ§ØµÙ„ Ø®Ø§Øµ Â· {privateContactPrice} â­
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowGifts(!showGifts)}
              >
                <Gift size={16} />
                Ø¥Ø±Ø³Ø§Ù„ Ù‡Ø¯ÙŠØ©
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
                      {gift.price_stars} â­
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
                {(m.profiles as any)?.display_name || 'Ø¹Ø¶Ùˆ'}
              </button>

              <p className="mt-1 text-sm">{m.body}</p>
            </div>
          ))}
        </div>

        <div className="sticky bottom-20 flex gap-2 rounded-3xl border border-slate-200 bg-white p-2">
          <Input
            placeholder="Ø§ÙƒØªØ¨ Ø±Ø³Ø§Ù„Ø©..."
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

