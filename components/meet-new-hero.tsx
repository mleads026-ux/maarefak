import Link from 'next/link'
import {ChevronLeft,Plus} from 'lucide-react'

const fallback=['/demo/face-1.jpg','/demo/face-2.jpg','/demo/face-3.jpg']

export function MeetNewHero({people}:{people:any[]}){
  return <section className="lammetna-gradient hero-shadow relative mt-4 min-h-[170px] overflow-hidden rounded-[30px] p-5 text-white">
    <div className="pointer-events-none absolute -left-12 -top-20 h-64 w-64 rounded-full border-[28px] border-white/10"/>
    <div className="grid grid-cols-[1fr_1fr] items-center gap-3">
      <div>
        <p className="text-[25px] font-black leading-8">ابدأ تعارفًا<br/>جديدًا الآن</p>
        <p className="mt-2 text-[11px] font-bold leading-5 text-white/85">اكتشف أشخاصًا جدد وابدأ محادثة مناسبة لك</p>
        <Link href="/discover" className="tap-action mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-[#6223d9]">اكتشف الآن <ChevronLeft size={17}/></Link>
      </div>
      <div className="relative h-[130px]">
        {Array.from({length:3},(_,i)=>{
          const p=people[i]
          const pos=['right-0 top-0','left-1 top-4','right-[42px] bottom-0'][i]
          const img=p?.avatar_url||fallback[i]
          return <Link key={p?.id||i} href={p?.id?`/people/${p.id}`:'/discover'} className={`tap-action absolute ${pos} h-[70px] w-[70px] overflow-hidden rounded-full border-[4px] border-white shadow-xl`}>
            <img src={img} alt="" className="h-full w-full object-cover"/>
          </Link>
        })}
        <Link href="/discover" className="tap-action absolute bottom-0 left-0 grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-[#168cf5]"><Plus size={23}/></Link>
      </div>
    </div>
  </section>
}
