'use client'

import {useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {ShieldCheck} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'

export default function MfaPage(){
  const s=useMemo(()=>createClient(),[])
  const r=useRouter()
  const [nextPath,setNextPath]=useState('/home')
  const [factorId,setFactorId]=useState('')
  const [code,setCode]=useState('')
  const [busy,setBusy]=useState(false)
  const [msg,setMsg]=useState('')

  useEffect(()=>{(async()=>{
    const next=new URLSearchParams(location.search).get('next')
    const safeNext=next&&next.startsWith('/')?next:'/home'
    setNextPath(safeNext)

    const {data:{user}}=await s.auth.getUser()
    if(!user){r.replace('/login');return}

    const {data,error}=await s.auth.mfa.listFactors()
    if(error){setMsg('تعذر تحميل إعدادات التحقق بخطوتين.');return}

    const factor=(data?.totp||[]).find((x:any)=>x.status==='verified')
    if(!factor){
      r.replace(safeNext)
      return
    }

    const {data:aal}=await s.auth.mfa.getAuthenticatorAssuranceLevel()
    if(aal?.currentLevel==='aal2'){
      r.replace(safeNext)
      return
    }

    setFactorId(factor.id)
  })()},[s,r])

  async function verify(){
    if(!factorId||code.length!==6)return
    setBusy(true);setMsg('')
    const {error}=await s.auth.mfa.challengeAndVerify({factorId,code})
    if(error){
      setMsg('رمز التحقق غير صحيح أو انتهت صلاحيته.')
      setBusy(false)
      return
    }

    if(nextPath!=='/home'){
      r.replace(nextPath);r.refresh();return
    }

    const {data:{user}}=await s.auth.getUser()
    if(!user){r.replace('/login');return}
    const {data:p}=await s.from('profiles').select('profile_complete').eq('id',user.id).maybeSingle()
    r.replace(p?.profile_complete?'/home':'/onboarding')
    r.refresh()
  }

  async function cancel(){
    await s.auth.signOut()
    r.replace('/login')
    r.refresh()
  }

  return <main className="mx-auto flex min-h-[100dvh] w-full max-w-[432px] items-center bg-[linear-gradient(180deg,#f8fdff,#edf7ff)] px-5">
    <section className="w-full rounded-[32px] bg-white p-6 text-center shadow-[0_18px_54px_rgba(38,85,155,.14)] ring-1 ring-[#dce8f5]">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[linear-gradient(135deg,#14dce4,#1768f4,#7e3cff)] text-white shadow-[0_0_28px_rgba(39,151,246,.28)]">
        <ShieldCheck size={40}/>
      </span>
      <h1 className="mt-5 text-[27px] font-black">التحقق بخطوتين</h1>
      <p className="mt-2 text-sm font-bold leading-6 text-[#6d7890]">أدخل الرمز المكوّن من 6 أرقام من تطبيق الـAuthenticator.</p>

      <Input
        value={code}
        onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        className="mt-6 h-16 rounded-[22px] text-center text-3xl font-black tracking-[.28em]"
        placeholder="000000"
      />

      {msg?<p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{msg}</p>:null}

      <Button onClick={verify} disabled={busy||code.length!==6||!factorId} className="mt-5 h-14 w-full rounded-[20px] text-base font-black">
        {busy?'جاري التحقق...':'تأكيد الدخول'}
      </Button>
      <button onClick={cancel} className="tap-action mt-3 w-full py-3 text-sm font-black text-[#68758f]">إلغاء وتسجيل الخروج</button>
    </section>
  </main>
}
