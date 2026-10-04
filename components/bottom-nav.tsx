'use client'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Home,Compass,Mic2,MessageSquareMore,UserRound} from 'lucide-react'
import {BrandLogo} from './brand-logo'

type Item={href:string;label:string;icon:any;brand?:boolean}

const items:Item[]=[
  {href:'/home',label:'الرئيسية',icon:Home},
  {href:'/discover',label:'اكتشف',icon:Compass},
  {href:'/spaces',label:'اللَمّة',icon:Mic2},
  {href:'/social-hub',label:'سوالف',icon:MessageSquareMore,brand:true},
  {href:'/me',label:'أنا',icon:UserRound},
]

export function BottomNav(){
  const p=usePathname()
  return <nav className="safe-bottom fixed bottom-0 left-1/2 z-50 flex w-full max-w-[432px] -translate-x-1/2 items-center rounded-t-[30px] border border-[#dce8f5] bg-white/95 px-2 pt-2 shadow-[0_-12px_34px_rgba(43,83,145,.11)] backdrop-blur-xl">
    {items.map(({href,label,icon:Icon,brand})=>{
      const active=p.startsWith(href)
      return <Link key={href} href={href} className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-[20px] py-2 text-[11px] font-black transition ${active?'bg-[linear-gradient(180deg,#eff9ff,#f2edff)] text-[#0f5ef4]':'text-[#283a5b]'}`}>
        {brand&&active?<BrandLogo size={35}/>:<Icon size={active?23:21} strokeWidth={active?2.7:2.2}/>}<span>{label}</span>
      </Link>
    })}
  </nav>
}
