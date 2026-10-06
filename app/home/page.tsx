import Link from 'next/link'
import {redirect} from 'next/navigation'
import {Bell,Star,Users,Shuffle,Mic2,MessagesSquare,ChevronLeft,MapPin} from 'lucide-react'
import {createClient} from '@/lib/supabase/server'
import {AppShell} from '@/components/app-shell'
import {BrandLogo} from '@/components/brand-logo'
import {AddInterestButton} from '@/components/add-interest-button'
import {HomeDiscoverHero} from '@/components/home-discover-hero'


const fallback=['/demo/face-1.jpg','/demo/face-2.jpg','/demo/face-3.jpg','/demo/face-4.jpg']

export default async function Home(){
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)redirect('/login')

  const [{data:p},{data:w},{data:people},{count:requests},{data:own}]=await Promise.all([
    s.from('profiles').select('id,display_name,profile_complete').eq('id',user.id).single(),
    s.from('star_wallets').select('balance').eq('user_id',user.id).single(),
    s.from('profiles').select('id,display_name,avatar_url,mood,show_age,is_online,cities(name_ar)').neq('id',user.id).eq('profile_complete',true).eq('discoverable',true).limit(8),
    s.from('connection_requests').select('*',{count:'exact',head:true}).eq('receiver_id',user.id).eq('status','pending'),
    s.from('conversation_members').select('conversation_id').eq('user_id',user.id),
  ])
  if(!p?.profile_complete)redirect('/onboarding')

  const convIds=(own||[]).map((x:any)=>x.conversation_id)
  let unread=0
  if(convIds.length){
    const {count}=await s.from('messages').select('*',{count:'exact',head:true}).in('conversation_id',convIds).neq('sender_id',user.id).is('read_at',null)
    unread=count||0
  }

  const faces=(people||[]) as any[]
  const ageEntries=await Promise.all(faces.map(async (x:any)=>{
    const {data}=await s.rpc('public_profile_age',{p_target:x.id})
    return [x.id,data==null?null:Number(data)] as const
  }))
  const ages=new Map(ageEntries)
  const stars=Number(w?.balance||0)

  return <AppShell>
    <main className="px-4 pb-5 pt-3">
      <header className="safe-top flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={52}/>
          <div><h1 className="text-[31px] font-black leading-none">لمتنا</h1><p className="mt-1 text-[11px] font-bold text-[#68758e]">دائمًا مساحة أجمل مع أصدقاء جدد</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/payments" className="tap-action flex h-11 items-center gap-2 rounded-full bg-white px-3 text-sm font-black shadow-sm ring-1 ring-[#dfe9f5]"><Star size={21} fill="#ffc21d" className="text-[#ffc21d]"/>{stars.toLocaleString('en-US')}<ChevronLeft size={15} className="text-[#0e67f5]"/></Link>
          <Link href="/notifications" className="tap-action relative grid h-11 w-11 place-items-center rounded-full bg-white text-[#0e67f5] shadow-sm ring-1 ring-[#dfe9f5]"><Bell size={21}/>{requests?<span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#ff1678] ring-2 ring-white"/>:null}</Link>
        </div>
      </header>

      <HomeDiscoverHero faces={faces}/>

      <section className="mt-3 grid grid-cols-5 gap-2">
        {[
          [Users,'اكتشف','أصدقاء جدد بانتظارك','/discover','#11c899'],
          [Shuffle,'دردشة عشوائية','تعرف على أشخاص جدد الآن','/random-chat','#0e67f5'],
          [Mic2,'اللَمّة','غرف صوتية حية بمواضيع متنوعة','/spaces','#b329e5'],
          [Star,'رصيد النجوم','الشحن ومميزات أكثر','/payments','#ffb918'],
          [MessagesSquare,'كلامنا','كل محادثاتك في مكان واحد','/chats','#1768f4'],
        ].map(([I,t,d,h,c]:any)=><Link href={h} key={t} className="tap-action pixel-card rounded-[22px] px-2 py-3 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-[17px] bg-[#edf5ff]" style={{color:c}}><I size={24} fill={t==='رصيد النجوم'?c:'none'}/></span>
          <p className="mt-2 text-[11px] font-black">{t}</p><p className="mt-1 text-[9px] font-bold leading-4 text-[#78849b]">{d}</p><ChevronLeft size={14} className="mx-auto mt-1 text-[#0e67f5]"/>
        </Link>)}
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <Link href="/payments" className="tap-action living-card living-card--gold relative overflow-hidden rounded-[27px] bg-[linear-gradient(135deg,#024c86,#0877be_42%,#5f22d5_100%)] p-4 text-white shadow-[0_14px_30px_rgba(36,55,170,.22)]">
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold">رصيد النجوم</p>
              <p className="mt-1 whitespace-nowrap text-[12.4px] font-black leading-none">{stars.toLocaleString('en-US')}</p>
              <p className="mt-1 text-[11px] font-bold">نجمة ⭐</p>
            </div>
            <div className="star-orbit grid h-[74px] w-[74px] shrink-0 place-items-center rounded-full bg-white/10">
              <Star size={43} fill="#ffc21d" className="star-pulse text-[#ffc21d]"/>
            </div>
          </div>
          <span className="relative z-10 mt-4 inline-flex rounded-full bg-white px-3 py-2 text-[11px] font-black text-[#5a24d6]">شراء نجوم +</span>
        </Link>

        <Link href="/chats" className="tap-action lammetna-gradient hero-shadow living-card living-card--violet relative overflow-hidden rounded-[27px] p-4 text-white">
          <div className="flex items-center gap-2"><MessagesSquare size={28}/><p className="text-[28px] font-black">كلامنا</p></div>
          <p className="mt-2 text-[13px] font-bold text-white/88">{unread?`لديك ${unread} رسائل جديدة`:'محادثاتك الخاصة في مكان واحد'}</p>
          <div className="mt-3 flex -space-x-2 space-x-reverse">{[0,1,2].map(i=><img key={i} src={faces[i]?.avatar_url||fallback[i]} alt="" className="h-9 w-9 rounded-full border-2 border-white object-cover"/>)}</div>
          <span className="absolute bottom-4 left-4 grid h-11 w-11 place-items-center rounded-full bg-white/18"><ChevronLeft/></span>
        </Link>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[25px] font-black">وجوه جديدة ✨</h2><Link href="/discover" className="tap-action flex items-center gap-1 text-sm font-black text-[#0e67f5]"><ChevronLeft size={16}/>عرض الكل</Link></div>
        <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2">
          {faces.slice(0,6).map((x,i)=>{
            const src=x.avatar_url||null
            const name=x.display_name||'مستخدم لمتنا'
            const age=ages.get(x.id)??null
            const city=(x.cities as any)?.name_ar||'غير محدد'
            return <article key={x.id} className="pixel-card glow-character-card min-w-[145px] overflow-hidden rounded-[22px]">
              <Link href={`/people/${x.id}`} className="tap-action block">
                <div className="relative h-[150px] bg-[#eaf3fb]">
                  {src?<img src={src} alt="" className="h-full w-full object-cover"/>:<span className="grid h-full w-full place-items-center bg-[linear-gradient(145deg,#e9f8ff,#f1eaff)] text-[#0e67f5]"><Users size={42}/></span>}
                  {x.is_online===true?<span className="absolute left-2 top-2 h-3 w-3 rounded-full bg-[#11cf90] shadow-[0_0_10px_rgba(17,207,144,.8)] ring-2 ring-white"/>:null}
                </div>
                <div className="px-3 pt-3"><div className="flex items-center justify-between gap-2"><p className="truncate font-black">{name}</p><span className="text-[11px] font-bold text-[#70809a]">{age||''}</span></div><p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#75839a]"><MapPin size={12}/>{city}</p></div>
              </Link>
              <div className="p-3 pt-2"><AddInterestButton userId={x.id}/></div>
            </article>
          })}
          {!faces.length?<div className="pixel-card min-w-full rounded-[22px] p-5 text-center text-sm font-bold text-[#76839a]">لا توجد وجوه جديدة متاحة الآن.</div>:null}
        </div>
      </section>
    </main>
  </AppShell>
}
