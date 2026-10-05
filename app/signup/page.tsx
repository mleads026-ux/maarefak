'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Mail,Lock,Eye,EyeOff,CheckCircle2,Circle,ChevronLeft,X} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {friendlyError} from '@/lib/utils'
import {PixelHeroImage} from '@/components/pixel-hero-image'

const rules=(v:string)=>[
  ['8 أحرف على الأقل',v.length>=8],
  ['حرف كبير واحد على الأقل (A - Z)',/[A-Z]/.test(v)],
  ['حرف صغير واحد على الأقل (a - z)',/[a-z]/.test(v)],
  ['رقم واحد على الأقل (0 - 9)',/[0-9]/.test(v)],
  ['رمز خاص واحد على الأقل (!@#...)',/[^A-Za-z0-9]/.test(v)],
] as const

type LegalKind='terms'|'privacy'|'community'

export default function Signup(){
  const r=useRouter()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [show,setShow]=useState(false)
  const [checks,setChecks]=useState([false,false,false,false])
  const [otp,setOtp]=useState('')
  const [step,setStep]=useState<'form'|'otp'>('form')
  const [busy,setBusy]=useState(false)
  const [msg,setMsg]=useState('')
  const [resend,setResend]=useState(0)
  const [docs,setDocs]=useState<Record<string,any>>({})
  const [openDoc,setOpenDoc]=useState<LegalKind|null>(null)

  useEffect(()=>{if(resend<=0)return;const t=setInterval(()=>setResend(x=>Math.max(0,x-1)),1000);return()=>clearInterval(t)},[resend])
  useEffect(()=>{(async()=>{
    const s=createClient()
    const {data}=await s.from('legal_documents').select('kind,title_ar,content_ar,version').eq('active',true).in('kind',['terms','privacy','community'])
    setDocs(Object.fromEntries((data||[]).map((x:any)=>[x.kind,x])))
  })()},[])
  const ok=rules(password).every(([,v])=>v)&&checks.every(Boolean)

  async function accept(){
    const s=createClient()
    const {error}=await s.rpc('accept_current_legal',{p_adult_confirmed:checks[3]})
    if(error){setMsg('تعذر تسجيل الموافقات القانونية. حاول مرة أخرى.');return false}
    return true
  }
  async function signup(){
    if(!ok||!email.trim())return
    setBusy(true);setMsg('')
    const s=createClient()
    const {data,error}=await s.auth.signUp({email:email.trim(),password})
    if(error){setMsg(friendlyError(error.message));setBusy(false);return}
    if(data.session){
      setMsg('يلزم تأكيد البريد قبل دخول لمتنا.')
      r.push('/verify-email')
      r.refresh()
      setBusy(false)
      return
    }
    setStep('otp');setResend(60);setMsg('أرسلنا رمز تحقق من 6 أرقام إلى بريدك.');setBusy(false)
  }
  async function verify(){
    if(otp.length!==6)return
    setBusy(true)
    const s=createClient()
    const {error}=await s.auth.verifyOtp({email:email.trim(),token:otp,type:'signup'})
    if(error){setMsg(friendlyError(error.message));setBusy(false);return}
    if(await accept()){r.push('/onboarding');r.refresh()}
    setBusy(false)
  }
  async function resendOtp(){
    if(resend>0)return
    setBusy(true)
    const s=createClient()
    const {error}=await s.auth.resend({type:'signup',email:email.trim()})
    setMsg(error?friendlyError(error.message):'تم إرسال رمز جديد.')
    if(!error)setResend(60)
    setBusy(false)
  }

  const legalRows=[
    ['أوافق على الشروط والأحكام الخاصة بلمتنا','terms'],
    ['أوافق على سياسة الخصوصية','privacy'],
    ['أوافق على إرشادات المجتمع','community'],
  ] as const

  return <main className="mx-auto min-h-[100dvh] w-full max-w-[432px] overflow-hidden bg-[linear-gradient(180deg,#f9fdff,#eef8ff)]">
    <PixelHeroImage src="/pixel/signup-hero.jpg" alt="لمتنا" className="auth-reference-hero w-full" liveIcon="signup"/>
    <section className="auth-sheet-reference relative -mt-[18px] mx-0 min-h-[760px] rounded-t-[38px] bg-white px-5 pb-7 pt-7">
      {step==='otp'?<>
        <h2 className="text-center text-[32px] font-black">تأكيد البريد</h2>
        <p className="mt-2 text-center text-sm font-bold text-[#68758e]">أدخل الرمز المرسل إلى<br/><b className="text-[#125ff5]">{email}</b></p>
        <input value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" className="mt-7 h-16 w-full rounded-[22px] bg-[#f1f5fb] text-center text-3xl font-black tracking-[.35em] outline-none ring-1 ring-[#e0e9f5]" placeholder="000000"/>
        {msg?<p className="mt-3 rounded-2xl bg-[#eef5ff] p-3 text-sm font-bold text-[#2a4c80]">{msg}</p>:null}
        <button onClick={verify} disabled={busy||otp.length!==6} className="tap-action lammetna-gradient hero-shadow living-cta mt-5 h-16 w-full rounded-[24px] text-xl font-black text-white">تأكيد الحساب</button>
        <button onClick={resendOtp} disabled={busy||resend>0} className="tap-action mt-3 w-full py-3 text-sm font-black text-[#1745d6]">{resend>0?`إعادة الإرسال بعد ${resend} ثانية`:'إعادة إرسال الرمز'}</button>
      </>:<>
        <h2 className="text-center text-[34px] font-black">إنشاء حساب</h2>
        <p className="mt-2 text-center text-[15px] font-bold text-[#6b7891]">انضم إلى لمتنا وابدأ رحلتك مع أصدقاء جدد</p>

        <div className="mt-6 space-y-3">
          <div className="flex h-14 items-center gap-3 rounded-[20px] bg-[#f1f5fb] px-4 ring-1 ring-[#e0e9f5]">
            <Mail size={22}/><input className="min-w-0 flex-1 bg-transparent text-right outline-none" type="email" placeholder="البريد الإلكتروني" value={email} onChange={e=>setEmail(e.target.value)}/>
          </div>
          <div className="flex h-14 items-center gap-3 rounded-[20px] bg-[#f1f5fb] px-4 ring-1 ring-[#e0e9f5]">
            <Lock size={22}/><input className="min-w-0 flex-1 bg-transparent text-right outline-none" type={show?'text':'password'} placeholder="كلمة المرور" value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="tap-action" onClick={()=>setShow(!show)}>{show?<EyeOff size={22}/>:<Eye size={22}/>}</button>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-[#e0e9f4] bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-black">يجب أن تتكون كلمة المرور من:</p>
          {rules(password).map(([label,pass],i)=><div key={label} className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-[#66738d]">
            <span className="flex items-center gap-2"><b className="inline-block w-5 text-center text-base text-[#0b1b40]">{['🔒','A','a','1','@'][i]}</b>{label}</span>
            {pass?<CheckCircle2 className="text-[#12b984]" size={19}/>:<Circle className="text-[#9aabc1]" size={19}/>}
          </div>)}
        </div>

        <div className="mt-4 rounded-[24px] border border-[#e0e9f4] bg-white p-4 shadow-sm">
          {legalRows.map(([label,kind],i)=><div key={kind} className="mb-3 flex items-center justify-between gap-3 text-sm font-bold last:mb-0">
            <button type="button" onClick={()=>setOpenDoc(kind)} className="tap-action text-right text-[#163fbd] underline decoration-[#b7c8ff] underline-offset-4">{label}</button>
            <input type="checkbox" checked={checks[i]} onChange={e=>setChecks(c=>c.map((v,n)=>n===i?e.target.checked:v))} className="h-5 w-5 accent-[#155ff6]"/>
          </div>)}
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold">
            <span className="text-[#17223f]">أؤكد أن عمري 18 عامًا أو أكثر <span className="mr-2 rounded-full border border-red-500 px-1 py-[1px] text-[10px] font-black text-red-500">18+</span></span>
            <input type="checkbox" checked={checks[3]} onChange={e=>setChecks(c=>c.map((v,n)=>n===3?e.target.checked:v))} className="h-5 w-5 accent-[#155ff6]"/>
          </label>
        </div>

        {msg?<p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{msg}</p>:null}

        <button onClick={signup} disabled={busy||!ok||!email.trim()} className="tap-action lammetna-gradient hero-shadow living-cta mt-5 flex h-16 w-full items-center justify-between rounded-[25px] px-5 text-[22px] font-black text-white disabled:opacity-50">
          <span>{busy?'جاري الإنشاء...':'إنشاء حساب'}</span>
          <span className="grid h-11 w-11 place-items-center rounded-[16px] bg-white/25"><ChevronLeft size={27}/></span>
        </button>
        <p className="mt-5 text-center text-sm font-bold text-[#66738c]">لديك حساب بالفعل؟ <Link href="/login" className="tap-action font-black text-[#173fc8]">تسجيل الدخول</Link></p>
      </>}
    </section>

    {openDoc?<div className="fixed inset-0 z-[100] flex items-end bg-black/45" onClick={()=>setOpenDoc(null)}>
      <section onClick={e=>e.stopPropagation()} className="mx-auto max-h-[82vh] w-full max-w-[432px] overflow-y-auto rounded-t-[34px] bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 flex items-center justify-between bg-white pb-3"><div><h3 className="text-lg font-black">{docs[openDoc]?.title_ar||'المستند القانوني'}</h3><p className="text-[10px] font-bold text-[#7a869b]">الإصدار {docs[openDoc]?.version||'الحالي'}</p></div><button onClick={()=>setOpenDoc(null)} className="tap-action grid h-10 w-10 place-items-center rounded-full bg-[#eef3f8]"><X size={20}/></button></div>
        <div className="whitespace-pre-wrap text-sm font-medium leading-7 text-[#35435e]">{docs[openDoc]?.content_ar||'جاري تحميل المستند...'}</div>
      </section>
    </div>:null}

    <div className="h-7"/>
  </main>
}
