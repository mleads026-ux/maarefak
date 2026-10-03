'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Flag, Heart, Shuffle, SkipForward, Sparkles, Eye, Mic2, Zap, Undo2 } from 'lucide-react'
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
  const [advanced, setAdvanced] = useState<any[]>([])
  const [advancedMode,setAdvancedMode]=useState<'vibe'|'mystery'|'voice'>('vibe')
  const [advancedBusy,setAdvancedBusy]=useState(false)

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

  async function loadAdvanced(mode:'vibe'|'mystery'|'voice') {
    setAdvancedBusy(true); setNotice(''); setAdvancedMode(mode)
    const fn=mode==='vibe'?'people_on_my_vibe':mode==='mystery'?'mystery_discovery_cards':'voice_first_discovery'
    const {data,error}=await s.rpc(fn,{p_limit:20})
    if(error){setNotice('تعذر تحميل الاقتراحات الآن.');setAdvanced([])} else setAdvanced(data||[])
    setAdvancedBusy(false)
  }

  async function advancedAction(kind:'interest'|'attention'|'super'|'rewind', target?:string){
    setAdvancedBusy(true);setNotice('')
    const call=kind==='interest'?await s.rpc('toggle_interest',{p_target:target}):kind==='attention'?await s.rpc('send_attention_ping',{p_target:target}):kind==='super'?await s.rpc('send_super_interest',{p_target:target}):await s.rpc('rewind_last_profile')
    if(call.error){const m=call.error.message||'';setNotice(m.includes('insufficient_stars')?'رصيد النجوم غير كافٍ.':m.includes('nothing_to_rewind')?'لا يوجد ملف سابق للرجوع إليه.':m.includes('ping_already_sent')?'تم لفت انتباه هذا الشخص خلال آخر 24 ساعة.':'تعذر تنفيذ العملية الآن.')}else setNotice(kind==='interest'?'تم تحديث الاهتمام. لو الاهتمام متبادل ستظهر Match Moment ⚡':kind==='attention'?'تم لفت الانتباه 👀':kind==='super'?'تم إرسال اهتمام مميز 💙':'تم الرجوع لآخر ملف.')
    setAdvancedBusy(false)
  }

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
        <section className="mb-4 grid grid-cols-3 gap-2 rounded-3xl border border-[#DCE8F7] bg-white/80 p-2 backdrop-blur"><button onClick={()=>loadAdvanced('vibe')} className="rounded-2xl bg-[#EAF2FC] p-3 text-xs font-bold text-[#1560BD]"><Sparkles className="mx-auto mb-1" size={18}/>مين على مزاجي؟</button><button onClick={()=>loadAdvanced('mystery')} className="rounded-2xl bg-[#EAF2FC] p-3 text-xs font-bold text-[#1560BD]"><Eye className="mx-auto mb-1" size={18}/>اكتشاف غامض</button><button onClick={()=>loadAdvanced('voice')} className="rounded-2xl bg-[#EAF2FC] p-3 text-xs font-bold text-[#1560BD]"><Mic2 className="mx-auto mb-1" size={18}/>صوت أولًا</button></section>
        {advancedBusy?<p className="mb-4 text-center text-sm text-slate-500">جاري التحميل...</p>:null}
        {advanced.length?<section className="mb-5 space-y-3"><div className="flex items-center justify-between"><h2 className="font-extrabold">{advancedMode==='vibe'?'الأقرب لمزاجك':advancedMode==='mystery'?'اكتشاف غامض':'اكتشف بالصوت'}</h2><Button size="sm" variant="outline" onClick={()=>advancedAction('rewind')} disabled={advancedBusy}><Undo2 size={15}/> رجوع</Button></div>{advanced.slice(0,5).map((x:any)=>{const id=x.id||x.user_id;return <Card key={id}><CardContent><div className="flex items-center gap-3"><div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-[#EAF2FC] font-black text-[#1560BD]">{advancedMode==='mystery'?'?':x.avatar_url?<img src={x.avatar_url} alt="" className="h-full w-full object-cover"/>:(x.display_name?.[0]||'ل')}</div><div className="min-w-0 flex-1"><p className="font-extrabold">{advancedMode==='mystery'?'شخص قريب من اهتماماتك':(x.display_name||'مستخدم لمتنا')}</p><p className="truncate text-xs text-slate-500">{x.city_name||'مدينة غير محددة'} {x.mood?' · '+x.mood:''} {x.shared_interests?' · '+x.shared_interests+' مشترك':''}</p></div>{x.available_now?<span className="text-xs font-bold text-[#1560BD]">متواجد</span>:null}</div>{x.daily_answer?<p className="mt-3 rounded-2xl bg-[#F4F8FD] p-3 text-sm">{x.daily_answer}</p>:null}{advancedMode==='voice'&&x.voice_intro_path?<p className="mt-3 rounded-2xl bg-[#EAF2FC] p-2 text-center text-xs font-bold text-[#1560BD]"><Mic2 className="inline" size={15}/> مقدمة صوتية متاحة</p>:null}<div className="mt-3 grid grid-cols-4 gap-2"><Button size="sm" variant="secondary" onClick={()=>advancedAction('interest',id)}><Heart size={15}/> اهتمام</Button><Button size="sm" variant="outline" onClick={()=>advancedAction('attention',id)}><Eye size={15}/></Button><Button size="sm" variant="outline" onClick={()=>advancedAction('super',id)}><Zap size={15}/></Button><Button size="sm" variant="outline" onClick={()=>r.push('/people/'+id)}>الملف</Button></div></CardContent></Card>})}</section>:null}
        {notice ? (
          <p className="mb-4 rounded-2xl bg-[#EAF2FC] p-3 text-sm font-bold text-[#1560BD]">
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
                <div className="mt-7 h-8 w-8 animate-spin rounded-full border-4 border-[#D7E7FB] border-t-[#1560BD]" />
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
