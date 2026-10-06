import Link from 'next/link'
import {ChevronRight} from 'lucide-react'
import {AppShell} from '@/components/app-shell'
import {BrandLogo} from '@/components/brand-logo'
import {RandomChatFlow} from '@/components/random-chat-flow'

export default function RandomChatPage(){
  return <AppShell>
    <main className="px-4 pb-5 pt-3">
      <header className="safe-top flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={50}/>
          <div><h1 className="text-[27px] font-black leading-none">دردشة عشوائية</h1><p className="mt-1 text-[11px] font-bold text-[#68758e]">نبحث لك عن شخص مناسب للتعارف</p></div>
        </div>
        <Link href="/home" aria-label="العودة للرئيسية" className="tap-action grid h-11 w-11 place-items-center rounded-full bg-white text-[#1768f4] shadow-sm ring-1 ring-[#dfe9f5]"><ChevronRight size={22}/></Link>
      </header>
      <RandomChatFlow/>
    </main>
  </AppShell>
}
