'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Mail,Lock,Eye,EyeOff,Users,ChevronLeft} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {friendlyError} from '@/lib/utils'
import {BrandLogo} from '@/components/brand-logo'
import {StatusBarMock} from '@/components/status-bar-mock'

const strong=(v:string)=>v.length>=8&&/[a-z]/.test(v)&&/[A-Z]/.test(v)&&/[0-9]/.test(v)&&/[^A-Za-z0-9]/.test(v)

export default function Login(){
  const r=useRouter()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [show,setShow]=useState(false)
  const [busy,setBusy]=useState(false)
  const [msg,setMsg]=useState('')
  const [isReset,setIsReset]=useState(false)
  const [p1,setP1]=useState('')
  const [p2,setP2]=useState('')
  useEffect(()=>setIsReset(new URLSearchParams(location.search).get('reset')==='1'),[])

  async function login(){
    setMsg('');setBusy(true)
    const s=createClient()
    const {error}=await s.auth.signInWithPassword({email:email.trim(),password})
    if(error){setMsg(friendlyError(error.message));setBusy(false);return}
    const {data:{user}}=await s.auth.getUser()
    if(!user){setMsg('تعذر تحميل الحساب.');setBusy(false);return}
    const {data:p}=await s.from('profiles').select('profile_complete').eq('id',user.id).single()
    r.push(p?.profile_complete?'/home':'/onboarding');r.refresh()
  }

  async function forgot(){
    if(!email.trim()){setMsg('أدخل بريدك الإلكتروني أولًا.');return}
    setBusy(true)
    const s=createClient()
    const {error}=await s.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${location.origin}/auth/callback?next=/login?reset=1`})
    setMsg(error?friendlyError(error.message):'تم إرسال رابط إعادة تعيين كلمة المرور.')
    setBusy(false)
  }

  async function reset(){
    if(!strong(p1)||p1!==p2){setMsg('تأكد من قوة كلمة المرور وتطابقها.');return}
    setBusy(true)
    const s=createClient()
    const {error}=await s.auth.updateUser({password:p1})
    if(error){setMsg(friendlyError(error.message));setBusy(false);return}
    await s.auth.signOut()
    location.replace('/login')
  }

  return <main className="mx-auto min-h-[100dvh] w-full max-w-[432px] overflow-hidden bg-[radial-gradient(circle_at_8%_10%,rgba(23,224,233,.20),transparent_26%),radial-gradient(circle_at_92%_12%,rgba(167,80,255,.23),transparent_30%),linear-gradient(180deg,#f9fdff,#f3f9ff_62%,#eef8ff)] px-5 pb-7">
    <StatusBarMock/>
    <div className="relative pt-6 text-center">
      <div className="pointer-events-none absolute -left-20 top-10 h-52 w-52 rounded-full border-[22px] border-white/26"/>
      <div className="pointer-events-none absolute -right-16 top-20 h-52 w-52 rounded-full border-[22px] border-white/24"/>
      <BrandLogo size={112} className="mx-auto shadow-[0_22px_48px_rgba(80,78,255,.24)]"/>
      <h1 className="mt-4 text-[47px] font-black leading-none tracking-tight">لمتنا</h1>
      <p className="mt-3 text-[17px] font-bold text-[#66728c]">دائمًا مساحة أجمل مع أصدقاء جدد</p>
    </div>

    <section className="pixel-card relative mt-8 rounded-[38px] px-5 pb-7 pt-7">
      {isReset?<>
        <h2 className="text-center text-[30px] font-black">كلمة مرور جديدة</h2>
        <p className="mt-2 text-center text-sm font-bold text-[#6f7b95]">اختر كلمة مرور قوية لحسابك</p>
        <div className="mt-6 space-y-3">
          <input className="h-14 w-full rounded-[20px] bg-[#f1f5fb] px-4 outline-none ring-1 ring-[#e0e9f5]" type="password" placeholder="كلمة المرور الجديدة" value={p1} onChange={e=>setP1(e.target.value)}/>
          <input className="h-14 w-full rounded-[20px] bg-[#f1f5fb] px-4 outline-none ring-1 ring-[#e0e9f5]" type="password" placeholder="تأكيد كلمة المرور" value={p2} onChange={e=>setP2(e.target.value)}/>
        </div>
        {msg?<p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{msg}</p>:null}
        <button onClick={reset} disabled={busy} className="lammetna-gradient hero-shadow mt-5 h-[60px] w-full rounded-[24px] py-4 text-lg font-black text-white">حفظ كلمة المرور</button>
      </>:<>
        <h2 className="text-center text-[32px] font-black">تسجيل الدخول</h2>
        <p className="mt-2 text-center text-[16px] font-bold text-[#66728c]">مرحبًا بك مجددًا في لمتنا 💜</p>

        <div className="mt-6 space-y-3">
          <div className="flex h-14 items-center gap-3 rounded-[20px] bg-[#f1f5fb] px-4 ring-1 ring-[#e0e9f5]">
            <Mail size={22} className="text-[#40506e]"/>
            <input className="min-w-0 flex-1 bg-transparent text-right text-[15px] outline-none placeholder:text-[#6f7b92]" placeholder="البريد الإلكتروني" type="email" value={email} onChange={e=>setEmail(e.target.value)}/>
          </div>
          <div className="flex h-14 items-center gap-3 rounded-[20px] bg-[#f1f5fb] px-4 ring-1 ring-[#e0e9f5]">
            <Lock size={22} className="text-[#40506e]"/>
            <input className="min-w-0 flex-1 bg-transparent text-right text-[15px] outline-none placeholder:text-[#6f7b92]" placeholder="كلمة المرور" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)}/>
            <button type="button" onClick={()=>setShow(!show)} className="text-[#3e4e6c]">{show?<EyeOff size={22}/>:<Eye size={22}/>}</button>
          </div>
        </div>

        <button onClick={forgot} className="mt-4 block text-sm font-black text-[#143dd0]">نسيت كلمة المرور؟</button>
        {msg?<p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{msg}</p>:null}

        <button onClick={login} disabled={busy||!email.trim()||password.length<6} className="lammetna-gradient hero-shadow mt-5 flex h-16 w-full items-center justify-between rounded-[25px] px-5 text-[22px] font-black text-white disabled:opacity-50">
          <span>{busy?'جاري الدخول...':'تسجيل الدخول'}</span>
          <span className="grid h-11 w-11 place-items-center rounded-[16px] bg-white text-[#7222e5]"><ChevronLeft size={27}/></span>
        </button>

        <div className="my-5 flex items-center gap-3 text-[#6f7b93]"><span className="h-px flex-1 bg-[#d9e3ef]"/><span className="text-sm font-bold">أو</span><span className="h-px flex-1 bg-[#d9e3ef]"/></div>

        <button type="button" onClick={()=>setMsg('متابعة كضيف غير مفعلة في النسخة الحالية.')} className="flex h-14 w-full items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,#fbfaff,#f4efff)] text-[17px] font-black text-[#4e20db] ring-1 ring-[#e6ddff]">
          <Users size={21}/>متابعة كضيف
        </button>
        <p className="mt-6 text-center text-sm font-bold text-[#64718c]">ليس لديك حساب؟ <Link href="/signup" className="font-black text-[#173fc8]">إنشاء حساب</Link></p>
      </>}
    </section>
  </main>
}
