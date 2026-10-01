import Link from 'next/link'
import { Bell, Star } from 'lucide-react'
import { CrowdMark } from '@/components/crowd-mark'

export function PageHeader({
  title = 'معارفك',
  stars,
}: {
  title?: string
  stars?: number
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur">
      <div>
        <div className="flex items-center gap-1.5 text-[#1560BD]">
          <CrowdMark size={17} />
          <p className="text-[12px] font-extrabold">معارفك</p>
        </div>

        <h1 className="text-lg font-extrabold">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {typeof stars === 'number' ? (
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
            <Star size={14} fill="currentColor" />
            {stars.toLocaleString('ar-EG')}
          </span>
        ) : null}

        <Link
          aria-label="الإشعارات"
          href="/notifications"
          className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-700"
        >
          <Bell size={19} />
        </Link>
      </div>
    </header>
  )
}
