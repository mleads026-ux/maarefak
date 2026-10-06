'use client'
import Link from 'next/link'
import {useEffect,useMemo,useState} from 'react'
import {Users,Heart,Mic2,MapPin,Eye,Star,Bell,ChevronLeft,LockKeyhole,Play,RefreshCw} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {BrandLogo} from '@/components/brand-logo'
import {
  discoveryRpcForMode,
  getDiscoveryCardView,
  normalizeNewFace,
  type DiscoveryMode,
} from '@/lib/discover-room'

export default function Discover(){
  const s=useMemo(()=>createClient(),[])
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

  useEffect(()=>{
    if(!userId)return
    const refresh=async()=>{
      const {data:w}=await s.from('star_wallets').select('balance').eq('user_id',userId).maybeSingle()
      setStars(Number(w?.balance||0))
    }
    const onWalletChange=()=>{void refresh()}
    window.addEventListener('lammetna:wallet-change',onWalletChange)
    return()=>window.removeEventListener('lammetna:wallet-change',onWalletChange)
  },[s,userId])

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
    showName,
    showImage,
    knownImage,
    cardName,
    cardCity,
    cardMood,
    promptText,
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
              <img src={knownImage} alt="" className={`h-full w-full object-cover ${showImage?'':'scale-110 blur-[18px]'}`}/>
              {!showImage?<span className="absolute inset-0 grid place-items-center text-6xl font-black text-white">?</span>:null}
            </div>
            {!showImage?<span className="absolute bottom-0 rounded-full bg-white px-3 py-2 text-[10px] font-black text-[#2450a4]"><LockKeyhole className="ml-1 inline" size={14}/> {mode==='voice'?'الصورة بعد التعارف':'الصورة مموهة في هذه البطاقة'}</span>:null}
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
            {mode==='mystery'&&promptText?<div className="mt-3 rounded-[18px] bg-white/14 px-3 py-3 text-[11px] font-black leading-5">💬 {promptText}</div>:null}
            {mode==='voice'?<button onClick={playVoice} disabled={!first?.voice_intro_path||voicePlaying} className="tap-action mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-black text-[#6c25d9]"><Play size={17} fill="currentColor"/>{voicePlaying?'جاري التشغيل...':'تشغيل المقدمة الصوتية'}</button>:null}
          </div>
        </div>
        {target?<button onClick={()=>actOnCard('interest')} disabled={advBusy} className="tap-action mt-2 w-full rounded-full bg-white py-2.5 text-xs font-black text-[#e41e91]">💗 تسجيل اهتمام</button>:<p className="text-center text-xs font-black text-white/85">لا توجد اقتراحات أخرى الآن.</p>}
      </section>

      <section className="pixel-card mt-4 rounded-[27px] p-4">
        <button onClick={()=>actOnCard('skip')} disabled={!target||advBusy} className="tap-action lammetna-gradient hero-shadow flex w-full items-center justify-center gap-2 rounded-[23px] py-4 text-[19px] font-black text-white disabled:opacity-60">
          <RefreshCw size={21} className={advBusy?'animate-spin':''}/>
          {advBusy?'جاري تحميل اقتراح جديد...':mode==='mystery'?'شخص غامض آخر':'اعرض اقتراحًا آخر'}
        </button>
        <p className="mt-2 text-center text-[11px] font-bold text-[#76839a]">{mode==='mystery'?'كل ضغطة تعرض لك بطاقة شخص غامض جديدة.':'يمكنك التنقل بين الاقتراحات بدون بدء محادثة عشوائية.'}</p>
      </section>

      <section className="mt-4"><p className="mb-2 text-sm font-black">كيف تستخدم «اكتشف»؟ ⓘ</p><div className="grid grid-cols-3 gap-2 text-center">
        <div className="pixel-card rounded-[21px] p-3"><Eye className="mx-auto mb-1 text-[#7744ff]"/><p className="text-[11px] font-black">شاهد الاقتراح</p><p className="mt-1 text-[9px] font-bold text-[#78859b]">بطاقة واحدة في كل مرة</p></div>
        <div className="pixel-card rounded-[21px] p-3"><RefreshCw className="mx-auto mb-1 text-[#1768f4]"/><p className="text-[11px] font-black">بدّل البطاقة</p><p className="mt-1 text-[9px] font-bold text-[#78859b]">اعرض شخصًا آخر فورًا</p></div>
        <div className="pixel-card rounded-[21px] p-3"><Heart className="mx-auto mb-1 text-[#e41e91]"/><p className="text-[11px] font-black">سجّل اهتمامك</p><p className="mt-1 text-[9px] font-bold text-[#78859b]">عندما يعجبك الاقتراح</p></div>
      </div></section>
    </main>
  </AppShell>
}
