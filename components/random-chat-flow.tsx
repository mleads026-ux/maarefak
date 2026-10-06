'use client'
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Ban,Flag,Heart,LoaderCircle,MapPin,RefreshCw,ShieldCheck,SkipForward,Users} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {appConfirm,appPrompt} from '@/components/interaction-dialog'
import {createRandomMatch,randomChatFallback,type RandomMatch} from '@/lib/random-chat'

type MatchPhase='searching'|'matched'|'error'

export function RandomChatFlow(){
  const s=useMemo(()=>createClient(),[])
  const r=useRouter()
  const started=useRef(false)
  const [userId,setUserId]=useState<string|null>(null)
  const [phase,setPhase]=useState<MatchPhase>('searching')
  const [match,setMatch]=useState<RandomMatch|null>(null)
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')

  useEffect(()=>{(async()=>{
    const {data:{user}}=await s.auth.getUser()
    if(!user){r.replace('/login');return}
    setUserId(user.id)
  })()},[r,s])

  const hydrate=useCallback(async(row:any)=>{
    if(!userId)return
    if(row.conversation_id){r.push(`/chats/${row.conversation_id}`);return}
    if(row.status!=='active'){return}
    const other=row.user_a===userId?row.user_b:row.user_a
    const [{data:p,error:profileError},{data:ageValue}]=await Promise.all([
      s.from('profiles').select('id,display_name,avatar_url,mood,show_age,cities(name_ar),countries(name_ar)').eq('id',other).single(),
      s.rpc('public_profile_age',{p_target:other}),
    ])
    if(profileError||!p){
      setNotice('تم العثور على شخص، لكن تعذر تحميل البطاقة الآن.')
      setPhase('error')
      return
    }
    setMatch(createRandomMatch({
      session:row,
      profile:p,
      age:ageValue,
      currentUserId:userId,
    }))
    setNotice('')
    setPhase('matched')
  },[r,s,userId])

  const beginSearch=useCallback(async()=>{
    if(!userId)return
    setBusy(true)
    setMatch(null)
    setNotice('')
    setPhase('searching')
    const {data,error}=await s.rpc('random_chat_match')
    const row=Array.isArray(data)?data[0]:data
    if(error){
      setNotice('تعذر بدء البحث الآن. حاول مرة أخرى.')
      setPhase('error')
      setBusy(false)
      return
    }
    if(row?.waiting){
      setBusy(false)
      return
    }
    if(row?.session_id){
      const {data:ses,error:sessionError}=await s.from('random_chat_sessions')
        .select('id,user_a,user_b,status,conversation_id,user_a_accepted,user_b_accepted')
        .eq('id',row.session_id)
        .single()
      if(sessionError||!ses){
        setNotice('تعذر تحميل جلسة الدردشة الآن.')
        setPhase('error')
      }else{
        await hydrate(ses)
      }
      setBusy(false)
      return
    }
    setNotice('لا يوجد شخص متاح الآن. يمكنك إعادة المحاولة.')
    setPhase('error')
    setBusy(false)
  },[hydrate,s,userId])

  useEffect(()=>{
    if(!userId)return
    const channel=s.channel(`random-consent-${userId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'random_chat_sessions'},(payload:any)=>{void hydrate(payload.new)})
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'random_chat_sessions'},(payload:any)=>{void hydrate(payload.new)})
      .subscribe()
    return()=>{s.removeChannel(channel)}
  },[hydrate,s,userId])

  useEffect(()=>{
    if(!userId||started.current)return
    started.current=true
    void beginSearch()
  },[beginSearch,userId])

  async function approve(){
    if(!match||!userId)return
    setBusy(true)
    const {data,error}=await s.rpc('start_random_chat_conversation',{p_session:match.session_id})
    if(error){
      setNotice('تعذر تسجيل الموافقة.')
      setBusy(false)
      return
    }
    if(data){r.push(`/chats/${data}`);return}
    setMatch(current=>current?(current.user_a===userId?{...current,user_a_accepted:true}:{...current,user_b_accepted:true}):current)
    setNotice('تم تسجيل موافقتك. بانتظار موافقة الطرف الآخر.')
    setBusy(false)
  }

  async function skip(){
    if(match)await s.rpc('decline_random_chat',{p_session:match.session_id})
    await beginSearch()
  }

  async function toggleInterest(){
    if(!match)return
    const {data,error}=await s.rpc('toggle_interest',{p_target:match.matched_user_id})
    setNotice(error?'تعذر تسجيل الاهتمام.':data?'تم تسجيل الاهتمام 💗':'تم إلغاء الاهتمام.')
  }

  async function block(){
    if(!match)return
    const ok=await appConfirm({title:'حظر المستخدم',message:'لن يظهر لك هذا المستخدم مرة أخرى.',confirmLabel:'حظر',danger:true})
    if(!ok)return
    await s.rpc('block_user',{p_target:match.matched_user_id})
    setNotice('تم الحظر. نبحث لك عن شخص آخر.')
    await beginSearch()
  }

  async function report(){
    if(!match)return
    const reason=await appPrompt({title:'إبلاغ عن المستخدم',message:'اكتب سبب البلاغ باختصار.',placeholder:'سبب البلاغ...',confirmLabel:'إرسال البلاغ',danger:true})
    if(!reason)return
    await s.rpc('report_user',{p_target:match.matched_user_id,p_reason:'other',p_description:reason})
    setNotice('تم إرسال البلاغ للمراجعة.')
  }

  const accepted=match&&userId
    ?(match.user_a===userId?match.user_a_accepted:match.user_b_accepted)
    :false

  if(phase==='searching'){
    return <section className="pixel-card mt-5 rounded-[31px] px-5 py-10 text-center">
      <div className="mx-auto grid h-32 w-32 place-items-center rounded-full bg-[linear-gradient(145deg,#eaf9ff,#f3eaff)] shadow-[0_16px_40px_rgba(43,88,180,.14)]">
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white shadow-inner">
          <LoaderCircle size={58} className="animate-spin text-[#1768f4]"/>
        </div>
      </div>
      <h2 className="mt-6 text-[25px] font-black">بنبحث لك عن شخص مناسب...</h2>
      <p className="mt-2 text-sm font-bold text-[#748198]">ثواني ونبدأ التعارف 👀</p>
      <div className="mx-auto mt-5 flex max-w-[280px] items-center justify-center gap-2 rounded-full bg-[#edf8ff] px-4 py-2.5 text-[11px] font-black text-[#2362a7]"><ShieldCheck size={17}/> لن تبدأ المحادثة إلا بعد موافقة الطرفين</div>
    </section>
  }

  if(phase==='error'||!match){
    return <section className="pixel-card mt-5 rounded-[31px] p-6 text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#edf5ff] text-[#1768f4]"><Users size={38}/></div>
      <h2 className="mt-4 text-xl font-black">مفيش شخص مناسب متاح حاليًا</h2>
      <p className="mt-2 text-sm font-bold text-[#748198]">{notice||'جرّب البحث مرة أخرى بعد لحظات.'}</p>
      <button onClick={beginSearch} disabled={busy} className="tap-action lammetna-gradient mt-5 flex w-full items-center justify-center gap-2 rounded-[22px] py-4 text-lg font-black text-white disabled:opacity-60"><RefreshCw size={20} className={busy?'animate-spin':''}/>{busy?'جاري البحث...':'حاول مرة أخرى'}</button>
    </section>
  }

  return <div className="mt-5 space-y-4">
    {notice?<p className="rounded-2xl bg-[#edf5ff] p-3 text-center text-sm font-bold text-[#24528d]">{notice}</p>:null}
    <section className="pixel-card overflow-hidden rounded-[31px] p-5 text-center">
      <div className="mx-auto h-36 w-36 overflow-hidden rounded-full bg-[#eaf3fc] ring-4 ring-[#32d9e5] shadow-xl">
        <img src={match.avatar_url||randomChatFallback} alt="" className="h-full w-full object-cover"/>
      </div>
      <span className="mt-4 inline-flex rounded-full bg-[#e9fbf7] px-3 py-1.5 text-[11px] font-black text-[#0f8b70]">تم العثور على شخص مناسب ✓</span>
      <h2 className="mt-3 text-[25px] font-black">{match.display_name}{match.age?`، ${match.age}`:''}</h2>
      <p className="mt-1 flex items-center justify-center gap-1 text-sm font-bold text-[#738098]"><MapPin size={15}/>{match.city_name||'بالقرب منك'}{match.mood?` · ${match.mood}`:''}</p>

      <button onClick={approve} disabled={busy||accepted} className="tap-action lammetna-gradient mt-5 h-14 w-full rounded-[22px] text-lg font-black text-white disabled:opacity-65">{accepted?'بانتظار موافقة الطرف الآخر...':busy?'جاري تسجيل الموافقة...':'موافق أبدأ التعارف'}</button>

      <button onClick={skip} disabled={busy} className="tap-action mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#eef4fa] font-black text-[#28405f]"><SkipForward size={18}/> شخص آخر</button>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button onClick={toggleInterest} aria-label="اهتمام" className="tap-action flex items-center justify-center gap-1 rounded-2xl bg-[#fff0f8] p-3 text-xs font-black text-[#d31f85]"><Heart size={17}/> اهتمام</button>
        <button onClick={block} aria-label="حظر" className="tap-action flex items-center justify-center gap-1 rounded-2xl bg-[#eef4fa] p-3 text-xs font-black"><Ban size={17}/> حظر</button>
        <button onClick={report} aria-label="إبلاغ" className="tap-action flex items-center justify-center gap-1 rounded-2xl bg-[#eef4fa] p-3 text-xs font-black"><Flag size={17}/> إبلاغ</button>
      </div>
    </section>

    <section className="rounded-[25px] border border-[#dce8f5] bg-white/85 p-4 text-center">
      <ShieldCheck className="mx-auto text-[#13bfc8]" size={28}/>
      <p className="mt-2 text-sm font-black">محادثة عشوائية بموافقة الطرفين</p>
      <p className="mt-1 text-[11px] font-bold leading-5 text-[#76839a]">العثور على البطاقة لا يفتح الشات تلقائيًا. المحادثة تبدأ فقط بعد موافقتكما.</p>
    </section>
  </div>
}
