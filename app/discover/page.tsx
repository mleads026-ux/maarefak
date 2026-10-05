'use client'
import Link from 'next/link'
import {useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Users,Heart,Mic2,MapPin,ShieldCheck,MessageCircle,Eye,Ban,Flag,SkipForward,Star,Bell,ChevronLeft,LockKeyhole,Play} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {BrandLogo} from '@/components/brand-logo'
import {appConfirm,appPrompt} from '@/components/interaction-dialog'
import {
  createRandomMatch,
  discoveryFallback,
  discoveryRpcForMode,
  getDiscoveryCardView,
  normalizeNewFace,
  type DiscoveryMode,
  type RandomMatch,
} from '@/lib/discover-room'

export default function Discover(){
  const s=useMemo(()=>createClient(),[])
  const r=useRouter()
  const [waiting,setWaiting]=useState(false)
  const [busy,setBusy]=useState(false)
  const [match,setMatch]=useState<RandomMatch|null>(null)
  const [userId,setUserId]=useState<string|null>(null)
  const [notice,setNotice]=useState('')
  const [advanced,setAdvanced]=useState<any[]>([])
  const [mode,setMode]=useState<DiscoveryMode>('mystery')
  const [advBusy,setAdvBusy]=useState(false)
  const [stars,setStars]=useState(0)
  const [voicePlaying,setVoicePlaying]=useState(false)

  useEffect(()=>{(async()=>{
    const {data:{user}}=await s.auth.getUser()
    setUserId(user?.id||null)
    if(user){
      const {data:w}=await s.from('star_wallets').select('balance').eq('user_id',user.id).maybeSingle()
      setStars(Number(w?.balance||0))
    }
    const {data}=await s.rpc('mystery_discovery_cards',{p_limit:20})
    setAdvanced(data||[])
  })()},[s])

  async function hydrate(row:any){
    if(!userId)return
    if(row.conversation_id){r.push(`/chats/${row.conversation_id}`);return}
    if(row.status!=='active'){setMatch(null);setWaiting(false);return}
    const other=row.user_a===userId?row.user_b:row.user_a
    const [{data:p},{data:ageValue}]=await Promise.all([
      s.from('profiles').select('id,display_name,avatar_url,mood,show_age,cities(name_ar),countries(name_ar)').eq('id',other).single(),
      s.rpc('public_profile_age',{p_target:other}),
    ])
    if(!p)return
    setMatch(createRandomMatch({
      session:row,
      profile:p,
      age:ageValue,
      currentUserId:userId,
    }))
    setWaiting(false)
  }

  useEffect(()=>{
    if(!userId)return
    const c=s.channel(`random-consent-${userId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'random_chat_sessions'},(p:any)=>hydrate(p.new))
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'random_chat_sessions'},(p:any)=>hydrate(p.new))
      .subscribe()
    return()=>{s.removeChannel(c)}
  },[userId,s])

  async function load(m:DiscoveryMode){
    setMode(m);setAdvBusy(true);setNotice('')
    if(m==='new'){
      let q=s.from('profiles')
        .select('id,display_name,avatar_url,mood,show_age,is_online,created_at,cities(name_ar)')
        .eq('profile_complete',true)
        .eq('discoverable',true)
        .order('created_at',{ascending:false})
        .limit(20)
      if(userId)q=q.neq('id',userId)
      const {data,error}=await q
      const rows=(data||[]) as any[]
      const ageEntries=!error?await Promise.all(rows.map(async (x:any)=>{
        const {data:ageValue}=await s.rpc('public_profile_age',{p_target:x.id})
        return [x.id,ageValue==null?null:Number(ageValue)] as const
      })):[]
      const ageMap=new Map(ageEntries)
      const normalized=rows.map((x:any)=>normalizeNewFace(x,ageMap.get(x.id)??null))
      if(error){setNotice('تعذر تحميل الوجوه الجديدة الآن.');setAdvanced([])}else setAdvanced(normalized)
      setAdvBusy(false)
      return
    }
    const fn=discoveryRpcForMode(m)
    const {data,error}=await s.rpc(fn,{p_limit:20})
    if(error){setNotice('تعذر تحميل الاقتراحات الآن.');setAdvanced([])}else setAdvanced(data||[])
    setAdvBusy(false)
  }

  async function start(){
    setBusy(true);setMatch(null);setNotice('')
    const {data,error}=await s.rpc('random_chat_match')
    const row=Array.isArray(data)?data[0]:data
    if(error){setNotice('تعذر بدء البحث الآن.');setBusy(false);return}
    if(row?.waiting){setWaiting(true);setBusy(false);return}
    if(row?.session_id){
      const {data:ses}=await s.from('random_chat_sessions').select('id,user_a,user_b,status,conversation_id,user_a_accepted,user_b_accepted').eq('id',row.session_id).single()
      if(ses)await hydrate(ses)
    }
    setBusy(false)
  }

  async function approve(){
    if(!match||!userId)return
    setBusy(true)
    const {data,error}=await s.rpc('start_random_chat_conversation',{p_session:match.session_id})
    if(error){setNotice('تعذر تسجيل الموافقة.');setBusy(false);return}
    if(data){r.push(`/chats/${data}`);return}
    setMatch(c=>c?(c.user_a===userId?{...c,user_a_accepted:true}:{...c,user_b_accepted:true}):c)
    setBusy(false)
  }

  async function skip(){
    if(match)await s.rpc('decline_random_chat',{p_session:match.session_id})
    setMatch(null);await start()
  }

  async function actOnCard(action:'skip'|'interest'){
    const first=advanced[0]
    const target=first?.id||first?.user_id
    if(!target)return
    setAdvBusy(true)
    if(action==='skip'){
      await s.rpc('record_profile_swipe',{p_target:target,p_action:'skip'})
      setAdvanced(v=>v.slice(1))
      setNotice('تم التخطي وعرض اقتراح جديد.')
    }else{
      const {data,error}=await s.rpc('toggle_interest',{p_target:target})
      setNotice(error?'تعذر تسجيل الاهتمام.':data?'تم تسجيل الاهتمام 💗':'تم إلغاء الاهتمام.')
    }
    setAdvBusy(false)
  }

  async function playVoice(){
    const first=advanced[0]
    if(!first?.voice_intro_path||voicePlaying)return
    setVoicePlaying(true)
    const {data,error}=await s.storage.from('voice-intros').createSignedUrl(first.voice_intro_path,300)
    if(error||!data?.signedUrl){setNotice('تعذر تشغيل المقدمة الصوتية.');setVoicePlaying(false);return}
    const audio=new Audio(data.signedUrl)
    audio.onended=()=>setVoicePlaying(false)
    audio.onerror=()=>setVoicePlaying(false)
    await audio.play().catch(()=>{setNotice('تعذر تشغيل الصوت على هذا الجهاز.');setVoicePlaying(false)})
  }

  const first=advanced[0]
  const {
    target,
    isKnown,
    knownImage,
    cardName,
    cardCity,
    cardMood,
  }=getDiscoveryCardView(mode,first)

  return <AppShell>
    <main className="px-4 pb-5 pt-3">
      <header className="safe-top flex items-center justify-between">
        <div className="flex items-center gap-2.5"><BrandLogo size={50}/><div><h1 className="text-[30px] font-black leading-none">لمتنا</h1><p className="mt-1 text-[11px] font-bold text-[#68758e]">دائمًا مساحة أجمل مع أصدقاء جدد</p></div></div>
        <div className="flex items-center gap-2">
          <Link href="/payments" className="tap-action flex h-10 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-black shadow-sm ring-1 ring-[#dfe9f5]"><Star size={19} fill="#ffc21d" className="text-[#ffc21d]"/>{stars.toLocaleString('en-US')}<ChevronLeft size={14} className="text-[#0e67f5]"/></Link>
          <Link href="/notifications" className="tap-action relative grid h-11 w-11 place-items-center rounded-full bg-white text-[#0e67f5] shadow-sm ring-1 ring-[#dfe9f5]"><Bell size={21}/><span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#ff1678] ring-2 ring-white"/></Link>
        </div>
      </header>

      <div className="mt-5"><h1 className="text-[31px] font-black">اكتشف ✨</h1><p className="text-[14px] font-bold text-[#6f7b94]">تعرّف على أشخاص جدد بطرق مختلفة وممتعة</p></div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          [Users,'وجوه جديدة','تعرّف على أشخاص جدد بالقرب منك','new','#0e67f5'],
          [Heart,'مين على مزاجي؟','اكتشف أشخاص بناءً على اهتماماتك','vibe','#f20aa0'],
          [Eye,'اكتشاف غامض','دردش مع شخص مجهول واكتشفه تدريجيًا','mystery','#ffffff'],
          [Mic2,'صوت أول','تعرّف على الصوت قبل الصورة','voice','#a92be5'],
        ].map(([I,t,d,m,c]:any)=>{
          const active=mode===m
          return <button key={t} onClick={()=>load(m)} className={`tap-action rounded-[23px] p-3 text-center shadow-sm ring-1 ring-[#e0e9f5] ${active?'lammetna-gradient text-white':'bg-white text-[#13213f]'}`}>
            <span className={`mx-auto grid h-12 w-12 place-items-center rounded-[18px] ${active?'bg-white/16':'bg-gradient-to-br from-[#e9f6ff] to-[#f6e8ff]'}`} style={{color:active?'white':c}}><I size={25}/></span>
            <p className="mt-2 text-[11px] font-black leading-4">{t}</p><p className={`mt-1 text-[9px] font-bold leading-4 ${active?'text-white/80':'text-[#79859b]'}`}>{d}</p><ChevronLeft size={14} className={`mx-auto mt-1 ${active?'text-white':'text-[#0e67f5]'}`}/>
          </button>
        })}
      </div>

      {notice?<p className="mt-3 rounded-2xl bg-[#edf5ff] p-3 text-sm font-bold text-[#24528d]">{notice}</p>:null}
      {advBusy?<p className="mt-3 text-center text-xs font-bold text-[#738097]">جاري التحميل...</p>:null}

      <section className="lammetna-gradient hero-shadow glow-card-surface relative mt-4 overflow-hidden rounded-[31px] p-5 text-white">
        <div className="pointer-events-none absolute -left-12 top-8 h-52 w-52 rounded-full border-[26px] border-white/10"/>
        <div className="grid min-h-[270px] grid-cols-[1fr_1fr] items-center gap-3">
          <div className="relative flex h-[225px] items-center justify-center">
            <div className="absolute h-[190px] w-[155px] rotate-[-8deg] rounded-[48%] bg-white/20 blur-[1px]"/>
            <div className="relative h-[190px] w-[155px] overflow-hidden rounded-[48%] border-2 border-white/60 shadow-2xl">
              <img src={knownImage} alt="" className={`h-full w-full object-cover ${isKnown?'':'scale-110 blur-[18px]'}`}/>
              {!isKnown?<span className="absolute inset-0 grid place-items-center text-6xl font-black text-white">?</span>:null}
            </div>
            {!isKnown?<span className="absolute bottom-0 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#2450a4]"><LockKeyhole className="ml-1 inline" size={14}/> {mode==='voice'?'الصورة بعد التعارف':'الصورة مكتشفة تدريجيًا'}</span>:null}
          </div>
          <div>
            <span className="inline-flex rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-black text-[#6c25d9]">{mode==='mystery'?'🎭 اكتشاف غامض':mode==='voice'?'🎙️ صوت أول':'✨ اقتراح لك'}</span>
            <h2 className="mt-3 text-[29px] font-black">{cardName}</h2>
            {first?.age?<p className="mt-1 text-sm font-black">{first.age} سنة {first?.is_online===true?<span className="text-[#19e3a1] drop-shadow-[0_0_6px_rgba(25,227,161,.75)]">●</span>:null}</p>:null}
            <div className="mt-4 space-y-2 text-[12px] font-black">
              <div className="rounded-full bg-white/14 px-3 py-2"><MapPin className="ml-2 inline" size={16}/> المدينة <span className="float-left">{cardCity}</span></div>
              <div className="rounded-full bg-white/14 px-3 py-2">😊 المزاج <span className="float-left">{cardMood}</span></div>
              <div className="rounded-full bg-white/14 px-3 py-2">🎮 اهتمامات مشتركة <span className="float-left">{Number(first?.shared_interests||0)}</span></div>
            </div>
            {mode==='voice'?<button onClick={playVoice} disabled={!first?.voice_intro_path||voicePlaying} className="tap-action mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-black text-[#6c25d9]"><Play size={17} fill="currentColor"/>{voicePlaying?'جاري التشغيل...':'تشغيل المقدمة الصوتية'}</button>:null}
          </div>
        </div>
        {target?<div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={()=>actOnCard('skip')} className="tap-action rounded-full bg-white/15 py-2.5 text-xs font-black">تخطي</button>
          <button onClick={()=>actOnCard('interest')} className="tap-action rounded-full bg-white py-2.5 text-xs font-black text-[#e41e91]">💗 اهتمام</button>
        </div>:<p className="text-center text-xs font-black text-white/85">لا توجد اقتراحات أخرى الآن.</p>}
      </section>

      <section className="pixel-card mt-4 rounded-[27px] p-4">
        <div className="flex items-center justify-center gap-3"><ShieldCheck className="text-[#13bfc8]" size={32}/><div><p className="text-[17px] font-black">محادثة عشوائية بموافقة الطرفين</p><p className="mt-1 text-[11px] font-bold text-[#76839a]">لن تبدأ المحادثة إلا بعد موافقة الشخص الآخر أيضًا</p></div></div>
        <button onClick={start} disabled={busy||waiting} className="tap-action lammetna-gradient hero-shadow mt-4 w-full rounded-[23px] py-4 text-[19px] font-black text-white">{waiting?'جاري انتظار شخص متاح...':busy?'جاري البحث...':'ابدأ محادثة عشوائية الآن'}</button>
      </section>

      {match?<section className="pixel-card mt-4 rounded-[28px] p-5 text-center">
        <button onClick={()=>r.push(`/people/${match.matched_user_id}`)} className="tap-action mx-auto block h-28 w-28 overflow-hidden rounded-full bg-[#eaf3fc] ring-4 ring-[#32d9e5]">{match.avatar_url?<img src={match.avatar_url} alt="" className="h-full w-full object-cover"/>:<img src={discoveryFallback[1]} alt="" className="h-full w-full object-cover"/>}</button>
        <h3 className="mt-3 text-xl font-black">{match.display_name}{match.age?`، ${match.age}`:''}</h3>
        <p className="text-sm font-bold text-[#738098]">{match.city_name||''} {match.mood?`· ${match.mood}`:''}</p>
        <button onClick={approve} className="tap-action lammetna-gradient mt-4 h-12 w-full rounded-2xl font-black text-white">موافق أتكلم</button>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <button onClick={skip} aria-label="تخطي" className="tap-action rounded-2xl bg-[#eef4fa] p-3"><SkipForward/></button>
          <button onClick={async()=>{const {data}=await s.rpc('toggle_interest',{p_target:match.matched_user_id});setNotice(data?'تم تسجيل الاهتمام 💗':'تم إلغاء الاهتمام.')}} aria-label="اهتمام" className="tap-action rounded-2xl bg-[#eef4fa] p-3"><Heart/></button>
          <button onClick={async()=>{
            const ok=await appConfirm({title:'حظر المستخدم',message:'لن يظهر لك هذا المستخدم مرة أخرى.',confirmLabel:'حظر',danger:true})
            if(ok){await s.rpc('block_user',{p_target:match.matched_user_id});setMatch(null);setNotice('تم الحظر.')}
          }} aria-label="حظر" className="tap-action rounded-2xl bg-[#eef4fa] p-3"><Ban/></button>
          <button onClick={async()=>{
            const reason=await appPrompt({title:'إبلاغ عن المستخدم',message:'اكتب سبب البلاغ باختصار.',placeholder:'سبب البلاغ...',confirmLabel:'إرسال البلاغ',danger:true})
            if(reason){await s.rpc('report_user',{p_target:match.matched_user_id,p_reason:'other',p_description:reason});setNotice('تم إرسال البلاغ للمراجعة.')}
          }} aria-label="إبلاغ" className="tap-action rounded-2xl bg-[#eef4fa] p-3"><Flag/></button>
        </div>
      </section>:null}

      <section className="mt-4"><p className="mb-2 text-sm font-black">ماذا يحدث بعد ذلك؟ ⓘ</p><div className="grid grid-cols-3 gap-2 text-center">
        <div className="pixel-card rounded-[21px] p-3"><Users className="mx-auto mb-1 text-[#13c9bd]"/><p className="text-[11px] font-black">موافقة متبادلة</p><p className="mt-1 text-[9px] font-bold text-[#78859b]">لبدء المحادثة</p></div>
        <div className="pixel-card rounded-[21px] p-3"><MessageCircle className="mx-auto mb-1 text-[#1768f4]"/><p className="text-[11px] font-black">تعرّف من خلال الحديث</p><p className="mt-1 text-[9px] font-bold text-[#78859b]">محادثة آمنة وممتعة</p></div>
        <div className="pixel-card rounded-[21px] p-3"><Eye className="mx-auto mb-1 text-[#7744ff]"/><p className="text-[11px] font-black">اكتشف تدريجيًا</p><p className="mt-1 text-[9px] font-bold text-[#78859b]">قد تظهر الصورة لاحقًا</p></div>
      </div></section>
    </main>
  </AppShell>
}
