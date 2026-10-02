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
        .select('id,name,emoji,is_public,owner_id')
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

      const { error } = await s.rpc('enter_lamma_voice', {
        p_space: id,
      })

      if (error) {
        stream.getTracks().forEach((t) => t.stop())
        localStreamRef.current = null
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
        title={space ? `${space.emoji || '🎙️'} ${space.name}` : 'اللَمّة'}
      />

      <main className="flex min-h-[calc(100vh-160px)] flex-col p-4">
        {notice ? (
          <p className="mb-3 rounded-2xl bg-[#E7F5F1] p-3 text-xs font-bold text-[#006B57]">
            {notice}
          </p>
        ) : null}

        <section className="mb-4 rounded-3xl bg-gradient-to-br from-[#006B57] to-[#004D40] p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-[#CDECE3]">الصوت الجماعي</p>
              <p className="mt-1 font-extrabold">
                {voiceMembers.length} متواجد بالصوت
              </p>
            </div>

            {!inVoice ? (
              <Button
                className="bg-white text-[#006B57] hover:bg-[#E7F5F1]"
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

        <section className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <Users size={17} className="text-[#006B57]" />
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
                <div className="mx-auto grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-[#E7F5F1] font-black text-[#006B57]">
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
                  ? 'mr-auto max-w-[82%] rounded-3xl rounded-br-lg bg-[#006B57] p-3 text-white'
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
                    ? 'text-[11px] font-bold text-[#CDECE3]'
                    : 'text-[11px] font-bold text-[#006B57]'
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
