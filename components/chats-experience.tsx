'use client'
import Link from 'next/link'
import {useMemo,useState} from 'react'
import {Search,LockKeyhole,CheckCheck,Bell} from 'lucide-react'
import {BrandLogo} from '@/components/brand-logo'
import {MeetNewHero} from '@/components/meet-new-hero'

const fallback=['/demo/face-1.jpg','/demo/face-2.jpg','/demo/face-3.jpg','/demo/face-4.jpg']

function fmtTime(v:string|undefined){
  if(!v)return ''
  const d=new Date(v)
  const now=new Date()
  const diff=now.getTime()-d.getTime()
  if(diff<86400000)return d.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})
  if(diff<172800000)return 'أمس'
  return d.toLocaleDateString('ar-EG',{weekday:'long'})
}

export function ChatsExperience({rows,people}:{rows:any[];people:any[]}){
  const [q,setQ]=useState('')
  const filtered=useMemo(()=>{
    const s=q.trim().toLowerCase()
    if(!s)return rows
    return rows.filter(x=>{
      const name=x.other?.profiles?.display_name||''
      const body=x.last?.body||''
      return `${name} ${body}`.toLowerCase().includes(s)
    })
  },[rows,q])

  return <main className="px-4 pb-5 pt-3">
    <header className="safe-top flex items-center justify-between">
      <div className="flex items-center gap-2.5"><BrandLogo size={50}/><div><h1 className="text-[31px] font-black leading-none">كلامنا</h1><p className="mt-1 text-[12px] font-bold text-[#6d7890]">محادثات أجمل مع أصدقاء جدد</p></div></div>
      <Link href="/notifications" className="tap-action relative grid h-11 w-11 place-items-center rounded-full bg-white text-[#0e67f5] shadow-sm ring-1 ring-[#dfe9f5]"><Bell size={21}/><span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#ff1678] ring-2 ring-white"/></Link>
    </header>

    <label className="mt-4 flex h-14 items-center gap-3 rounded-[24px] bg-white px-4 shadow-sm ring-1 ring-[#e1ecf8]"><Search size={23} className="text-[#34496a]"/><input value={q} onChange={e=>setQ(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[14px] font-bold outline-none placeholder:text-[#8a94a8]" placeholder="ابحث في المحادثات..."/></label>

    <MeetNewHero people={people}/>

    <div className="mt-4 space-y-2">
      {filtered.map((x:any,i:number)=>{
        const prof=x.other?.profiles
        const type=x.last?.message_type
        return <Link href={`/chats/${x.id}`} key={x.id} className="tap-action pixel-card flex min-h-[92px] items-center gap-3 rounded-[24px] p-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#e9f2fb] ring-2 ring-[#37d6e6]"><img src={prof?.avatar_url||fallback[i%4]} alt="" className="h-full w-full object-cover"/><span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ${prof?.is_online===false?'bg-slate-400':'bg-[#0fd18a]'} ring-2 ring-white`}/></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2"><p className="truncate text-[17px] font-black">{prof?.display_name||'مستخدم'}</p><span className="text-[11px] font-bold text-[#78849a]">{fmtTime(x.last?.created_at)}</span></div>
            {type==='voice'?<div className="mt-2 flex items-center gap-2 rounded-full bg-[#f2e9ff] px-3 py-2 text-[#8a1ddd]"><span>▶</span><span className="tracking-[-2px]">▂▅▃▆▂▇▃▅▂▆</span><span className="mr-auto text-xs">رسالة صوتية</span></div>:
            type==='image'?<div className="mt-2 flex items-center gap-2"><div className="relative h-12 w-24 overflow-hidden rounded-xl bg-[linear-gradient(135deg,#d9c5b7,#9d8d82)] blur-[1px]"><span className="absolute inset-0 grid place-items-center text-white"><LockKeyhole size={17}/></span></div><span className="text-xs font-bold text-[#67738b]">صورة<br/>افتح المحادثة للعرض</span></div>:
            <p className="mt-2 truncate text-[14px] font-bold text-[#66738c]">{x.last?.body||'ابدأ الكلام الآن'}</p>}
          </div>
          <div className="flex flex-col items-center gap-2">{x.unread?<span className="grid h-8 min-w-8 place-items-center rounded-full bg-[#ff1678] px-2 text-xs font-black text-white">{x.unread}</span>:<CheckCheck size={21} className="text-[#0e67f5]"/>}</div>
        </Link>
      })}
      {!filtered.length?<div className="py-14 text-center text-sm font-bold text-[#758199]">{q?'لا توجد محادثات مطابقة للبحث.':'لسه مفيش محادثات — ابدأ من «اكتشف».'}</div>:null}
    </div>
  </main>
}
