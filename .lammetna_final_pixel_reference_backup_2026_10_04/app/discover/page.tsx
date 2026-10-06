'use client'
import {useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Users,Heart,Mic2,MapPin,Smile,Gamepad2,ShieldCheck,MessageCircle,Eye,Ban,Flag,SkipForward} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {PageHeader} from '@/components/page-header'

type Match={
  session_id:string
  matched_user_id:string
  display_name:string
  avatar_url:string|null
  city_name:string|null
  country_name:string|null
  mood:string|null
  age:number|null
  user_a:string
  user_b:string
  user_a_accepted:boolean
  user_b_accepted:boolean
}

export default function Discover(){
 const s=useMemo(()=>createClient(),[])
 const r=useRouter()
 const [waiting,setWaiting]=useState(false)
 const [busy,setBusy]=useState(false)
 const [match,setMatch]=useState<Match|null>(null)
 const [userId,setUserId]=useState<string|null>(null)
 const [notice,setNotice]=useState('')
 const [advanced,setAdvanced]=useState<any[]>([])
 const [mode,setMode]=useState<'vibe'|'mystery'|'voice'>('mystery')
 const [advBusy,setAdvBusy]=useState(false)

 useEffect(()=>{s.auth.getUser().then(({data})=>setUserId(data.user?.id||null))},[s])

 async function hydrate(row:any){
  if(!userId)return
  if(row.conversation_id){r.push(`/chats/${row.conversation_id}`);return}
  if(row.status!=='active'){setMatch(null);setWaiting(false);return}
  const other=row.user_a===userId?row.user_b:row.user_a
  const {data:p}=await s.from('profiles').select('id,display_name,avatar_url,mood,birth_date,show_age,cities(name_ar),countries(name_ar)').eq('id',other).single()
  if(!p)return
  setMatch({
   session_id:row.id,matched_user_id:other,display_name:p.display_name,avatar_url:p.avatar_url,
   city_name:(p.cities as any)?.name_ar||null,country_name:(p.countries as any)?.name_ar||null,mood:p.mood,
   age:p.show_age&&p.birth_date?Math.floor((Date.now()-new Date(p.birth_date).getTime())/31557600000):null,
   user_a:row.user_a,user_b:row.user_b,user_a_accepted:!!row.user_a_accepted,user_b_accepted:!!row.user_b_accepted
  })
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

 async function load(m:'vibe'|'mystery'|'voice'){
  setMode(m);setAdvBusy(true);setNotice('')
  const fn=m==='vibe'?'people_on_my_vibe':m==='mystery'?'mystery_discovery_cards':'voice_first_discovery'
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
  setMatch(null)
  await start()
 }

 const first=advanced[0]

 return <AppShell>
  <PageHeader title="اكتشف"/>
  <main className="px-4 pb-5 pt-4">
   <div>
    <h1 className="text-[30px] font-black">اكتشف ✨</h1>
    <p className="text-sm font-bold text-[#707C94]">تعرّف على أشخاص جدد بطرق مختلفة وممتعة</p>
   </div>

   <div className="mt-4 grid grid-cols-4 gap-2">
    {[
     [Users,'وجوه جديدة','vibe'],
     [Heart,'مين على مزاجي؟','vibe'],
     [Eye,'اكتشاف غامض','mystery'],
     [Mic2,'صوت أول','voice']
    ].map(([I,t,m]:any)=>
     <button key={t} onClick={()=>load(m)} className={`mobile-card rounded-[22px] p-3 text-center ${mode===m?'lammetna-gradient text-white':'text-[#13213E]'}`}>
      <span className={`mx-auto grid h-12 w-12 place-items-center rounded-[17px] ${mode===m?'bg-white/18':'bg-gradient-to-br from-[#E8F6FF] to-[#F5E7FF]'}`}>
       <I size={24}/>
      </span>
      <p className="mt-2 text-[11px] font-black">{t}</p>
     </button>
    )}
   </div>

   {advBusy?<p className="mt-3 text-center text-sm font-bold text-[#738097]">جاري التحميل...</p>:null}
   {notice?<p className="mt-3 rounded-2xl bg-[#EDF5FF] p-3 text-sm font-bold text-[#24528D]">{notice}</p>:null}

   <section className="lammetna-gradient hero-shadow relative mt-4 overflow-hidden rounded-[30px] p-5 text-white">
    <div className="absolute -left-16 -top-12 h-52 w-52 rounded-full bg-white/10 blur-2xl"/>
    <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-[#5A23D8]">
     {mode==='mystery'?'🎭 اكتشاف غامض':mode==='voice'?'🎙️ صوت أول':'✨ على مزاجي'}
    </span>
    <div className="mt-4 grid grid-cols-[150px_1fr] gap-4">
     <div className="relative grid h-[200px] place-items-center overflow-hidden rounded-[42%] border-2 border-white/60 bg-white/15">
      {mode==='mystery'?<>
       <div className="absolute inset-0 backdrop-blur-xl"/>
       <span className="relative text-7xl font-black">?</span>
      </>:first?.avatar_url?<img src={first.avatar_url} alt="" className="h-full w-full object-cover"/>:<span className="text-6xl font-black">?</span>}
      <span className="absolute bottom-3 rounded-full bg-white px-3 py-1 text-[10px] font-black text-[#16469F]">🔒 الصورة مكتشفة تدريجيًا</span>
     </div>
     <div>
      <h2 className="text-[29px] font-black">{mode==='mystery'?'شخص جديد':first?.display_name||'اكتشف شخصًا جديدًا'}</h2>
      <p className="mt-1 text-sm font-bold text-white/85">{first?.age?`${first.age} سنة`:''}</p>
      <div className="mt-4 space-y-2 text-xs font-black">
       <p className="rounded-full bg-white/13 px-3 py-2"><MapPin className="ml-1 inline" size={14}/>المدينة {first?.city_name||'غير محددة'}</p>
       <p className="rounded-full bg-white/13 px-3 py-2"><Smile className="ml-1 inline" size={14}/>المزاج {first?.mood||'رايق'}</p>
       <p className="rounded-full bg-white/13 px-3 py-2"><Gamepad2 className="ml-1 inline" size={14}/>اهتمامات مشتركة {first?.shared_interests||0}</p>
      </div>
     </div>
    </div>
   </section>

   <div className="mobile-card mt-4 rounded-[26px] p-4">
    <div className="flex items-center justify-center gap-3">
     <ShieldCheck className="text-[#10BFC9]" size={30}/>
     <div>
      <p className="font-black">محادثة عشوائية بموافقة الطرفين</p>
      <p className="mt-1 text-xs font-bold text-[#77839A]">لن تبدأ المحادثة إلا بعد موافقة الشخص الآخر أيضًا</p>
     </div>
    </div>
    <button onClick={start} disabled={busy||waiting} className="lammetna-gradient mt-4 w-full rounded-[22px] py-4 text-lg font-black text-white hero-shadow">
     {waiting?'جاري انتظار شخص متاح...':busy?'جاري البحث...':'ابدأ محادثة عشوائية الآن'}
    </button>
   </div>

   {match?<div className="mobile-card mt-4 rounded-[28px] p-5 text-center">
    <div className="mx-auto h-28 w-28 overflow-hidden rounded-full bg-[#EAF3FC]">
     {match.avatar_url?<img src={match.avatar_url} alt="" className="h-full w-full object-cover"/>:<div className="grid h-full w-full place-items-center text-4xl font-black">{match.display_name?.[0]}</div>}
    </div>
    <h3 className="mt-3 text-xl font-black">{match.display_name}{match.age?`، ${match.age}`:''}</h3>
    <p className="text-sm font-bold text-[#738098]">{match.city_name||''} {match.mood?`· ${match.mood}`:''}</p>
    <button onClick={approve} className="lammetna-gradient mt-4 h-12 w-full rounded-2xl font-black text-white">موافق أتكلم</button>
    <div className="mt-3 grid grid-cols-4 gap-2">
     <button onClick={skip} className="rounded-2xl bg-[#EEF4FA] p-3"><SkipForward/></button>
     <button onClick={()=>s.rpc('toggle_interest',{p_target:match.matched_user_id})} className="rounded-2xl bg-[#EEF4FA] p-3"><Heart/></button>
     <button onClick={()=>s.rpc('block_user',{p_target:match.matched_user_id})} className="rounded-2xl bg-[#EEF4FA] p-3"><Ban/></button>
     <button onClick={()=>s.rpc('report_user',{p_target:match.matched_user_id,p_reason:'other',p_description:'بلاغ من الدردشة العشوائية'})} className="rounded-2xl bg-[#EEF4FA] p-3"><Flag/></button>
    </div>
   </div>:null}

   <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-black text-[#354967]">
    <div className="mobile-card rounded-[20px] p-3"><Users className="mx-auto mb-1 text-[#10C9BC]"/>موافقة متبادلة</div>
    <div className="mobile-card rounded-[20px] p-3"><MessageCircle className="mx-auto mb-1 text-[#1768F4]"/>تعرّف من خلال الحديث</div>
    <div className="mobile-card rounded-[20px] p-3"><Eye className="mx-auto mb-1 text-[#7744FF]"/>اكتشف تدريجيًا</div>
   </div>
  </main>
 </AppShell>
}
