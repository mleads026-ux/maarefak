import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Ban,
  ChevronLeft,
  Coins,
  Settings,
  UserRoundCheck,
  Users,
  WalletCards,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'

type StarPack = {
  pack_id: string
  stars: number
  google_product_id: string | null
  apple_product_id: string | null
  country_code: string
  currency_code: string
  display_price: number | string
  unit_price: number | string
  savings_percent: number | string
  pricing_version: string
}

export default async function Me() {
  const s = await createClient()
  const {
    data: { user },
  } = await s.auth.getUser()

  if (!user) redirect('/login')

  const [
    { data: p },
    { data: w },
    { data: tags },
    { data: views },
    { count: reqCount },
    { data: starPacks },
  ] = await Promise.all([
    s
      .from('profiles')
      .select(
        'id,display_name,avatar_url,bio,mood,birth_date,show_age,countries(name_ar),cities(name_ar)',
      )
      .eq('id', user.id)
      .single(),
    s.from('star_wallets').select('balance').eq('user_id', user.id).single(),
    s.from('profile_interests').select('interests(name_ar)').eq('profile_id', user.id),
    s
      .from('profile_views')
      .select(
        'id,created_at,viewer_id,profiles!profile_views_viewer_id_fkey(display_name,avatar_url)',
      )
      .eq('viewed_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    s
      .from('connection_requests')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('status', 'pending'),
    s.rpc('get_my_star_packs'),
  ])

  const packs = (starPacks || []) as StarPack[]
  const age =
    p?.show_age && p.birth_date
      ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / 31557600000)
      : null

  const menu = [
    ['طلبات التواصل', `${reqCount || 0}`, UserRoundCheck, '/notifications'],
    ['معارفي', 'الأشخاص المتصلون بك', Users, '/connections'],
    ['مرّوا من هنا', `${views?.length || 0}`, Users, '#visitors'],
    [
      'رصيد النجوم',
      `${Number(w?.balance || 0).toLocaleString('ar-EG')} ⭐`,
      Coins,
      '#stars',
    ],
    ['الحظر', 'إدارة', Ban, '/settings'],
    ['التحكم', 'الإعدادات', Settings, '/settings'],
  ] as const

  return (
    <AppShell>
      <PageHeader title="أنا" stars={Number(w?.balance || 0)} />
      <main className="space-y-4 p-4">
        <Card>
          <CardContent className="text-center">
            <div className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-[#E7F5F1] text-3xl font-black text-[#006B57]">
              {p?.avatar_url ? (
                <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (p?.display_name || 'م')[0]
              )}
            </div>
            <h1 className="mt-3 text-xl font-extrabold">
              {p?.display_name}
              {age ? `، ${age}` : ''}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {[(p?.cities as any)?.name_ar, (p?.countries as any)?.name_ar]
                .filter(Boolean)
                .join('، ')}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {p?.bio || 'أضف نبذة قصيرة عنك من الإعدادات.'}
            </p>
            <p className="mt-3 inline-flex rounded-full bg-[#EAF2FC] px-3 py-2 text-xs font-bold text-[#006B57]">
              {p?.mood || '☕ رايق'}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {(tags || []).map((x: any) => (
                <span
                  key={(x.interests as any)?.name_ar}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold"
                >
                  {(x.interests as any)?.name_ar}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {menu.map(([label, value, Icon, href]) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4"
            >
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#EAF2FC] text-[#006B57]">
                <Icon size={19} />
              </div>
              <div className="flex-1">
                <p className="font-bold">{label}</p>
                <p className="text-xs text-slate-500">{value}</p>
              </div>
              <ChevronLeft size={18} className="text-slate-400" />
            </Link>
          ))}
        </div>

        <section id="visitors">
          <h2 className="mb-2 font-extrabold">مرّوا من هنا</h2>
          <div className="space-y-2">
            {(views || []).map((x: any) => (
              <div
                key={x.id}
                className="rounded-3xl border border-slate-200 bg-white p-3 text-sm"
              >
                <span className="font-bold">{x.profiles?.display_name || 'مستخدم'}</span>
                <span className="mr-2 text-slate-400">زار ملفك</span>
              </div>
            ))}
            {!views?.length && (
              <p className="text-sm text-slate-500">لا توجد زيارات مسجلة حتى الآن.</p>
            )}
          </div>
        </section>

        <section id="stars">
          <Card>
            <CardContent>
              <div className="flex items-center gap-3">
                <WalletCards className="text-amber-600" />
                <div>
                  <p className="font-extrabold">باقات النجوم</p>
                  <p className="text-xs text-slate-500">
                    السعر النهائي عند الشراء هو السعر الذي يعرضه متجر Apple أو Google
                    لحسابك وبلد المتجر.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {packs.map((pack) => {
                  const price = Number(pack.display_price)
                  const unit = Number(pack.unit_price)
                  const savings = Number(pack.savings_percent)

                  return (
                    <div
                      key={pack.pack_id}
                      className="rounded-2xl border border-slate-200 p-3 text-center"
                    >
                      <p className="font-black text-amber-700">
                        ⭐ {Number(pack.stars).toLocaleString('ar-EG')}
                      </p>
                      <p className="mt-1 font-extrabold">
                        {price.toLocaleString('ar-EG', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        {pack.currency_code}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {unit.toLocaleString('ar-EG', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        {pack.currency_code} / نجمة
                      </p>
                      {savings > 0 ? (
                        <p className="mt-2 text-xs font-bold text-emerald-700">
                          وفر {savings.toLocaleString('ar-EG', { maximumFractionDigits: 1 })}%
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {!packs.length ? (
                <p className="mt-4 text-center text-sm text-slate-500">
                  باقات النجوم غير متاحة حاليًا.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </main>
    </AppShell>
  )
}
