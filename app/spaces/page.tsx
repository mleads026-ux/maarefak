'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Mic2, Pin, Plus, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Space = {
  id: string
  owner_id: string
  name: string
  description: string | null
  emoji: string | null
  category: string | null
  is_public: boolean
  pinned_until: string | null
  created_at: string
  space_members: { count: number }[]
}

export default function Spaces() {
  const s = useMemo(() => createClient(), [])
  const r = useRouter()

  const [items, setItems] = useState<Space[]>([])
  const [uid, setUid] = useState('')
  const [show, setShow] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [emoji, setEmoji] = useState('🎙️')
  const [category, setCategory] = useState('عام')
  const [isPublic, setIsPublic] = useState(true)
  const [password, setPassword] = useState('')
  const [joinPasswords, setJoinPasswords] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')

  async function load() {
    const { data: { user } } = await s.auth.getUser()
    setUid(user?.id || '')

    const { data } = await s
      .from('spaces')
      .select('id,owner_id,name,description,emoji,category,is_public,pinned_until,created_at,space_members(count)')
      .limit(100)

    const now = Date.now()

    setItems(
      ((data || []) as any).sort((a: Space, b: Space) => {
        const ap = a.pinned_until && new Date(a.pinned_until).getTime() > now ? 1 : 0
        const bp = b.pinned_until && new Date(b.pinned_until).getTime() > now ? 1 : 0
        if (ap !== bp) return bp - ap
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    )
  }

  useEffect(() => {
    load()
  }, [])

  async function create() {
    if (!name.trim()) return

    setNotice('')

    if (!isPublic && password.trim().length < 4) {
      setNotice('كلمة مرور اللَمّة الخاصة لازم تكون 4 حروف/أرقام على الأقل.')
      return
    }

    const { data, error } = await s.rpc('create_lamma', {
      p_name: name.trim(),
      p_description: desc || null,
      p_emoji: emoji,
      p_category: category,
      p_is_public: isPublic,
      p_password: isPublic ? null : password.trim(),
    })

    if (error) {
      setNotice('تعذر إنشاء اللَمّة.')
      return
    }

    setShow(false)
    setName('')
    setDesc('')
    setEmoji('🎙️')
    setCategory('عام')
    setPassword('')
    setIsPublic(true)

    if (data) r.push(`/spaces/${data}`)
  }

  async function join(space: Space) {
    setNotice('')

    const { error } = await s.rpc('join_lamma', {
      p_space: space.id,
      p_password: space.is_public ? null : joinPasswords[space.id] || null,
    })

    if (error) {
      if (error.message.includes('wrong_password')) {
        setNotice('كلمة المرور غير صحيحة.')
      } else {
        setNotice('تعذر دخول اللَمّة.')
      }
      return
    }

    r.push(`/spaces/${space.id}`)
  }

  async function pin(id: string) {
    const { error } = await s.rpc('pin_space_for_24h', {
      p_space_id: id,
      p_cost: 100,
    })

    if (error) {
      setNotice(
        error.message.includes('insufficient_stars')
          ? 'رصيد النجوم غير كافٍ.'
          : 'تعذر تثبيت اللَمّة.'
      )
      return
    }

    load()
  }

  return (
    <AppShell>
      <PageHeader title="اللَمّة" />

      <main className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold">اللَمّة</h1>
            <p className="text-sm text-slate-500">
              غرف صوتية جماعية عامة أو خاصة
            </p>
          </div>

          <Button size="sm" onClick={() => setShow(!show)}>
            <Plus size={16} />
            إنشاء
          </Button>
        </div>

        {notice ? (
          <p className="rounded-2xl bg-[#EAF2FC] p-3 text-sm font-bold text-[#1560BD]">
            {notice}
          </p>
        ) : null}

        {show ? (
          <Card>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-[72px_1fr] gap-2">
                <Input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                />
                <Input
                  placeholder="اسم اللَمّة"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <Textarea
                placeholder="وصف مختصر"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />

              <Input
                placeholder="التصنيف"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={
                    isPublic
                      ? 'rounded-xl bg-white px-3 py-2 text-sm font-extrabold text-[#1560BD] shadow-sm'
                      : 'rounded-xl px-3 py-2 text-sm font-bold text-slate-500'
                  }
                >
                  🌍 عامة
                </button>

                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={
                    !isPublic
                      ? 'rounded-xl bg-white px-3 py-2 text-sm font-extrabold text-[#1560BD] shadow-sm'
                      : 'rounded-xl px-3 py-2 text-sm font-bold text-slate-500'
                  }
                >
                  🔒 خاصة
                </button>
              </div>

              {!isPublic ? (
                <Input
                  type="password"
                  placeholder="كلمة مرور اللَمّة الخاصة"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              ) : null}

              <Button className="w-full" onClick={create}>
                إنشاء اللَمّة
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-3">
          {items.map((x) => {
            const pinned =
              !!x.pinned_until && new Date(x.pinned_until).getTime() > Date.now()

            return (
              <Card key={x.id} className={pinned ? 'border-[#1560BD]/30' : ''}>
                <CardContent>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-extrabold">
                          {x.emoji || '🎙️'} {x.name}
                        </h2>

                        {!x.is_public ? (
                          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                            <Lock size={11} />
                            خاصة
                          </span>
                        ) : null}

                        {pinned ? (
                          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                            <Pin size={12} />
                            مثبّت 24 ساعة
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {x.description || 'لَمّة صوتية جديدة'}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users size={14} />
                          {x.space_members?.[0]?.count || 0} عضو
                        </span>

                        <span className="flex items-center gap-1">
                          <Mic2 size={14} />
                          صوت جماعي
                        </span>
                      </div>

                      {!x.is_public ? (
                        <Input
                          type="password"
                          className="mt-3"
                          placeholder="كلمة المرور"
                          value={joinPasswords[x.id] || ''}
                          onChange={(e) =>
                            setJoinPasswords((current) => ({
                              ...current,
                              [x.id]: e.target.value,
                            }))
                          }
                        />
                      ) : null}

                      {x.owner_id === uid ? (
                        <button
                          onClick={() => pin(x.id)}
                          className="mt-3 text-xs font-bold text-amber-700"
                        >
                          ⭐ تثبيت 24 ساعة مقابل 100 نجمة
                        </button>
                      ) : null}
                    </div>

                    <Button size="sm" onClick={() => join(x)}>
                      دخول
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {!items.length ? (
            <p className="py-10 text-center text-sm text-slate-500">
              لا توجد لَمّات حتى الآن. أنشئ أول لَمّة.
            </p>
          ) : null}
        </div>
      </main>
    </AppShell>
  )
}
