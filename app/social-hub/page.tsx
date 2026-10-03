'use client'
import {useEffect,useMemo,useState} from 'react'
import {Camera,Heart,MessageCircle,Share2,MapPin,UserRound,Gift,MoreHorizontal,Play} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {BrandLogo} from '@/components/brand-logo'

export default function SocialHub(){
  const s=useMemo(()=>createClient(),[])
  const [visitors,setVisitors]=useState<any[]>([])
  const [count,setCount]=useState(0)
  const [q,setQ]=useState<any>(null)
  const [answer,setAnswer]=useState('')
  const [missions,setMissions]=useState<any[]>([])
  const [status,setStatus]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [profile,setProfile]=useState<any>(null)

  async function load(){
    setBusy(true)
    const {data:{user}}=await s.auth.getUser()
    if(!user){setBusy(false);return}
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
    const [v,c,dq,da,md,mc,p]=await Promise.all([
      s.rpc('get_my_profile_visitors',{p_limit:20}),
      s.rpc('my_profile_visitor_count'),
      s.from('daily_questions').select('id,question_ar').eq('active',true).eq('active_date',today).maybeSingle(),
      s.from('daily_answers').select('question_id,answer,highlighted_until').eq('user_id',user.id),
      s.from('daily_mission_definitions').select('code,title_ar,description_ar,reward_stars').eq('active',true),
      s.from('daily_mission_claims').select('mission_code,reward_stars').eq('user_id',user.id).eq('claim_date',today),
      s.from('profiles').select('display_name,avatar_url,cities(name_ar),birth_date,show_age').eq('id',user.id).single(),
    ])
    setVisitors(v.data||[])
    setCount(Number(c.data||0))
    setQ(dq.data||null)
    setAnswer((da.data||[]).find((x:any)=>x.question_id===dq.data?.id)?.answer||'')
    setMissions((md.data||[]).map((x:any)=>({...x,claimed:(mc.data||[]).some((y:any)=>y.mission_code===x.code)})))
    setProfile(p.data||null)
    setBusy(false)
  }

  useEffect(()=>{load()},[])

  async function saveAnswer(){
    if(!q||!answer.trim())return
    setBusy(true)
    const {error}=await s.rpc('answer_daily_question',{p_question:q.id,p_answer:answer.trim()})
    setNotice(error?'تعذر الحفظ.':'تم نشر إجابتك اليومية.')
    setBusy(false)
  }

  async function claim(code:string){
    setBusy(true)
    const {data,error}=await s.rpc('claim_daily_mission',{p_code:code})
    setNotice(error?'تعذر التنفيذ.':`تم استلام ${Number(data||0)} نجمة ⭐`)
    await load()
  }

  async function social(){
    if(!status.trim())return
    setBusy(true)
    const {error}=await s.rpc('set_social_status',{p_status:status.trim(),p_hours:24})
    setNotice(error?'تعذر النشر.':'تم نشر حالتك لمدة 24 ساعة.')
    setBusy(false)
  }

  const city=(profile?.cities as any)?.name_ar||'الرياض'
  const avatar=profile?.avatar_url||'/demo/face-1.jpg'

  return <AppShell>
    <main className="px-4 pb-5 pt-3">
      <header className="safe-top flex items-center justify-between">
        <div className="flex items-center gap-3"><BrandLogo size={58}/><div><h1 className="text-[33px] font-black">سوالف</h1><p className="text-[13px] font-bold text-[#6f7b93]">شارك لحظاتك وسوالفك مع الأصدقاء</p></div></div>
        <button className="lammetna-gradient grid h-[52px] w-[52px] place-items-center rounded-[20px] text-white shadow-lg"><Camera size={27}/></button>
      </header>

      <section className="pixel-card mt-4 rounded-[25px] p-4">
        <div className="flex items-center justify-between"><h2 className="font-black">🔥 المواضيع الرائجة</h2><span className="text-xs font-black text-[#703deb]">عرض الكل ‹</span></div>
        <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto">{['💗 حب','✨ جمال','✈️ سفر','☕ قهوة','👥 تعارف','# تقنية'].map(x=><span key={x} className="whitespace-nowrap rounded-[15px] bg-[linear-gradient(135deg,#fff0f8,#edf6ff)] px-3 py-2 text-xs font-black">{x}</span>)}</div>
      </section>

      {notice?<p className="mt-3 rounded-2xl bg-[#edf5ff] p-3 text-sm font-bold text-[#2b5288]">{notice}</p>:null}

      <article className="pixel-card mt-4 rounded-[27px] p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="relative"><img src={avatar} alt="" className="h-14 w-14 rounded-full object-cover"/><span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#11d092] ring-2 ring-white"/></div>
            <div><div className="flex items-center gap-1"><p className="font-black">{profile?.display_name||'صديق لمتنا'}</p><span className="text-[#0e67f5]">●</span><span className="text-xs">🔥</span></div><p className="mt-1 flex items-center gap-2 text-[11px] font-bold text-[#7a869b]"><span>♀ 28</span><span><MapPin className="inline" size={12}/> {city}</span></p></div>
          </div>
          <div className="flex items-center gap-2"><button className="rounded-full bg-[#ffe9f7] px-3 py-2 text-xs font-black text-[#ec2aa1]">💗 أرسل تحية</button><MoreHorizontal size={20}/></div>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_1.28fr] gap-3">
          <div><p className="text-[16px] font-bold leading-7">{q?.question_ar||'قهوة الصباح دائمًا هي فكرة جيدة ☕💙 ما رأيكم؟'}</p><textarea value={answer} onChange={e=>setAnswer(e.target.value)} className="mt-3 min-h-20 w-full rounded-[18px] bg-[#f3f7fb] p-3 text-sm outline-none" placeholder="اكتب إجابتك..."/><span className="mt-3 inline-flex rounded-full bg-[#f2eaff] px-3 py-1.5 text-xs font-black text-[#6930d8]"># قهوة</span></div>
          <img src="/demo/sawalif-coffee.jpg" alt="" className="h-[200px] w-full rounded-[20px] object-cover"/>
        </div>
        <button onClick={saveAnswer} disabled={busy||!answer.trim()} className="lammetna-gradient mt-3 rounded-[17px] px-4 py-2 text-sm font-black text-white">نشر الإجابة</button>
        <div className="mt-4 flex items-center justify-between text-[#45536c]"><p className="text-[11px] font-bold text-[#7a869b]">{city} · منذ 2 ساعة · 12.4 كم</p><div className="flex items-center gap-5"><span className="flex items-center gap-1 text-xs font-black"><Share2 size={19}/></span><span className="flex items-center gap-1 text-xs font-black"><MessageCircle size={19}/>8</span><span className="flex items-center gap-1 text-xs font-black text-[#e72596]"><Heart size={20} fill="#ff63ba"/>42</span></div></div>
      </article>

      <article className="pixel-card mt-4 rounded-[27px] p-4">
        <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-3"><div className="relative"><img src="/demo/face-2.jpg" alt="" className="h-14 w-14 rounded-full object-cover"/><span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#11d092] ring-2 ring-white"/></div><div><p className="font-black">مرّوا من هنا 👀</p><p className="mt-1 text-[11px] font-bold text-[#7a869b]">{count} زيارة لملفك</p></div></div><button className="rounded-full bg-[#ffe9f7] px-3 py-2 text-xs font-black text-[#ec2aa1]">💗 أرسل تحية</button></div>
        <div className="mt-4 grid grid-cols-[1fr_1.28fr] gap-3"><div><p className="text-[16px] font-bold leading-7">شوف مين زار ملفك مؤخرًا، وابدأ تعارف جديد من الناس المهتمة بيك.</p><div className="mt-4 flex -space-x-2 space-x-reverse">{visitors.slice(0,5).map((x:any,i:number)=><div key={x.view_id||i} className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#edf3f9]">{x.identity_revealed&&x.avatar_url?<img src={x.avatar_url} alt="" className="h-full w-full object-cover"/>:<UserRound size={18}/>}</div>)}</div><span className="mt-4 inline-flex rounded-full bg-[#eaf4ff] px-3 py-1.5 text-xs font-black text-[#0e67f5]"># تعارف</span></div><div className="relative"><img src="/demo/sawalif-sunset.jpg" alt="" className="h-[200px] w-full rounded-[20px] object-cover"/><span className="absolute inset-0 grid place-items-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-black/50 text-white"><Play fill="white"/></span></span></div></div>
        <div className="mt-4 flex items-center justify-between text-[#45536c]"><p className="text-[11px] font-bold text-[#7a869b]">منذ 5 ساعات</p><div className="flex items-center gap-5"><Share2 size={19}/><span className="flex items-center gap-1 text-xs font-black"><MessageCircle size={19}/>12</span><span className="flex items-center gap-1 text-xs font-black text-[#e72596]"><Heart size={20} fill="#ff63ba"/>96</span></div></div>
      </article>

      <article className="pixel-card mt-4 rounded-[27px] p-4">
        <div className="flex items-start justify-between"><div className="flex items-center gap-3"><img src="/demo/face-4.jpg" alt="" className="h-14 w-14 rounded-full object-cover"/><div><p className="font-black">مهمات اليوم 🎁</p><p className="text-[11px] font-bold text-[#7a869b]">اجمع نجومًا من نشاطك داخل لمتنا</p></div></div><MoreHorizontal size={20}/></div>
        <img src="/demo/sawalif-city.jpg" alt="" className="mt-4 h-[170px] w-full rounded-[20px] object-cover"/>
        <div className="mt-3 space-y-2">{missions.slice(0,4).map((m:any)=><div key={m.code} className="flex items-center justify-between rounded-[17px] bg-[#f4f8fc] p-3"><div><p className="text-sm font-black">{m.title_ar}</p><p className="text-[10px] font-bold text-[#77839a]">{m.description_ar}</p></div><button disabled={busy||m.claimed} onClick={()=>claim(m.code)} className={`rounded-full px-3 py-2 text-xs font-black ${m.claimed?'bg-[#e8eef4] text-[#8290a4]':'bg-[#fff4c6] text-[#8c6200]'}`}>{m.claimed?'تم':'+'+m.reward_stars+' ⭐'}</button></div>)}</div>
        <div className="mt-3 flex items-center gap-2"><input value={status} onChange={e=>setStatus(e.target.value)} className="h-11 flex-1 rounded-[16px] bg-[#f3f7fb] px-3 text-sm outline-none" placeholder="حالتك الآن..."/><button onClick={social} disabled={busy||!status.trim()} className="lammetna-gradient rounded-[16px] px-4 py-3 text-xs font-black text-white">نشر</button></div>
      </article>
    </main>
  </AppShell>
}
