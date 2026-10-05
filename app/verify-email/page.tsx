'use client'

import {useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {MailCheck,RefreshCw,LogOut} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'

export default function VerifyEmailRequired(){
  const s=useMemo(()=>createClient(),[])
  const r=useRouter()
  const [email,setEmail]=useState('')
  const [msg,setMsg]=useState('نتأكد من حالة البريد...')
  const [otp,setOtp]=useState('')
  const [busy,setBusy]=useState(false)

  useEffect(()=>{(async()=>{
    const {data:{user}}=await s.auth.getUser()
    if(!user){r.replace('/login');return}
    setEmail(user.email||'')
    const {data:ready}=await s.rpc('current_user_email_verified_for_launch')
    if(ready===true){r.replace('/legal');r.refresh();return}
    setMsg('هذا الحساب يحتاج تأكيد البريد قبل دخول لمتنا.')
  })()},[])

  async function resend(){
    if(!email||busy)return
    setBusy(true)
    const {error}=await s.auth.resend({type:'signup',email})
    setMsg(error
      ?'تعذر إرسال رمز التأكيد. تأكد أن Email Confirmation وSMTP مفعّلان في إعدادات Supabase.'
      :'تم إرسال رمز تأكيد جديد إلى بريدك.')
    setBusy(false)
  }

  async function verifyOtp(){
    if(!email||otp.length!==6||busy)return
    setBusy(true)
    const {error}=await s.auth.verifyOtp({email,token:otp,type:'signup'})
    if(error){
      setMsg('رمز التأكيد غير صحيح أو انتهت صلاحيته.')
      setBusy(false)
      return
    }
    const {data:ready}=await s.rpc('current_user_email_verified_for_launch')
    if(ready===true){
      r.replace('/legal')
      r.refresh()
      return
    }
    setMsg('تم التحقق من الرمز، لكن إعداد تأكيد البريد على الخادم ما زال غير مكتمل.')
    setBusy(false)
  }

  async function logout(){
    await s.auth.signOut()
    r.replace('/login')
    r.refresh()
  }

  return <main className="mx-auto flex min-h-[100dvh] w-full max-w-[432px] items-center bg-[linear-gradient(180deg,#f9fdff,#eef8ff)] px-5">
    <section className="w-full rounded-[34px] bg-white p-6 text-center shadow-xl">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#eaf4ff] text-[#1560BD]"><MailCheck size={38}/></div>
      <h1 className="mt-5 text-2xl font-black">تأكيد البريد مطلوب</h1>
      <p className="mt-2 text-sm font-bold leading-6 text-[#68758e]">{email||'البريد المسجل'}</p>
      <p className="mt-4 rounded-2xl bg-[#f4f8fd] p-4 text-sm font-bold leading-6 text-[#42516b]">{msg}</p>
      <input value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" placeholder="000000" className="mt-5 h-14 w-full rounded-[20px] bg-[#f1f5fb] text-center text-2xl font-black tracking-[.35em] outline-none ring-1 ring-[#e0e9f5]"/>
      <button onClick={verifyOtp} disabled={busy||otp.length!==6} className="tap-action mt-3 h-14 w-full rounded-[20px] bg-[#173fc8] font-black text-white disabled:opacity-50">تأكيد الرمز</button>
      <button onClick={resend} disabled={busy||!email} className="tap-action lammetna-gradient mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-[20px] font-black text-white disabled:opacity-50">
        <RefreshCw size={18}/>{busy?'جاري الإرسال...':'إعادة إرسال التأكيد'}
      </button>
      <button onClick={logout} className="tap-action mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-[#eef3f8] font-black text-[#42516b]">
        <LogOut size={18}/> تسجيل الخروج
      </button>
    </section>
  </main>
}
