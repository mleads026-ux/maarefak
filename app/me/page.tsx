import Link from 'next/link'
import {redirect} from 'next/navigation'
import {Settings,MapPin,Plus,Star,Heart,Smile,WalletCards,UserRoundCheck,Users,Footprints,Ban,ChevronLeft,Music,Plane,Image as ImageIcon} from 'lucide-react'
import {createClient} from '@/lib/supabase/server'
import {AppShell} from '@/components/app-shell'
import {BrandLogo} from '@/components/brand-logo'
import {CopyTextButton} from '@/components/copy-text-button'
import {ProfileAvatarEditor} from '@/components/profile-avatar-editor'

export const dynamic='force-dynamic'
export const revalidate=0

export default async function Me(){
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)redirect('/login')

  // Load the authenticated user's own profile first, without relationship joins.
  // A relationship/select error must never be treated as "new user -> onboarding".
  const {data:p,error:profileError}=await s.from('profiles')
    .select('id,display_name,avatar_url,bio,mood,show_age,is_online,city_id,country_id,profile_complete')
    .eq('id',user.id)
    .maybeSingle()

  if(profileError){
    return <AppShell><main className="px-4 pb-5 pt-3">
      <header className="safe-top flex items-center justify-between">
        <div className="flex items-center gap-2.5"><BrandLogo size={50}/><div><h1 className="text-[31px] font-black leading-none">لمتنا</h1><p className="mt-1 text-[12px] font-bold text-[#6d7890]">صفحة حسابي</p></div></div>
      </header>
      <section className="pixel-card mt-4 rounded-[28px] p-6 text-center">
        <p className="text-lg font-black">تعذر تحميل حسابك الآن</p>
        <p className="mt-2 text-sm font-bold text-[#748198]">جرّب تحديث الصفحة مرة أخرى.</p>
        <Link href="/me" className="tap-action lammetna-gradient mt-4 inline-flex rounded-full px-5 py-3 text-sm font-black text-white">إعادة المحاولة</Link>
      </section>
    </main></AppShell>
  }

  if(!p || p.profile_complete!==true)redirect('/onboarding')

  const {data:publicIdRow}=await s.rpc('my_public_user_id')

  const cityPromise=p.city_id
    ? s.from('cities').select('name_ar').eq('id',p.city_id).maybeSingle()
    : Promise.resolve({data:null,error:null} as any)

  const [{data:w},{data:tags},{count:reqCount},{count:viewCount},{data:cityRow}]=await Promise.all([
    s.from('star_wallets').select('balance').eq('user_id',user.id).maybeSingle(),
    s.from('profile_interests').select('interests(name_ar)').eq('profile_id',user.id),
    s.from('connection_requests').select('*',{count:'exact',head:true}).eq('receiver_id',user.id).eq('status','pending'),
    s.from('profile_views').select('*',{count:'exact',head:true}).eq('viewed_id',user.id),
    cityPromise,
  ])

  const stars=Number(w?.balance||0)
  const city=cityRow?.name_ar||'غير محدد'
  const publicId=publicIdRow||`LM${String(user.id).replace(/-/g,'').slice(0,10).toUpperCase()}`
  const interests=(tags||[]).map((x:any)=>(x.interests as any)?.name_ar).filter(Boolean)
  const avatar=p.avatar_url||null

  const menu=[
    ['اهتماماتي',interests.slice(0,3).join('، ')||'لم تضف اهتمامات بعد',Heart,'/settings','#db22b0'],
    ['حالتي الآن',p.mood||'لم تحدد حالتك',Smile,'/social-hub','#1768f4'],
    ['طلبات التواصل',`${reqCount||0} طلبات`,UserRoundCheck,'/notifications','#0e67f5'],
    ['المدفوعات والنجوم','إدارة مشترياتك وعمليات الدفع',WalletCards,'/payments','#8f24e7'],
    ['مرّوا من هنا',`${viewCount||0} زاروا ملفك الشخصي`,Footprints,'/social-hub','#c42dbd'],
    ['معارفي','أصدقائي وقائمتي',Users,'/connections','#13b985'],
    ['التحكم','الخصوصية والإعدادات',Settings,'/settings','#0e67f5'],
    ['الحظر','إدارة قائمة المحظورين',Ban,'/settings','#ef233c'],
  ] as const

  return <AppShell><main className="px-4 pb-5 pt-3">
    <header className="safe-top flex items-center justify-between"><div className="flex items-center gap-2.5"><BrandLogo size={50}/><div><h1 className="text-[31px] font-black leading-none">لمتنا</h1><p className="mt-1 text-[12px] font-bold text-[#6d7890]">دائمًا مساحة أجمل مع أصدقاء جدد</p></div></div><Link href="/settings" className="tap-action grid h-11 w-11 place-items-center rounded-full bg-white text-[#0e67f5] shadow-sm ring-1 ring-[#dfe9f5]"><Settings size={23}/></Link></header>

    <section className="lammetna-gradient hero-shadow glow-card-surface living-card living-card--violet relative mt-4 overflow-hidden rounded-[31px] p-5 text-white">
      <div className="grid grid-cols-[1fr_155px] items-center gap-4"><div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/12 px-4 py-2 text-sm font-black">{p.is_online?<span className="h-2.5 w-2.5 rounded-full bg-[#17e3a2] shadow-[0_0_12px_rgba(23,227,162,.85)]"/>:null}{p.is_online?'متصل الآن':'غير متصل'}</span>
        <h2 className="mt-3 text-[34px] font-black">{p.display_name||'حسابي'}</h2>
        <p className="mt-1 flex items-center gap-1 text-[16px] font-bold"><MapPin size={18}/>{city}<ChevronLeft size={17}/></p>
        <p className="mt-4 text-[15px] font-bold leading-7 text-white/90">{p.bio||'أضف نبذة عنك من الإعدادات.'}</p>
      </div><ProfileAvatarEditor userId={user.id} avatar={avatar} isOnline={p.is_online===true}/></div>

      <div className="mt-5 flex flex-wrap gap-2">
        {interests.length?interests.slice(0,4).map((x:string,i:number)=><span key={x} className="rounded-full border border-white/35 bg-white/12 px-3 py-2 text-xs font-black">{i===0?<Plane className="ml-1 inline" size={14}/>:i===1?<Music className="ml-1 inline" size={14}/>:i===2?<ImageIcon className="ml-1 inline" size={14}/>:null}{x}</span>):<span className="rounded-full border border-white/35 bg-white/12 px-3 py-2 text-xs font-black text-white/90">لم تضف اهتمامات بعد</span>}
        <Link href="/settings" className="tap-action grid h-9 w-9 place-items-center rounded-full border border-white/35 bg-white/12"><Plus size={19}/></Link>
      </div>
    </section>

    <section className="pixel-card mt-3 flex items-center gap-3 rounded-[23px] p-4">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-[#eaf4ff] text-[#0e67f5]"><Users size={20}/></div>
      <div className="flex-1"><p className="text-[11px] font-bold text-[#77839a]">معرّفي العام في لمتنا</p><p dir="ltr" className="mt-1 text-[18px] font-black tracking-wide">{publicId}</p></div>
      <CopyTextButton text={publicId}/>
    </section>

    <section className="mt-3 overflow-hidden rounded-[27px] bg-[linear-gradient(135deg,#044d87,#0877bc_42%,#6622d8_100%)] p-4 text-white shadow-lg">
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-20 w-20 place-items-center rounded-full bg-white/10"><Star size={46} fill="#ffc21d" className="text-[#ffc21d]"/></span><div><p className="text-sm font-bold">رصيد النجوم</p><p className="mt-1 text-[29px] font-black">{stars.toLocaleString('en-US')}</p><p className="text-xs font-bold">نجمة ⭐</p></div></div><Link href="/payments" className="tap-action flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-[#5d24d8]">شراء نجوم <Plus size={18}/></Link></div>
      <p className="mt-3 text-center text-xs font-black text-white/90">⭐ نجوم للاستخدام داخل لمتنا فقط ⓘ</p>
    </section>

    <section className="mt-3 grid grid-cols-2 gap-3">
      {menu.map(([label,desc,Icon,href,color])=><Link key={label} href={href} className="tap-action pixel-card flex items-center gap-3 rounded-[23px] p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[17px] bg-[#edf5ff]" style={{color}}><Icon size={21}/></span><div className="min-w-0 flex-1"><p className="text-[14px] font-black">{label}</p><p className="mt-1 truncate text-[10px] font-bold text-[#7a869a]">{desc}</p></div><ChevronLeft size={17} className="text-[#0e67f5]"/></Link>)}
    </section>

    <Link href="/settings" className="tap-action lammetna-gradient hero-shadow glow-card-surface mt-4 flex items-center justify-between rounded-[27px] p-5 text-white"><div><p className="text-[24px] font-black">إعدادات الحساب</p><p className="mt-1 text-sm font-bold text-white/85">تخصيص تجربتك في لمتنا</p></div><div className="flex items-center gap-2"><span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-white/16"><Settings size={28}/></span><ChevronLeft size={25}/></div></Link>
  </main></AppShell>
}
