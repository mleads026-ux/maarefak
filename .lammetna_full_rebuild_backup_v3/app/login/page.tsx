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

const isStrongPassword = (value: string) =>
  value.length >= 8 &&
  /[a-z]/.test(value) &&
  /[A-Z]/.test(value) &&
  /[0-9]/.test(value) &&
  /[^A-Za-z0-9]/.test(value)

export default function LoginPage() {
  const r = useRouter()

  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [legalAccepted, setLegalAccepted] = useState(false)

  const [isReset, setIsReset] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [resetPassword2, setResetPassword2] = useState('')

  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)

  useEffect(() => {
    setIsReset(
      new URLSearchParams(window.location.search).get('reset') === '1',
    )
  }, [])

  useEffect(() => {
    if (resendSeconds <= 0) return

    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [resendSeconds])

  async function acceptSignupLegal() {
    const s = createClient()
    const { error } = await s.rpc('accept_signup_legal')

    if (error) {
      setMsg(
        'تم إنشاء الحساب، لكن تعذر تسجيل الموافقات القانونية. حاول مرة أخرى.',
      )
      return false
    }

    return true
  }

  async function submit() {
    setMsg('')

    if (!email.trim()) {
      setMsg('أدخل بريدك الإلكتروني.')
      return
    }

    if (mode === 'signup') {
      if (!isStrongPassword(password)) {
        setMsg(
          'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف كبير وصغير ورقم ورمز.',
        )
        return
      }

      if (!legalAccepted) {
        setMsg(
          'يجب الموافقة على الشروط وسياسة الخصوصية ومعايير المجتمع وتأكيد أن عمرك 18 سنة فأكثر.',
        )
        return
      }
    }

    setBusy(true)
    const s = createClient()

    if (mode === 'signup') {
      const { data, error } = await s.auth.signUp({
        email: email.trim(),
        password,
      })

      if (error) {
        setMsg(friendlyError(error.message))
        setBusy(false)
        return
      }

      if (data.session) {
        const accepted = await acceptSignupLegal()
        if (!accepted) {
          setBusy(false)
          return
        }

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
      error: userError,
    } = await s.auth.getUser()

    if (userError || !user) {
      setMsg('تعذر تحميل بيانات الحساب. حاول تسجيل الدخول مرة أخرى.')
      setBusy(false)
      return
    }

    const { data: profile, error: profileError } = await s
      .from('profiles')
      .select('profile_complete')
      .eq('id', user.id)
      .single()

    if (profileError) {
      setMsg(friendlyError(profileError.message))
      setBusy(false)
      return
    }

    r.push(profile?.profile_complete ? '/home' : '/onboarding')
    r.refresh()
  }

  async function forgotPassword() {
    setMsg('')

    if (!email.trim()) {
      setMsg('أدخل بريدك الإلكتروني أولًا.')
      return
    }

    setBusy(true)

    const s = createClient()
    const { error } = await s.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/login?reset=1`,
    })

    setMsg(
      error
        ? friendlyError(error.message)
        : 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك.',
    )
    setBusy(false)
  }

  async function finishPasswordReset() {
    setMsg('')

    if (!isStrongPassword(resetPassword)) {
      setMsg(
        'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف كبير وصغير ورقم ورمز.',
      )
      return
    }

    if (resetPassword !== resetPassword2) {
      setMsg('كلمتا المرور غير متطابقتين.')
      return
    }

    setBusy(true)

    const s = createClient()
    const { error } = await s.auth.updateUser({
      password: resetPassword,
    })

    if (error) {
      setMsg(friendlyError(error.message))
      setBusy(false)
      return
    }

    await s.auth.signOut()
    window.location.replace('/login?reset_done=1')
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

    const accepted = await acceptSignupLegal()
    if (!accepted) {
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
    setPassword('')
    setLegalAccepted(false)
    setResendSeconds(0)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-5">
      <div className="w-full">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 -translate-y-1 grid h-20 w-20 place-items-center rounded-[28px] bg-gradient-to-br from-[#20CADB] via-[#1560BD] to-[#7657FF] text-white shadow-[0_16px_36px_rgba(21,96,189,.20)]">
            <CrowdMark size={54} />
          </div>

          <h1 className="text-2xl font-extrabold">لمتنا</h1>
          <p className="mt-1 text-sm text-slate-500">
            مكانك للتعارف واللمة الصوتية
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 p-5">
            {isReset ? (
              <div
                data-password-reset-panel
                className="space-y-3"
              >
                <h2 className="text-center text-lg font-extrabold">
                  تعيين كلمة مرور جديدة
                </h2>

                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="كلمة المرور الجديدة"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />

                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="تأكيد كلمة المرور"
                  value={resetPassword2}
                  onChange={(e) => setResetPassword2(e.target.value)}
                />

                <p className="text-xs leading-5 text-slate-500">
                  8 أحرف على الأقل + حرف كبير + حرف صغير + رقم + رمز.
                </p>

                {msg ? (
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                    {msg}
                  </p>
                ) : null}

                <Button
                  className="w-full"
                  disabled={
                    busy ||
                    !isStrongPassword(resetPassword) ||
                    resetPassword !== resetPassword2
                  }
                  onClick={finishPasswordReset}
                >
                  {busy
                    ? 'جاري الحفظ...'
                    : 'حفظ كلمة المرور الجديدة'}
                </Button>
              </div>
            ) : step === 'otp' ? (
              <>
                <div className="pb-2 text-center">
                  <h2 className="text-lg font-extrabold">
                    تأكيد البريد الإلكتروني
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    أدخل رمز التحقق المكوّن من 6 أرقام المرسل إلى
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#1560BD]">
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
                    setOtp(
                      e.target.value.replace(/\D/g, '').slice(0, 6),
                    )
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
                  disabled={busy}
                  onClick={() => {
                    setStep('form')
                    setOtp('')
                    setMsg('')
                    setResendSeconds(0)
                  }}
                >
                  تغيير البريد الإلكتروني
                </Button>
              </>
            ) : (
              <>
                {mode === 'signup' ? (
                  <label className="flex items-start gap-2 rounded-2xl bg-[#F4F8FD] p-3 text-xs leading-5 text-slate-600">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={legalAccepted}
                      onChange={(e) =>
                        setLegalAccepted(e.target.checked)
                      }
                    />
                    <span>
                      أوافق على شروط الاستخدام وسياسة الخصوصية
                      ومعايير المجتمع، وأؤكد أن عمري 18 سنة فأكثر.
                    </span>
                  </label>
                ) : null}

                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="البريد الإلكتروني"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <Input
                  type="password"
                  autoComplete={
                    mode === 'login'
                      ? 'current-password'
                      : 'new-password'
                  }
                  placeholder="كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                {mode === 'signup' ? (
                  <p className="text-xs leading-5 text-slate-500">
                    كلمة المرور: 8 أحرف على الأقل + حرف كبير +
                    حرف صغير + رقم + رمز.
                  </p>
                ) : null}

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
                    (mode === 'login'
                      ? password.length < 6
                      : !isStrongPassword(password) ||
                        !legalAccepted)
                  }
                  onClick={submit}
                >
                  {busy
                    ? 'جاري التنفيذ...'
                    : mode === 'login'
                      ? 'تسجيل الدخول'
                      : 'إنشاء الحساب'}
                </Button>

                {mode === 'login' ? (
                  <Button
                    className="w-full"
                    variant="ghost"
                    disabled={busy}
                    onClick={forgotPassword}
                  >
                    نسيت كلمة المرور؟
                  </Button>
                ) : null}

                <Button
                  className="w-full"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    resetToForm(
                      mode === 'login' ? 'signup' : 'login',
                    )
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
