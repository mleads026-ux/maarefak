import Link from 'next/link'
import {Bell,Star} from 'lucide-react'
import {BrandLogo} from './brand-logo'

export function PageHeader({title='لمتنا',subtitle='دائمًا مساحة أجمل مع أصدقاء جدد',stars,showBell=true}:{title?:string;subtitle?:string;stars?:number;showBell?:boolean}){
  return <header className="safe-top px-4 pb-2 pt-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <BrandLogo size={48}/>
        <div><h1 className="text-[28px] font-black leading-none">{title}</h1><p className="mt-1 text-[11px] font-bold text-[#697690]">{subtitle}</p></div>
      </div>
      <div className="flex items-center gap-2">
        {typeof stars==='number'?<span className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-black shadow-sm ring-1 ring-[#dfe9f5]"><Star size={19} fill="#ffc21d" className="text-[#ffc21d]"/>{stars.toLocaleString('en-US')}</span>:null}
        {showBell?<Link href="/notifications" className="relative grid h-11 w-11 place-items-center rounded-full bg-white text-[#0e67f5] shadow-sm ring-1 ring-[#dfe9f5]"><Bell size={21}/><span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#ff1678] ring-2 ring-white"/></Link>:null}
      </div>
    </div>
  </header>
}
