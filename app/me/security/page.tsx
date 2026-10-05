'use client'

import {useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Copy,ShieldCheck,ShieldOff,Smartphone,X} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {PageHeader} from '@/components/page-header'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'

type Factor={id:string;status:string;friendly_name?:string;created_at?:string}

export default function SecurityPage(){
  const s=useMemo(()=>createClient(),[])
  const r=useRouter()
  const [verified,setVerified]=useState<Factor[]>([])
  const [enroll,setEnroll]=useState<any>(null)
  const [code,setCode]=useState('')
  const [busy,setBusy]=useState(false)
  const [msg,setMsg]=useState('')
  const [copied,setCopied]=useState(false)

  async function load(){
    const {data:{user}}=await s.auth.getUser()
    if(!user){r.replace('/login');return}
    const {data,error}=await s.auth.mfa.listFactors()
    if(error){setMsg('تعذر تحميل إعدادات الأمان.');return}
    setVerified(((data?.totp||[]) as Factor[]).filter(x=>x.status==='verified'))
  }

  useEffect(()=>{load()},[])

  async function startEnroll(){
    setBusy(true);setMsg('');setCode('')
    const {data,error}=await s.auth.mfa.enroll({
      factorType:'totp',
      friendlyName:'Lammetna Authenticator'
    })
    if(error){
      setMsg('تعذر بدء إعداد التحقق بخطوتين.')
      setBusy(false)
      return
    }
    setEnroll(data)
    setBusy(false)
  }

  async function verifyEnroll(){
    if(!enroll?.id||code.length!==6)return
    setBusy(true);setMsg('')
    const {error}=await s.auth.mfa.challengeAndVerify({
      factorId:enroll.id,
      code
    })
    if(error){
      setMsg('الرمز غير صحيح. تأكد من الوقت في تطبيق الـAuthenticator وحاول مرة أخرى.')
      setBusy(false)
      return
    }
    setEnroll(null)
    setCode('')
    setMsg('تم تفعيل التحقق بخطوتين بنجاح ✅')
    await load()
    setBusy(false)
  }

  async function disableFactor(factorId:string){
    setBusy(true);setMsg('')
    const {data:aal}=await s.auth.mfa.getAuthenticatorAssuranceLevel()
    if(aal?.currentLevel!=='aal2'){
      r.push('/mfa?next=/me/security')
      return
    }
    const {error}=await s.auth.mfa.unenroll({factorId})
    if(error){
      setMsg('تعذر إلغاء التحقق بخطوتين.')
      setBusy(false)
      return
    }
    setMsg('تم إلغاء التحقق بخطوتين.')
    await s.auth.refreshSession()
    await load()
    setBusy(false)
  }

  async function copySecret(){
    const secret=enroll?.totp?.secret
    if(!secret)return
    try{
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(()=>setCopied(false),1200)
    }catch{
      setMsg('تعذر نسخ المفتاح.')
    }
  }

  return <AppShell>
    <PageHeader title="الأمان والتحقق بخطوتين"/>
    <main className="space-y-4 p-4">
      {msg?<p className="rounded-2xl bg-[#edf5ff] p-3 text-sm font-bold text-[#244e87]">{msg}</p>:null}

      <section className="rounded-[28px] bg-[linear-gradient(135deg,#0fd7df,#1768f4_54%,#7a42f4)] p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/16"><ShieldCheck size={29}/></span>
          <div>
            <h1 className="text-xl font-black">MFA — Authenticator</h1>
            <p className="mt-1 text-xs font-bold text-white/82">طبقة أمان إضافية بعد كلمة المرور.</p>
          </div>
        </div>
        <div className="mt-4 rounded-[20px] border border-white/30 bg-white/12 p-3 text-sm font-black">
          الحالة: {verified.length?'مفعّل ✅':'غير مفعّل'}
        </div>
      </section>

      {!verified.length&&!enroll?<section className="pixel-card rounded-[26px] p-4">
        <div className="flex items-center gap-3"><Smartphone className="text-[#1768f4]"/><div><h2 className="font-black">فعّل التحقق بخطوتين</h2><p className="mt-1 text-xs font-bold text-[#748198]">Google Authenticator أو Microsoft Authenticator أو 1Password.</p></div></div>
        <Button onClick={startEnroll} disabled={busy} className="mt-4 h-12 w-full rounded-2xl font-black">بدء التفعيل</Button>
      </section>:null}

      {enroll?<section className="pixel-card rounded-[26px] p-4">
        <div className="flex items-center justify-between"><div><h2 className="font-black">امسح QR Code</h2><p className="mt-1 text-xs font-bold text-[#748198]">وبعدها اكتب الكود المكوّن من 6 أرقام.</p></div><button onClick={()=>setEnroll(null)} className="tap-action grid h-9 w-9 place-items-center rounded-full bg-[#eef3f8]"><X size={17}/></button></div>

        <div className="mt-4 flex justify-center">
          {enroll?.totp?.qr_code?<img src={enroll.totp.qr_code} alt="MFA QR Code" className="h-56 w-56 rounded-2xl bg-white p-2 ring-1 ring-[#dce7f4]"/>:null}
        </div>

        <div className="mt-3 rounded-2xl bg-[#f3f7fc] p-3">
          <p className="text-[10px] font-black text-[#7b8799]">المفتاح اليدوي</p>
          <div className="mt-1 flex items-center gap-2" dir="ltr">
            <code className="min-w-0 flex-1 break-all text-left text-xs font-black">{enroll?.totp?.secret||'—'}</code>
            <button onClick={copySecret} className="tap-action grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#1768f4] ring-1 ring-[#dce7f4]">{copied?'✓':<Copy size={15}/>}</button>
          </div>
        </div>

        <Input
          value={code}
          onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="mt-4 h-14 rounded-2xl text-center text-2xl font-black tracking-[.24em]"
          placeholder="000000"
        />
        <Button onClick={verifyEnroll} disabled={busy||code.length!==6} className="mt-3 h-12 w-full rounded-2xl font-black">تأكيد وتفعيل MFA</Button>
      </section>:null}

      {verified.map(f=><section key={f.id} className="pixel-card rounded-[26px] p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[#e9f8f2] text-[#15956d]"><ShieldCheck size={24}/></span>
          <div className="min-w-0 flex-1"><p className="font-black">{f.friendly_name||'Authenticator'}</p><p className="mt-1 text-[11px] font-bold text-[#748198]">عامل TOTP موثّق</p></div>
        </div>
        <Button onClick={()=>disableFactor(f.id)} disabled={busy} variant="outline" className="mt-4 h-11 w-full rounded-2xl font-black text-red-600"><ShieldOff size={17}/>إلغاء MFA</Button>
      </section>)}

      <section className="rounded-[22px] border border-[#dce7f4] bg-white/80 p-4 text-xs font-bold leading-6 text-[#5f6d86]">
        بعد تفعيل MFA، أي تسجيل دخول جديد يبدأ بكلمة المرور ثم يطلب رمز الـAuthenticator قبل فتح الحساب.
      </section>
    </main>
  </AppShell>
}
