import Link from 'next/link'
import {ChevronLeft,Plus} from 'lucide-react'

const fallback=['/demo/face-1.jpg','/demo/face-2.jpg','/demo/face-3.jpg']

export function HomeDiscoverHero({faces}:{faces:any[]}){
  const people=Array.from({length:3},(_,i)=>faces[i]||null)
  return <section className="lammetna-gradient hero-shadow glow-card-surface living-card living-card--violet relative mt-4 min-h-[205px] overflow-hidden rounded-[30px] px-5 py-5 text-white">
    <div className="pointer-events-none absolute -left-10 -top-20 h-72 w-72 rounded-full border-[32px] border-white/10"/>
    <div className="pointer-events-none absolute left-14 top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"/>
    <div className="grid min-h-[165px] grid-cols-[1.08fr_.92fr] items-center gap-2">
      <div className="relative z-10">
        <h2 className="text-[26px] font-black leading-[1.3]">اكتشف عالمًا<br/>من الأصدقاء الجدد</h2>
        <p className="mt-2 text-[12px] font-bold leading-6 text-white/90">تواصل، دردش، وانضم إلى اللَمّات الصوتية<br/>مع أشخاص حقيقيين مثلك</p>
        <Link href="/discover" className="tap-action mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[12px] font-black text-[#6820da] shadow-lg">
          ابدأ الاستكشاف الآن <ChevronLeft size={18}/>
        </Link>
      </div>
      <div className="relative h-[165px]">
        {people.map((p,i)=>{
          const pos=[
            'left-[2px] top-[4px] h-[84px] w-[84px]',
            'right-[2px] top-[20px] h-[86px] w-[86px]',
            'left-[54px] bottom-[2px] h-[72px] w-[72px]',
          ][i]
          const img=p?.avatar_url||fallback[i]
          const content=<img src={img} alt="" className="h-full w-full rounded-full object-cover"/>
          return p?.id
            ? <Link key={i} href={`/people/${p.id}`} aria-label={`فتح ملف ${p.display_name||'المستخدم'}`} className={`tap-action absolute ${pos} z-20 rounded-full border-[4px] border-white shadow-xl ring-2 ring-cyan-300`}>{content}</Link>
            : <span key={i} className={`absolute ${pos} z-20 rounded-full border-[4px] border-white shadow-xl ring-2 ring-cyan-300`}>{content}</span>
        })}
        <Link href="/discover" aria-label="اكتشف أشخاصًا جدد" className="tap-action absolute bottom-[4px] right-[6px] z-30 grid h-[58px] w-[58px] place-items-center rounded-full border-2 border-white bg-[#168df6] text-white shadow-xl">
          <Plus size={31}/>
        </Link>
      </div>
    </div>
  </section>
}
