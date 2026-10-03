'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Mail,Lock,Eye,EyeOff,Users,ChevronLeft} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {friendlyError} from '@/lib/utils'
import {BrandLogo} from '@/components/brand-logo'

const strong=(v:string)=>v.length>=8&&/[a-z]/.test(v)&&/[A-Z]/.test(v)&&/[0-9]/.test(v)&&/[^A-Za-z0-9]/.test(v)

export default function Login(){
 const r=useRouter(),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[isReset,setIsReset]=useState(false),[p1,setP1]=useState(''),[p2,setP2]=useState('')
 useEffect(()=>setIsReset(new URLSearchParams(location.search).get('reset')==='1'),[])
 async function login(){setMsg('');setBusy(true);const s=createClient();const {error}=await s.auth.signInWithPassword({email:email.trim(),password});if(error){setMsg(friendlyError(error.message));setBusy(false);return}const {data:{user}}=await s.auth.getUser();if(!user){setMsg('تعذر تحميل الحساب.');setBusy(false);return}const {data:p}=await s.from('profiles').select('profile_complete').eq('id',user.id).single();r.push(p?.profile_complete?'/home':'/onboarding');r.refresh()}
 async function forgot(){if(!email.trim()){setMsg('أدخل بريدك الإلكتروني أولًا.');return}setBusy(true);const s=createClient();const {error}=await s.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${location.origin}/auth/callback?next=/login?reset=1`});setMsg(error?friendlyError(error.message):'تم إرسال رابط إعادة تعيين كلمة المرور.');setBusy(false)}
 async function reset(){if(!strong(p1)||p1!==p2){setMsg('تأكد من قوة كلمة المرور وتطابقها.');return}setBusy(true);const s=createClient();const {error}=await s.auth.updateUser({password:p1});if(error){setMsg(friendlyError(error.message));setBusy(false);return}await s.auth.signOut();location.replace('/login')}
 return <main className="mx-auto min-h-[100dvh] max-w-md overflow-hidden px-5 pb-8 pt-7">
  <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[360px] max-w-md bg-[radial-gradient(circle_at_20%_15%,rgba(18,221,229,.22),transparent_35%),radial-gradient(circle_at_83%_9%,rgba(167,83,255,.24),transparent_34%)]"/>
  <div className="relative">
   <div className="flex flex-col items-center pt-3"><BrandLogo size={92}/><h1 className="mt-4 text-[42px] font-black leading-none">لمتنا</h1><p className="mt-3 text-[17px] font-bold text-[#66738E]">دائمًا مساحة أجمل مع أصدقاء جدد</p></div>
   <section className="mobile-card mt-7 rounded-[34px] px-5 py-7">
    {isReset?<><h2 className="text-center text-[28px] font-black">كلمة مرور جديدة</h2><p className="mt-2 text-center text-sm text-[#6E7A94]">اختر كلمة مرور قوية لحسابك</p><div className="mt-6 space-y-3"><input className="h-14 w-full rounded-[20px] bg-[#F3F7FC] px-4 outline-none" type="password" placeholder="كلمة المرور الجديدة" value={p1} onChange={e=>setP1(e.target.value)}/><input className="h-14 w-full rounded-[20px] bg-[#F3F7FC] px-4 outline-none" type="password" placeholder="تأكيد كلمة المرور" value={p2} onChange={e=>setP2(e.target.value)}/></div>{msg?<p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{msg}</p>:null}<button onClick={reset} disabled={busy} className="lammetna-gradient mt-5 h-14 w-full rounded-[22px] text-lg font-black text-white shadow-lg">حفظ كلمة المرور</button></>:<>
     <h2 className="text-center text-[31px] font-black">تسجيل الدخول</h2><p className="mt-2 text-center text-[16px] font-bold text-[#65728D]">مرحبًا بك مجددًا في لمتنا 💜</p>
     <div className="mt-6 space-y-3">
      <div className="flex h-14 items-center gap-3 rounded-[20px] bg-[#F3F7FC] px-4 ring-1 ring-[#E7EEF7]"><Mail size={22} className="text-[#405271]"/><input className="min-w-0 flex-1 bg-transparent text-right outline-none" placeholder="البريد الإلكتروني" type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>
      <div className="flex h-14 items-center gap-3 rounded-[20px] bg-[#F3F7FC] px-4 ring-1 ring-[#E7EEF7]"><Lock size={22} className="text-[#405271]"/><input className="min-w-0 flex-1 bg-transparent text-right outline-none" placeholder="كلمة المرور" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={()=>setShow(!show)}>{show?<EyeOff size={22}/>:<Eye size={22}/>}</button></div>
     </div>
     <button onClick={forgot} className="mt-4 block text-sm font-black text-[#133CCB]">نسيت كلمة المرور؟</button>
     {msg?<p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{msg}</p>:null}
     <button onClick={login} disabled={busy||!email.trim()||password.length<6} className="lammetna-gradient mt-5 flex h-16 w-full items-center justify-between rounded-[24px] px-5 text-xl font-black text-white hero-shadow"><span>{busy?'جاري الدخول...':'تسجيل الدخول'}</span><span className="grid h-10 w-10 place-items-center rounded-[15px] bg-white text-[#6A28F5]"><ChevronLeft/></span></button>
     <div className="my-5 flex items-center gap-3 text-[#76829A]"><span className="h-px flex-1 bg-[#DCE5F0]"/><span>أو</span><span className="h-px flex-1 bg-[#DCE5F0]"/></div>
     <button onClick={()=>setMsg('متابعة كضيف غير مفعلة في النسخة الحالية.')} className="flex h-14 w-full items-center justify-center gap-2 rounded-[22px] bg-[#F8F4FF] text-lg font-black text-[#4D23D8] ring-1 ring-[#E7DFFF]"><Users size={21}/>متابعة كضيف</button>
     <p className="mt-6 text-center text-sm font-bold text-[#66738C]">ليس لديك حساب؟ <Link href="/signup" className="font-black text-[#173CC6]">إنشاء حساب</Link></p>
    </>}
   </section>
  </div>
 </main>
}
