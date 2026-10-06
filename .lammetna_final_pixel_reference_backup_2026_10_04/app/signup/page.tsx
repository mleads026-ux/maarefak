'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Mail,Lock,Eye,EyeOff,CheckCircle2,Circle,ChevronLeft} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {friendlyError} from '@/lib/utils'
import {BrandLogo} from '@/components/brand-logo'
const rules=(v:string)=>[
 ['8 أحرف على الأقل',v.length>=8],['حرف كبير واحد على الأقل (A - Z)',/[A-Z]/.test(v)],['حرف صغير واحد على الأقل (a - z)',/[a-z]/.test(v)],['رقم واحد على الأقل (0 - 9)',/[0-9]/.test(v)],['رمز خاص واحد على الأقل (!@#...)',/[^A-Za-z0-9]/.test(v)]
] as const
export default function Signup(){
 const r=useRouter(),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[checks,setChecks]=useState([false,false,false,false]),[otp,setOtp]=useState(''),[step,setStep]=useState<'form'|'otp'>('form'),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[resend,setResend]=useState(0)
 useEffect(()=>{if(resend<=0)return;const t=setInterval(()=>setResend(x=>Math.max(0,x-1)),1000);return()=>clearInterval(t)},[resend])
 const ok=rules(password).every(([,v])=>v)&&checks.every(Boolean)
 async function accept(){const s=createClient();const {error}=await s.rpc('accept_signup_legal');if(error){setMsg('تعذر تسجيل الموافقات القانونية. حاول مرة أخرى.');return false}return true}
 async function signup(){if(!ok||!email.trim())return;setBusy(true);setMsg('');const s=createClient();const {data,error}=await s.auth.signUp({email:email.trim(),password});if(error){setMsg(friendlyError(error.message));setBusy(false);return}if(data.session){if(await accept()){r.push('/onboarding');r.refresh()}setBusy(false);return}setStep('otp');setResend(60);setMsg('أرسلنا رمز تحقق من 6 أرقام إلى بريدك.');setBusy(false)}
 async function verify(){if(otp.length!==6)return;setBusy(true);const s=createClient();const {error}=await s.auth.verifyOtp({email:email.trim(),token:otp,type:'signup'});if(error){setMsg(friendlyError(error.message));setBusy(false);return}if(await accept()){r.push('/onboarding');r.refresh()}setBusy(false)}
 async function resendOtp(){if(resend>0)return;setBusy(true);const s=createClient();const {error}=await s.auth.resend({type:'signup',email:email.trim()});setMsg(error?friendlyError(error.message):'تم إرسال رمز جديد.');if(!error)setResend(60);setBusy(false)}
 return <main className="mx-auto min-h-[100dvh] max-w-md overflow-hidden bg-white/40">
  <div className="lammetna-gradient safe-top rounded-b-[42px] px-5 pb-9 text-white">
   <div className="flex flex-col items-center pt-5"><BrandLogo size={88}/><h1 className="mt-2 text-[38px] font-black">لمتنا</h1><p className="text-[16px] font-bold text-white/90">دائمًا مساحة أجمل مع أصدقاء جدد</p></div>
  </div>
  <section className="mobile-card relative -mt-4 rounded-t-[38px] px-5 pb-7 pt-7">
   {step==='otp'?<><h2 className="text-center text-[31px] font-black">تأكيد البريد</h2><p className="mt-2 text-center text-sm text-[#67758E]">أدخل الرمز المرسل إلى<br/><b className="text-[#125FF5]">{email}</b></p><input value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" className="mt-7 h-16 w-full rounded-[22px] bg-[#F2F7FC] text-center text-3xl font-black tracking-[.35em] outline-none" placeholder="000000"/>{msg?<p className="mt-3 rounded-2xl bg-[#EEF5FF] p-3 text-sm text-[#2A4C80]">{msg}</p>:null}<button onClick={verify} disabled={busy||otp.length!==6} className="lammetna-gradient mt-5 h-16 w-full rounded-[24px] text-xl font-black text-white hero-shadow">تأكيد الحساب</button><button onClick={resendOtp} disabled={busy||resend>0} className="mt-3 w-full py-3 text-sm font-black text-[#1745D6]">{resend>0?`إعادة الإرسال بعد ${resend} ثانية`:'إعادة إرسال الرمز'}</button></>:<>
    <h2 className="text-center text-[33px] font-black">إنشاء حساب</h2><p className="mt-2 text-center text-[15px] font-bold text-[#6D7993]">انضم إلى لمتنا وابدأ رحلتك مع أصدقاء جدد</p>
    <div className="mt-6 space-y-3">
     <div className="flex h-14 items-center gap-3 rounded-[20px] bg-[#F3F7FC] px-4 ring-1 ring-[#E7EEF7]"><Mail size={22}/><input className="min-w-0 flex-1 bg-transparent text-right outline-none" type="email" placeholder="البريد الإلكتروني" value={email} onChange={e=>setEmail(e.target.value)}/></div>
     <div className="flex h-14 items-center gap-3 rounded-[20px] bg-[#F3F7FC] px-4 ring-1 ring-[#E7EEF7]"><Lock size={22}/><input className="min-w-0 flex-1 bg-transparent text-right outline-none" type={show?'text':'password'} placeholder="كلمة المرور" value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={()=>setShow(!show)}>{show?<EyeOff size={22}/>:<Eye size={22}/>}</button></div>
    </div>
    <div className="mt-4 rounded-[23px] border border-[#E4EDF8] bg-white p-4 shadow-sm"><p className="mb-3 text-sm font-black">يجب أن تتكون كلمة المرور من:</p>{rules(password).map(([label,pass])=><div key={label} className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-[#66738E]"><span>{label}</span>{pass?<CheckCircle2 className="text-[#11B982]" size={19}/>:<Circle className="text-[#9CACBF]" size={19}/>}</div>)}</div>
    <div className="mt-4 rounded-[23px] border border-[#E4EDF8] bg-white p-4 shadow-sm">{['أوافق على الشروط والأحكام الخاصة بلمتنا','أوافق على سياسة الخصوصية','أوافق على إرشادات المجتمع','أؤكد أن عمري 18 عامًا أو أكثر'].map((label,i)=><label key={label} className="mb-3 flex cursor-pointer items-center justify-between gap-3 text-sm font-bold last:mb-0"><span>{label}{i===3?<span className="mr-2 rounded-full border border-red-500 px-1 text-[10px] font-black text-red-500">18+</span>:null}</span><input type="checkbox" checked={checks[i]} onChange={e=>setChecks(c=>c.map((v,n)=>n===i?e.target.checked:v))} className="h-5 w-5 accent-[#155FF6]"/></label>)}</div>
    {msg?<p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{msg}</p>:null}
    <button onClick={signup} disabled={busy||!ok||!email.trim()} className="lammetna-gradient mt-5 flex h-16 w-full items-center justify-between rounded-[24px] px-5 text-xl font-black text-white hero-shadow"><span>{busy?'جاري الإنشاء...':'إنشاء حساب'}</span><span className="grid h-10 w-10 place-items-center rounded-[15px] bg-white/25"><ChevronLeft/></span></button>
    <p className="mt-5 text-center text-sm font-bold text-[#67738C]">لديك حساب بالفعل؟ <Link href="/login" className="font-black text-[#173CC6]">تسجيل الدخول</Link></p>
   </>}
  </section>
 </main>
}
