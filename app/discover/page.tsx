'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Flag, Heart, Shuffle, SkipForward } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type Match = {
  session_id: string
  matched_user_id: string
  display_name: string
  avatar_url: string | null
  city_name: string | null
  country_name: string | null
  mood: string | null
  age: number | null
  user_a: string
  user_b: string
  user_a_accepted: boolean
  user_b_accepted: boolean
}

export default function Discover() {
  const s = useMemo(() => createClient(), [])
  const r = useRouter()
  const [waiting, setWaiting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [match, setMatch] = useState<Match | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    s.auth.getUser().then(({ data }) => setUserId(data.user?.id || null))
  }, [s])

  async function hydrateSession(row: any) {
    if (!userId) return

    if (row.conversation_id) {
      r.push(`/chats/${row.conversation_id}`)
      return
    }

    if (row.status !== 'active') {
      setMatch(null)
      setWaiting(false)
      setNotice('انتهت المطابقة. يمكنك البحث عن شخص آخر.')
      return
    }

    const other = row.user_a === userId ? row.user_b : row.user_a

    const { data: p } = await s
      .from('profiles')
      .select('id,display_name,avatar_url,mood,birth_date,show_age,cities(name_ar),countries(name_ar)')
      .eq('id', other)
      .single()

    if (!p) return

    setMatch({
      session_id: row.id,
      matched_user_id: other,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      city_name: (p.cities as any)?.name_ar || null,
      country_name: (p.countries as any)?.name_ar || null,
      mood: p.mood,
      age:
        p.show_age && p.birth_date
          ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / 31557600000)
          : null,
      user_a: row.user_a,
      user_b: row.user_b,
      user_a_accepted: !!row.user_a_accepted,
      user_b_accepted: !!row.user_b_accepted,
    })

    setWaiting(false)
    setNotice('')
  }

  useEffect(() => {
    if (!userId) return

    const channel = s
      .channel(`random-consent-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'random_chat_sessions' },
        async (payload: any) => {
          const row = payload.new
          if (row.user_a === userId || row.user_b === userId) {
            await hydrateSession(row)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'random_chat_sessions' },
        async (payload: any) => {
          const row = payload.new
          if (row.user_a === userId || row.user_b === userId) {
            await hydrateSession(row)
          }
        }
      )
      .subscribe()

    return () => {
      s.removeChannel(channel)
    }
  }, [userId, s])

  async function start() {
    setBusy(true)
    setMatch(null)
    setNotice('')

    const { data, error } = await s.rpc('random_chat_match')
    const row = Array.isArray(data) ? data[0] : data

    if (error) {
      setNotice('تعذر بدء البحث الآن. حاول مرة أخرى.')
      setBusy(false)
      return
    }

    if (row?.waiting) {
      setWaiting(true)
      setBusy(false)
      return
    }

    if (row?.session_id) {
      const { data: session } = await s
        .from('random_chat_sessions')
        .select('id,user_a,user_b,status,conversation_id,user_a_accepted,user_b_accepted')
        .eq('id', row.session_id)
        .single()

      if (session) await hydrateSession(session)
    }

    setBusy(false)
  }

  async function cancel() {
    await s.rpc('cancel_random_chat')
    setWaiting(false)
  }

  async function skip() {
    if (match) {
      await s.rpc('decline_random_chat', { p_session: match.session_id })
    }
    setMatch(null)
    setNotice('')
    await start()
  }

  async function approveChat() {
    if (!match || !userId) return

    setBusy(true)

    const { data, error } = await s.rpc('start_random_chat_conversation', {
      p_session: match.session_id,
    })

    if (error) {
      setNotice('تعذر تسجيل الموافقة. حاول مرة أخرى.')
      setBusy(false)
      return
    }

    if (data) {
      r.push(`/chats/${data}`)
      return
    }

    setMatch((current) => {
      if (!current) return current
      return current.user_a === userId
        ? { ...current, user_a_accepted: true }
        : { ...current, user_b_accepted: true }
    })

    setBusy(false)
  }

  async function interest() {
    if (match) await s.rpc('toggle_interest', { p_target: match.matched_user_id })
  }

  async function block() {
    if (!match) return
    await s.rpc('block_user', { p_target: match.matched_user_id })
    setMatch(null)
  }

  async function report() {
    if (!match) return
    await s.rpc('report_user', {
      p_target: match.matched_user_id,
      p_reason: 'other',
      p_description: 'بلاغ من الدردشة العشوائية',
    })
    setNotice('تم إرسال البلاغ.')
  }

  const meAccepted =
    !!match &&
    !!userId &&
    (match.user_a === userId ? match.user_a_accepted : match.user_b_accepted)

  const otherAccepted =
    !!match &&
    !!userId &&
    (match.user_a === userId ? match.user_b_accepted : match.user_a_accepted)

  const consentLabel = !match
    ? ''
    : meAccepted
      ? `في انتظار موافقة ${match.display_name}...`
      : otherAccepted
        ? `${match.display_name} وافق — وافق لبدء الحوار`
        : 'موافق أتكلم'

  return (
    <AppShell>
      <PageHeader title="اكتشف" />

      <main className="p-4">
        {notice ? (
          <p className="mb-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-[#1560BD]">
            {notice}
          </p>
        ) : null}

        {!match ? (
          <div className="flex min-h-[68vh] flex-col items-center justify-center text-center">
            <div className="mb-6 grid h-24 w-24 place-items-center rounded-full bg-[#EAF2FC] text-[#1560BD]">
              <Shuffle size={42} />
            </div>

            <h1 className="text-2xl font-extrabold">Random Chat</h1>

            <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
              المطابقة لا تفتح الحوار تلقائيًا. لازم الطرفين يوافقوا أولًا.
            </p>

            {waiting ? (
              <>
                <div className="mt-7 h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-[#1560BD]" />
                <p className="mt-3 text-sm font-bold">جاري انتظار شخص متاح...</p>
                <Button className="mt-4" variant="outline" onClick={cancel}>
                  إلغاء البحث
                </Button>
              </>
            ) : (
              <Button
                size="lg"
                className="mt-7 w-full max-w-xs"
                disabled={busy}
                onClick={start}
              >
                {busy ? 'جاري البحث...' : 'ابدأ دردشة عشوائية'}
              </Button>
            )}
          </div>
        ) : (
          <Card className="mt-6">
            <CardContent className="space-y-5 text-center">
              <div className="mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-blue-100 to-slate-200">
                {match.avatar_url ? (
                  <img src={match.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl font-black text-[#1560BD]">
                    {match.display_name?.[0]}
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-xl font-extrabold">
                  {match.display_name}
                  {match.age ? `، ${match.age}` : ''}
                </h2>
                <p className="text-sm text-slate-500">
                  {[match.city_name, match.country_name].filter(Boolean).join('، ')}
                  {match.mood ? ` · ${match.mood}` : ''}
                </p>
              </div>

              <Button
                className="w-full"
                onClick={approveChat}
                disabled={busy || meAccepted}
              >
                {busy ? 'جاري التنفيذ...' : consentLabel}
              </Button>

              {meAccepted && !otherAccepted ? (
                <p className="text-xs text-slate-500">
                  لن يتم فتح صفحة الحوار إلا بعد موافقة {match.display_name}.
                </p>
              ) : null}

              <div className="grid grid-cols-4 gap-2">
                <Button size="icon" variant="outline" onClick={skip}>
                  <SkipForward size={18} />
                </Button>
                <Button size="icon" variant="outline" onClick={interest}>
                  <Heart size={18} />
                </Button>
                <Button size="icon" variant="outline" onClick={block}>
                  <Ban size={18} />
                </Button>
                <Button size="icon" variant="outline" onClick={report}>
                  <Flag size={18} />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </AppShell>
  )
}
