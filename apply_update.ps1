$ErrorActionPreference = "Stop"

$Root = Get-Location
if (-not (Test-Path (Join-Path $Root "package.json"))) {
    Write-Host "ERROR: Run this script from the maarefak project root." -ForegroundColor Red
    exit 1
}

$Backup = Join-Path $Root ".lammetna_visual_backup_2026-10-03"

function Backup-File([string]$Rel) {
    $src = Join-Path $Root $Rel
    if (Test-Path $src) {
        $dst = Join-Path $Backup $Rel
        $dir = Split-Path $dst -Parent
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        if (-not (Test-Path $dst)) {
            Copy-Item $src $dst
        }
    }
}

function Write-Utf8([string]$Rel, [string]$Content) {
    $dst = Join-Path $Root $Rel
    Backup-File $Rel
    $dir = Split-Path $dst -Parent
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    [System.IO.File]::WriteAllText($dst, $Content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "UPDATED  $Rel" -ForegroundColor Green
}

function Patch-Text([string]$Rel, [string]$Old, [string]$New) {
    $path = Join-Path $Root $Rel
    if (-not (Test-Path $path)) {
        Write-Host "SKIP missing $Rel" -ForegroundColor Yellow
        return
    }
    $txt = [System.IO.File]::ReadAllText($path)
    if (-not $txt.Contains($Old)) {
        Write-Host "WARN pattern not found: $Rel" -ForegroundColor Yellow
        return
    }
    Backup-File $Rel
    $txt = $txt.Replace($Old,$New)
    [System.IO.File]::WriteAllText($path, $txt, [System.Text.UTF8Encoding]::new($false))
    Write-Host "PATCHED  $Rel" -ForegroundColor Cyan
}

$globals = @'
@tailwind base;
@tailwind components;
@tailwind utilities;

:root{
  color-scheme:light;
  --brand:#1560BD;
  --brand-dark:#0D3D78;
  --brand-blue:#104F9B;
  --brand-soft:#EAF2FC;
  --brand-light:#D7E7FB;
  --surface:#F8FAFD;
  --surface-2:#F2F7FD;
  --ink:#172033;
  --muted:#65758B;
  --line:#DCE8F7;
  --gold:#B88724;
  --gold-bg:#FFF9E8;
  --purple:#7657FF;
  --cyan:#1FC9DA;
  --gradient:linear-gradient(135deg,#20CADB 0%,#178FE9 34%,#1560BD 66%,#7457F7 100%);
}
*{box-sizing:border-box}
html{direction:rtl;background:var(--surface);overflow-x:hidden}
body{
  margin:0;min-width:0;max-width:100%;overflow-x:hidden;
  background:
    radial-gradient(circle at 86% 2%,rgba(31,201,218,.12),transparent 24rem),
    radial-gradient(circle at 8% 10%,rgba(118,87,255,.10),transparent 22rem),
    linear-gradient(180deg,#F6FAFF 0%,#F8FAFD 42%,#F6F9FD 100%);
  color:var(--ink);
  font-family:Tajawal,Alexandria,"Segoe UI",Tahoma,Arial,sans-serif;
}
button,input,textarea,select{font:inherit}
::selection{background:#D7E7FB;color:#0D3D78}
a,button{-webkit-tap-highlight-color:transparent}
.hide-scrollbar::-webkit-scrollbar{display:none}
.hide-scrollbar{scrollbar-width:none}
input,textarea,select{min-width:0;max-width:100%}
input[type="date"]{display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box;-webkit-appearance:none;appearance:none}
input[type="date"]::-webkit-date-and-time-value{text-align:right}
@layer utilities{
  .lammetna-gradient{background:var(--gradient)}
  .lammetna-glass{background:rgba(255,255,255,.86);backdrop-filter:blur(18px)}
  .lammetna-card{border:1px solid rgba(220,232,247,.9);background:rgba(255,255,255,.92);box-shadow:0 14px 42px rgba(21,96,189,.08);border-radius:28px}
  .lammetna-glow{box-shadow:0 16px 44px rgba(21,96,189,.17)}
  .lammetna-gold-ring{box-shadow:0 0 0 3px #EAD9A8,0 10px 26px rgba(184,135,36,.18)}
}
'@
Write-Utf8 "app/globals.css" $globals

$tailwind = @'
import type { Config } from 'tailwindcss'
export default {
  content:['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}'],
  theme:{extend:{
    colors:{denim:'#1560BD',lammetna:{DEFAULT:'#1560BD',dark:'#0D3D78',blue:'#104F9B',soft:'#EAF2FC',mint:'#D7E7FB',surface:'#F8FAFD',gold:'#B88724',purple:'#7657FF',cyan:'#1FC9DA'}},
    borderRadius:{xl2:'1.25rem',lammetna:'1.75rem'},
    boxShadow:{soft:'0 12px 34px rgba(21,96,189,.09)',glow:'0 18px 48px rgba(21,96,189,.16)'}
  }},
  plugins:[]
} satisfies Config
'@
Write-Utf8 "tailwind.config.ts" $tailwind

$card = @'
import { cn } from '@/lib/utils'
export function Card({className,...props}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('rounded-[28px] border border-[#DCE8F7] bg-white/95 shadow-[0_14px_40px_rgba(21,96,189,.075)] backdrop-blur-sm',className)} {...props}/>}
export function CardContent({className,...props}:React.HTMLAttributes<HTMLDivElement>){return <div className={cn('p-4',className)} {...props}/>}
'@
Write-Utf8 "components/ui/card.tsx" $card

$button = @'
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva,type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
const variants=cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-extrabold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1560BD]/30 disabled:pointer-events-none disabled:opacity-50 active:scale-[.985]',{variants:{variant:{default:'bg-gradient-to-l from-[#7657FF] via-[#1560BD] to-[#1FC9DA] text-white shadow-[0_10px_24px_rgba(21,96,189,.18)] hover:brightness-[1.03]',secondary:'bg-[#EAF2FC] text-[#1560BD] hover:bg-[#DCE9FA]',outline:'border border-[#B9D2F2] bg-white/90 text-[#104F9B] hover:bg-[#F4F8FD]',ghost:'text-[#104F9B] hover:bg-[#EAF2FC]',danger:'bg-red-600 text-white hover:bg-red-700'},size:{default:'h-11 px-4',sm:'h-9 px-3 text-xs',lg:'h-12 px-6',icon:'h-10 w-10'}},defaultVariants:{variant:'default',size:'default'}})
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,VariantProps<typeof variants>{asChild?:boolean}
export function Button({className,variant,size,asChild=false,...props}:ButtonProps){const Comp=asChild?Slot:'button';return <Comp className={cn(variants({variant,size}),className)} {...props}/>}
'@
Write-Utf8 "components/ui/button.tsx" $button

$input = @'
import * as React from 'react'
import { cn } from '@/lib/utils'
export const Input=React.forwardRef<HTMLInputElement,React.InputHTMLAttributes<HTMLInputElement>>(({className,...props},ref)=><input ref={ref} className={cn('h-12 w-full rounded-2xl border border-[#DCE8F7] bg-white/95 px-4 text-sm text-[#172033] outline-none shadow-[0_6px_18px_rgba(21,96,189,.035)] placeholder:text-slate-400 focus:border-[#77A9E8] focus:ring-4 focus:ring-[#1560BD]/8',className)} {...props}/>)
Input.displayName='Input'
'@
Write-Utf8 "components/ui/input.tsx" $input

$textarea = @'
import * as React from 'react'
import { cn } from '@/lib/utils'
export const Textarea=React.forwardRef<HTMLTextAreaElement,React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({className,...props},ref)=><textarea ref={ref} className={cn('min-h-28 w-full rounded-[22px] border border-[#DCE8F7] bg-white/95 px-4 py-3 text-sm text-[#172033] outline-none shadow-[0_6px_18px_rgba(21,96,189,.035)] placeholder:text-slate-400 focus:border-[#77A9E8] focus:ring-4 focus:ring-[#1560BD]/8',className)} {...props}/>)
Textarea.displayName='Textarea'
'@
Write-Utf8 "components/ui/textarea.tsx" $textarea

$shell = @'
import { BottomNav } from './bottom-nav'
export function AppShell({children}:{children:React.ReactNode}){return <div className="relative mx-auto min-h-[100dvh] w-full max-w-md overflow-x-hidden bg-[linear-gradient(180deg,#F8FBFF_0%,#F8FAFD_42%,#F5F9FE_100%)] pb-24 shadow-[0_0_60px_rgba(15,23,42,.07)]">{children}<BottomNav/></div>}
'@
Write-Utf8 "components/app-shell.tsx" $shell

$header = @'
import Link from 'next/link'
import { Bell,Star } from 'lucide-react'
import { CrowdMark } from '@/components/crowd-mark'
export function PageHeader({title='لمتنا',stars}:{title?:string;stars?:number}){return <header className="sticky top-0 z-30 border-b border-[#DCE8F7]/80 bg-white/88 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl"><div className="flex items-center justify-between"><div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-[15px] bg-gradient-to-br from-[#20CADB] via-[#1560BD] to-[#7657FF] text-white shadow-[0_8px_20px_rgba(21,96,189,.20)]"><CrowdMark size={25}/></div><div className="min-w-0"><p className="text-[11px] font-black tracking-wide text-[#1560BD]">لمتنا</p><h1 className="truncate text-[19px] font-black leading-6 text-[#172033]">{title}</h1></div></div><div className="flex items-center gap-2">{typeof stars==='number'?<span className="flex h-9 items-center gap-1 rounded-full border border-[#EAD9A8] bg-[#FFF9E8] px-3 text-xs font-black text-[#9A6A12] shadow-sm"><Star size={14} fill="currentColor"/>{stars.toLocaleString('ar-EG')}</span>:null}<Link aria-label="الإشعارات" href="/notifications" className="relative grid h-10 w-10 place-items-center rounded-2xl border border-[#DCE8F7] bg-white text-[#1560BD] shadow-sm"><Bell size={19}/><span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-[#7657FF] ring-2 ring-white"/></Link></div></div></header>}
'@
Write-Utf8 "components/page-header.tsx" $header

$nav = @'
'use client'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Home,Shuffle,MessagesSquare,UserRound} from 'lucide-react'
import {CrowdMark} from '@/components/crowd-mark'
import {cn} from '@/lib/utils'
const items=[['/home','الرئيسية',Home],['/discover','اكتشف',Shuffle],['/spaces','اللَمّة',CrowdMark],['/social-hub','سوالف',MessagesSquare],['/me','أنا',UserRound]] as const
export function BottomNav(){const path=usePathname();return <nav className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-md -translate-x-1/2 border-t border-[#DCE8F7]/90 bg-white/92 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_34px_rgba(21,96,189,.10)] backdrop-blur-xl">{items.map(([href,label,Icon])=>{const active=path.startsWith(href);return <Link key={href} href={href} className={cn('relative flex flex-1 flex-col items-center gap-1 rounded-[18px] py-2 text-[11px] font-extrabold transition-all',active?'bg-gradient-to-b from-[#EAF7FD] to-[#EEF1FF] text-[#1560BD] shadow-[inset_0_0_0_1px_rgba(21,96,189,.06)]':'text-[#66758B] hover:text-[#1560BD]')}>{active?<span className="absolute top-0 h-[3px] w-7 rounded-full bg-gradient-to-l from-[#7657FF] via-[#1560BD] to-[#20CADB]"/>:null}<Icon size={20}/><span>{label}</span></Link>})}</nav>}
'@
Write-Utf8 "components/bottom-nav.tsx" $nav

Patch-Text "app/social-hub/page.tsx" '<PageHeader title="مساحتي"/>' '<PageHeader title="سوالف"/>'
Patch-Text "app/social-hub/page.tsx" '<main className="space-y-4 p-4">' '<main className="space-y-4 p-4"><section className="overflow-hidden rounded-[30px] bg-gradient-to-l from-[#20CADB] via-[#1560BD] to-[#7657FF] p-5 text-white shadow-[0_16px_38px_rgba(21,96,189,.18)]"><p className="text-2xl font-black">سوالف</p><p className="mt-1 text-sm text-white/85">شارك لحظاتك وسوالفك مع الأصدقاء</p></section>'

Patch-Text "app/chats/page.tsx" '<main className="space-y-3 p-4">' '<main className="space-y-3 p-4"><section className="mb-4 overflow-hidden rounded-[30px] bg-gradient-to-l from-[#7657FF] via-[#3E67D8] to-[#168CD8] p-5 text-white shadow-[0_16px_38px_rgba(72,91,203,.16)]"><h2 className="text-2xl font-black">كلامنا</h2><p className="mt-1 text-sm text-white/80">محادثات أجمل مع أصدقاء جدد</p></section>'

Patch-Text "app/discover/page.tsx" '<h1 className="text-2xl font-extrabold">Random Chat</h1>' '<h1 className="text-2xl font-black">دردشة عشوائية</h1>'
Patch-Text "app/discover/page.tsx" 'المطابقة لا تفتح الحوار تلقائيًا. لازم الطرفين يوافقوا أولًا.' 'المحادثة تبدأ بعد موافقة الطرفين. اكتشف شخصًا جديدًا وابدأ الكلام لما تكونوا أنتم الاثنين جاهزين.'
Patch-Text "app/discover/page.tsx" "{busy ? 'جاري البحث...' : 'ابدأ دردشة عشوائية'}" "{busy ? 'جاري البحث...' : 'ابدأ محادثة عشوائية الآن'}"

Patch-Text "app/spaces/page.tsx" 'غرف صوتية جماعية عامة أو خاصة' 'غرف صوتية مباشرة تجمعنا دائماً'
Patch-Text "app/spaces/[id]/page.tsx" 'Pair Spotlight ✨ نشط الآن' '⚔️ تحدي الآن'
Patch-Text "app/spaces/[id]/page.tsx" 'إنهاء Spotlight' 'إنهاء التحدي'

Patch-Text "app/login/page.tsx" 'rounded-[28px] bg-[#1560BD] text-white shadow-sm' 'rounded-[28px] bg-gradient-to-br from-[#20CADB] via-[#1560BD] to-[#7657FF] text-white shadow-[0_16px_36px_rgba(21,96,189,.20)]'
Patch-Text "app/login/page.tsx" 'لمّتنا تبدأ بخطوة' 'مكانك للتعارف واللمة الصوتية'

Write-Host ""
Write-Host "DONE — Lammetna visual update applied." -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor DarkGray
Write-Host "Next: open GitHub Desktop -> Changes, then run npm run build." -ForegroundColor Cyan
