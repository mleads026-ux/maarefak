'use client'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Home,Shuffle,MessagesSquare,UserRound} from 'lucide-react'
import {CrowdMark} from '@/components/crowd-mark'
import {cn} from '@/lib/utils'
const items=[['/home','الرئيسية',Home],['/discover','اكتشف',Shuffle],['/spaces','اللَمّة',CrowdMark],['/social-hub','سوالف',MessagesSquare],['/me','أنا',UserRound]] as const
export function BottomNav(){const path=usePathname();return <nav className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-md -translate-x-1/2 border-t border-[#DCE8F7]/90 bg-white/92 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_34px_rgba(21,96,189,.10)] backdrop-blur-xl">{items.map(([href,label,Icon])=>{const active=path.startsWith(href);return <Link key={href} href={href} className={cn('relative flex flex-1 flex-col items-center gap-1 rounded-[18px] py-2 text-[11px] font-extrabold transition-all',active?'bg-gradient-to-b from-[#EAF7FD] to-[#EEF1FF] text-[#1560BD] shadow-[inset_0_0_0_1px_rgba(21,96,189,.06)]':'text-[#66758B] hover:text-[#1560BD]')}>{active?<span className="absolute top-0 h-[3px] w-7 rounded-full bg-gradient-to-l from-[#7657FF] via-[#1560BD] to-[#20CADB]"/>:null}<Icon size={20}/><span>{label}</span></Link>})}</nav>}