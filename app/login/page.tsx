'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CrowdMark } from '@/components/crowd-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { friendlyError } from '@/lib/utils'

type Mode = 'login' | 'signup'
type Step = 'form' | 'otp'

export default function LoginPage() {
  const r = useRouter()

  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState<Step>('form')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')

  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)

  useEffect(() => {
    if (resendSeconds <= 0) return

    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [resendSeconds])

  async function submit() {
    setBusy(true)
    setMsg('')

    const s = createClient()

    if (mode === 'signup') {
      const { data, error } = await s.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: name.trim() },
        },
      })

      if (error) {
        setMsg(friendlyError(error.message))
        setBusy(false)
        return
      }

      if (data.session) {
        r.push('/onboarding')
        r.refresh()
        return
      }

      setStep('otp')
      setResendSeconds(60)
      setMsg('أرسلنا رمز تحقق من 6 أرقام إلى بريدك الإلكتروني.')
      setBusy(false)
      return
    }

    const { error } = await s.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setMsg(friendlyError(error.message))
      setBusy(false)
      return
    }

    const {
      data: { user },
    } = await s.auth.getUser()

    const { data: p } = await s
      .from('profiles')
      .select('profile_complete')
      .eq('id', user!.id)
      .single()

    r.push(p?.profile_complete ? '/home' : '/onboarding')
    r.refresh()
    setBusy(false)
  }

  async function verifyCode() {
    const code = otp.replace(/\D/g, '').slice(0, 6)

    if (code.length !== 6) {
      setMsg('أدخل رمز التحقق المكوّن من 6 أرقام.')
      return
    }

    setBusy(true)
    setMsg('')

    const s = createClient()

    const { error } = await s.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: 'signup',
    })

    if (error) {
      setMsg(friendlyError(error.message))
      setBusy(false)
      return
    }

    r.push('/onboarding')
    r.refresh()
  }

  async function resendCode() {
    if (resendSeconds > 0 || busy) return

    setBusy(true)
    setMsg('')

    const s = createClient()

    const { error } = await s.auth.resend({
      type: 'signup',
      email: email.trim(),
    })

    if (error) {
      setMsg(friendlyError(error.message))
      setBusy(false)
      return
    }

    setResendSeconds(60)
    setMsg('تم إرسال رمز جديد إلى بريدك الإلكتروني.')
    setBusy(false)
  }

  function resetToForm(nextMode: Mode) {
    setMode(nextMode)
    setStep('form')
    setOtp('')
    setMsg('')
    setResendSeconds(0)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-5">
      <div className="w-full">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 -translate-y-1 grid h-20 w-20 place-items-center rounded-[28px] bg-[#006B57] text-white shadow-sm">
            <CrowdMark size={54} />
          </div>

          <h1 className="text-2xl font-extrabold">لمتنا</h1>
          <p className="mt-1 text-sm text-slate-500">
            لمّتنا تبدأ بخطوة
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 p-5">
            {step === 'otp' ? (
              <>
                <div className="pb-2 text-center">
                  <h2 className="text-lg font-extrabold">تأكيد البريد الإلكتروني</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    أدخل رمز التحقق المكوّن من 6 أرقام المرسل إلى
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#006B57]">
                    {email}
                  </p>
                </div>

                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={otp}
                  maxLength={6}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  className="h-14 text-center text-2xl font-black tracking-[0.35em]"
                />

                {msg ? (
                  <p className="rounded-2xl bg-slate-50 p-3 text-center text-sm text-slate-600">
                    {msg}
                  </p>
                ) : null}

                <Button
                  className="w-full"
                  disabled={busy || otp.length !== 6}
                  onClick={verifyCode}
                >
                  {busy ? 'جاري التحقق...' : 'تأكيد الحساب'}
                </Button>

                <Button
                  className="w-full"
                  variant="ghost"
                  disabled={busy || resendSeconds > 0}
                  onClick={resendCode}
                >
                  {resendSeconds > 0
                    ? `إعادة إرسال الكود بعد ${resendSeconds} ثانية`
                    : 'إعادة إرسال الكود'}
                </Button>

                <Button
                  className="w-full"
                  variant="ghost"
                  onClick={() => {
                    setStep('form')
                    setOtp('')
                    setMsg('')
                  }}
                >
                  تغيير البريد الإلكتروني
                </Button>
              </>
            ) : (
              <>
                {mode === 'signup' ? (
                  <Input
                    placeholder="الاسم الظاهر"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                ) : null}

                <Input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <Input
                  type="password"
                  placeholder="كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                {msg ? (
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                    {msg}
                  </p>
                ) : null}

                <Button
                  className="w-full"
                  disabled={
                    busy ||
                    !email.trim() ||
                    password.length < 6 ||
                    (mode === 'signup' && !name.trim())
                  }
                  onClick={submit}
                >
                  {busy
                    ? 'جاري التنفيذ...'
                    : mode === 'login'
                      ? 'تسجيل الدخول'
                      : 'إنشاء الحساب'}
                </Button>

                <Button
                  className="w-full"
                  variant="ghost"
                  onClick={() =>
                    resetToForm(mode === 'login' ? 'signup' : 'login')
                  }
                >
                  {mode === 'login'
                    ? 'إنشاء حساب جديد'
                    : 'لدي حساب بالفعل'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-400">
          باستخدام لمتنا أنت تقر بأن عمرك 18 سنة فأكثر.
        </p>
      </div>
    </main>
  )
}
