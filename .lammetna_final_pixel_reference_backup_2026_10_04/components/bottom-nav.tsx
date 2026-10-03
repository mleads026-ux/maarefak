'use client'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Home,Compass,Mic2,MessageSquareMore,UserRound} from 'lucide-react'
const items=[['/home','الرئيسية',Home],['/discover','اكتشف',Compass],['/spaces','اللَمّة',Mic2],['/social-hub','سوالف',MessageSquareMore],['/me','أنا',UserRound]] as const
export function BottomNav(){
 const p=usePathname()
 return <nav className="fixed bottom-0 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 items-center gap-1 rounded-t-[30px] border border-[#E0EBF8] bg-white/94 px-3 pt-2 shadow-[0_-12px_40px_rgba(40,89,160,.12)] backdrop-blur-xl safe-bottom">
   {items.map(([href,label,Icon])=>{const active=p.startsWith(href);return <Link key={href} href={href} className={`relative flex flex-1 flex-col items-center gap-1 rounded-[20px] py-2 text-[11px] font-black ${active?'bg-gradient-to-b from-[#E8F5FF] to-[#F2EFFF] text-[#115DF4]':'text-[#2B3B5A]'}`}>
     <Icon size={active?23:21} strokeWidth={active?2.7:2.1}/><span>{label}</span>
   </Link>})}
 </nav>
}
