import Link from 'next/link'
import {Bell,Star} from 'lucide-react'
import {BrandLogo} from './brand-logo'
export function PageHeader({title='لمتنا',stars}:{title?:string;stars?:number}){
 return <header className="safe-top sticky top-0 z-40 border-b border-[#E4EEF9]/70 bg-white/88 px-4 pb-3 backdrop-blur-xl">
   <div className="flex items-center justify-between">
    <div className="flex items-center gap-2.5"><BrandLogo size={42}/><div><h1 className="text-[22px] font-black leading-none">{title}</h1><p className="mt-1 text-[11px] font-bold text-[#707D97]">دائمًا مساحة أجمل مع أصدقاء جدد</p></div></div>
    <div className="flex items-center gap-2">{typeof stars==='number'?<span className="flex h-10 items-center gap-1.5 rounded-full border border-[#E4EBF7] bg-white px-3 text-sm font-black shadow-sm"><Star size={18} fill="#FFC21A" className="text-[#FFC21A]"/>{stars.toLocaleString('en-US')}</span>:null}<Link href="/notifications" className="relative grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-[#E1EAF6]"><Bell className="text-[#086AF4]" size={20}/><span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#FF1678] ring-2 ring-white"/></Link></div>
   </div>
 </header>
}
