'use client'
import Link from 'next/link'
import {useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Bell,Plus,Users,Mic2,Lock,Globe2,Flame,Headphones,Eye,ChevronLeft,Swords,Trash2,Hash} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {BrandLogo} from '@/components/brand-logo'
import {VoiceGlowBar} from '@/components/voice-glow-bar'
import {appConfirm} from '@/components/interaction-dialog'

type Space={
  id:string;owner_id:string;public_lamma_id:string;name:string;description:string|null;emoji:string|null;category:string|null;
  image_url:string|null;is_public:boolean;pinned_until:string|null;created_at:string;space_members:{count:number}[]
}
type Filter='active'|'private'|'public'|'all'
const fallback=['/demo/face-1.jpg','/demo/face-2.jpg','/demo/face-3.jpg','/demo/face-4.jpg']
const lammaEmojis=['🎙️','🎧','🎤','🗣️','💬','🫂','👥','👋','✨','⭐','🌟','💫','🔥','🎉','🥳','😎','😂','😍','🥰','🤩','😄','🤝','💜','💙','🩵','❤️','🧡','💚','🌈','☕','🎮','⚽','🎵','🎶','📚','💡','🚀','🌙','☀️','🌍','🧠','🎯','🏆','👑','⚔️','🛋️','🏠']

export default function Spaces(){
  const s=useMemo(()=>createClient(),[])
  const r=useRouter()
  const [items,setItems]=useState<Space[]>([])
  const [show,setShow]=useState(false)
  const [name,setName]=useState('')
  const [desc,setDesc]=useState('')
  const [emoji,setEmoji]=useState('🎙️')
  const [category,setCategory]=useState('عام')
  const [isPublic,setIsPublic]=useState(true)
  const [password,setPassword]=useState('')
  const [joinPw,setJoinPw]=useState<Record<string,string>>({})
  const [notice,setNotice]=useState('')
  const [seats,setSeats]=useState<any[]>([])
  const [spot,setSpot]=useState<any>(null)
  const [profiles,setProfiles]=useState<Record<string,any>>({})
  const [filter,setFilter]=useState<Filter>('active')
  const [myRooms,setMyRooms]=useState<Space[]>([])

  async function load(){
    const {data:{user}}=await s.auth.getUser()
    const [{data},{data:mine}]=await Promise.all([
      s.from('spaces').select('id,owner_id,public_lamma_id,name,description,emoji,category,image_url,is_public,pinned_until,created_at,space_members(count)').limit(100),
      user?s.from('spaces').select('id,owner_id,public_lamma_id,name,description,emoji,category,image_url,is_public,pinned_until,created_at,space_members(count)').eq('owner_id',user.id).order('created_at',{ascending:false}):Promise.resolve({data:[]} as any)
    ])
    const sorted=((data||[]) as any).sort((a:Space,b:Space)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())
    setItems(sorted)
    setMyRooms((mine||[]) as any)
    if(sorted[0]){
      const [{data:sr},{data:sp}]=await Promise.all([
        s.from('space_seats').select('seat_no,user_id,seat_type').eq('space_id',sorted[0].id),
        s.from('space_pair_spotlights').select('user_a,user_b,status').eq('space_id',sorted[0].id).eq('status','active').maybeSingle()
      ])
      setSeats(sr||[]);setSpot(sp||null)
      const ids=[...(sr||[]).map((x:any)=>x.user_id),sp?.user_a,sp?.user_b].filter(Boolean)
      if(ids.length){
        const {data:ps}=await s.from('profiles').select('id,display_name,avatar_url').in('id',[...new Set(ids)])
        setProfiles(Object.fromEntries((ps||[]).map((x:any)=>[x.id,x])))
      }
    }
  }
  useEffect(()=>{load()},[])

  async function create(){
    if(!name.trim())return
    if(!isPublic&&password.trim().length<8){setNotice('كلمة مرور اللَمّة الخاصة لازم تكون 8 أحرف على الأقل.');return}
    const {data,error}=await s.rpc('create_lamma',{p_name:name.trim(),p_description:desc||null,p_emoji:emoji,p_category:category,p_is_public:isPublic,p_password:isPublic?null:password.trim()})
    if(error){setNotice('تعذر إنشاء اللَمّة.');return}
    setShow(false)
    if(data)r.push(`/spaces/${data}`)
  }

  async function join(x:Space){
    const {error}=await s.rpc('join_lamma',{p_space:x.id,p_password:x.is_public?null:joinPw[x.id]||null})
    if(error){setNotice(error.message.includes('wrong_password')?'كلمة المرور غير صحيحة.':'تعذر دخول اللَمّة.');return}
    r.push(`/spaces/${x.id}`)
  }

  async function removeMyRoom(x:Space){
    const ok=await appConfirm({
      title:'حذف اللَمّة',
      message:`سيتم حذف "${x.name}" نهائيًا مع رسائلها وأعضائها. هل تريد المتابعة؟`,
      confirmLabel:'حذف اللَمّة',
      danger:true
    })
    if(!ok)return
    const {error}=await s.rpc('delete_my_lamma',{p_space:x.id})
    setNotice(error?'تعذر حذف اللَمّة.':'تم حذف اللَمّة.')
    await load()
  }

  const featured=items[0]
  const royalSeat=seats.find((x:any)=>x.seat_type==='star'&&x.user_id)
  const royal=royalSeat?profiles[royalSeat.user_id]:null
  const a=spot?.user_a?profiles[spot.user_a]:null
  const b=spot?.user_b?profiles[spot.user_b]:null
  const members=featured?.space_members?.[0]?.count||0

  const shown=useMemo(()=>{
    let v=[...items]
    if(filter==='private')v=v.filter(x=>!x.is_public)
    if(filter==='public')v=v.filter(x=>x.is_public)
    if(filter==='active')v.sort((x,y)=>(y.space_members?.[0]?.count||0)-(x.space_members?.[0]?.count||0))
    return v
  },[items,filter])

  return <AppShell>
    <main className="px-4 pb-5 pt-3">
      <header className="safe-top flex items-center justify-between">
        <div className="flex items-center gap-2.5"><BrandLogo size={50}/><div><h1 className="text-[31px] font-black leading-none">اللَّمّة</h1><p className="mt-1 text-[12px] font-bold text-[#6d7890]">غرف صوتية مباشرة تجمعنا دائمًا</p></div></div>
        <div className="flex gap-2">
          <button onClick={()=>setShow(!show)} className="tap-action grid h-11 w-11 place-items-center rounded-full bg-white text-[#0e67f5] shadow-sm ring-1 ring-[#dfe9f5]"><Plus/></button>
          <Link href="/notifications" className="tap-action relative grid h-11 w-11 place-items-center rounded-full bg-white text-[#0e67f5] shadow-sm ring-1 ring-[#dfe9f5]"><Bell size={21}/><span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#ff1678] ring-2 ring-white"/></Link>
        </div>
      </header>

      {notice?<p className="mt-3 rounded-2xl bg-[#edf5ff] p-3 text-sm font-bold text-[#244e87]">{notice}</p>:null}

      {featured?<section className="lammetna-gradient hero-shadow animated-gradient-card relative mt-4 overflow-hidden rounded-[31px] p-5 text-white">
        <div className="pointer-events-none absolute -left-16 -top-12 h-72 w-72 rounded-full border-[34px] border-white/10"/>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-white/20 px-3 py-2 text-xs font-black">⭐ اللَّمّة الجديدة</span>
          <div className="flex gap-2"><span className="rounded-full bg-[#ff0b77] px-3 py-2 text-xs font-black">▥ مباشر</span><span className="rounded-full bg-[#1269d8] px-3 py-2 text-xs font-black"><Eye className="ml-1 inline" size={15}/>{members}</span></div>
        </div>
        <div className="mt-3 grid grid-cols-[1.08fr_.92fr] gap-3">
          <div>
            <h2 className="text-[29px] font-black">{featured.emoji||'🎙️'} {featured.name}</h2>
            <p className="mt-1 text-sm font-bold leading-6 text-white/88">{featured.description||'لَمّة صوتية مباشرة مع أصدقاء لمتنا'}</p>
            <VoiceGlowBar streams={[]} active={members>0} compact/>
            <div className="mt-3 rounded-[22px] border border-white/30 bg-white/10 p-3">
              <p className="text-center text-sm font-black">⚔️ تحدي الآن</p>
              <div className="mt-2 flex items-center justify-center gap-3">
                {[a,b].map((p,i)=>p?<Link key={p.id} href={`/people/${p.id}`} className="tap-action text-center"><img src={p.avatar_url||fallback[i+1]} alt="" className="mx-auto h-14 w-14 rounded-full border-2 border-white object-cover"/><span className="mt-1 block text-[10px] font-black">{p.display_name}</span></Link>:<span key={i} className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-white/50 text-xs">؟</span>)}
                <Swords size={24}/>
              </div>
            </div>
            <button onClick={()=>join(featured)} className="tap-action mt-4 flex w-full items-center justify-center gap-3 rounded-full bg-white py-3 text-[18px] font-black text-[#6723d9]"><Headphones size={24}/> دخول الآن <ChevronLeft size={20}/></button>
          </div>
          <div className="relative flex min-h-[245px] items-center justify-center">
            <div className="absolute h-36 w-36 rounded-full border-[5px] border-[#ffd85a] bg-white/10 shadow-[0_0_30px_rgba(255,211,60,.8)]">
              <Link href={royal?.id?`/people/${royal.id}`:`/spaces/${featured.id}`} className="tap-action block h-full w-full overflow-hidden rounded-full">
                <img src={royal?.avatar_url||fallback[1]} alt="" className="h-full w-full object-cover"/>
              </Link>
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-4xl">👑</span>
              <span className="absolute -bottom-8 left-1/2 w-max -translate-x-1/2 rounded-full bg-[#ffdd64] px-3 py-1 text-[11px] font-black text-[#6d4200]">الضيف الملكي</span>
            </div>
            <div className="absolute bottom-0 flex -space-x-2 space-x-reverse">{seats.slice(0,4).map((seat:any,i:number)=>{const p=profiles[seat.user_id];return <Link href={p?.id?`/people/${p.id}`:`/spaces/${featured.id}`} key={seat.user_id||i} className="tap-action h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-white"><img src={p?.avatar_url||fallback[i%4]} alt="" className="h-full w-full object-cover"/></Link>})}</div>
          </div>
        </div>
      </section>:<div className="pixel-card mt-4 rounded-[31px] p-8 text-center"><Mic2 className="mx-auto text-[#6b3df4]"/><p className="mt-2 font-black">لا توجد لَمّات نشطة الآن</p><button onClick={()=>setShow(true)} className="tap-action lammetna-gradient mt-3 rounded-full px-5 py-2 text-sm font-black text-white">أنشئ أول لَمّة</button></div>}

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          ['active',Flame,'الأكثر نشاطًا','#ff2b84'],
          ['private',Lock,'خاص','#8a37e8'],
          ['public',Users,'عام','#13b987'],
          ['all',Globe2,'كل اللَمّات','#0e67f5']
        ].map(([key,I,t,c]:any)=><button key={key} onClick={()=>key==='all'?r.push('/spaces/all'):setFilter(key)} className={`tap-action rounded-[20px] p-3 text-[11px] font-black shadow-sm ring-1 ring-[#e0e9f5] ${filter===key?'bg-[#edf6ff] ring-2 ring-[#8cc7ff]':'bg-white'}`}><span className="mx-auto mb-1 grid h-9 w-9 place-items-center rounded-full bg-[#edf5ff]" style={{color:c}}><I size={20}/></span>{t}</button>)}
      </div>

      {show?<section className="pixel-card mt-4 rounded-[28px] p-4">
        <h3 className="text-lg font-black">إنشاء لَمّة جديدة</h3>
        <div className="mt-3 grid grid-cols-[108px_1fr] gap-2"><label className="rounded-2xl bg-[#f2f6fb] px-2 py-1 text-center"><span className="block text-[10px] font-black text-[#6f7d94]">رمز اللَمّة</span><select aria-label="رمز اللَمّة" className="mt-0.5 h-8 w-full cursor-pointer bg-transparent text-center text-2xl outline-none" value={emoji} onChange={e=>setEmoji(e.target.value)}>{lammaEmojis.map(x=><option key={x} value={x}>{x}</option>)}</select></label><input className="h-12 rounded-2xl bg-[#f2f6fb] px-3" placeholder="اسم اللَمّة" value={name} onChange={e=>setName(e.target.value)}/></div>
        <textarea className="mt-2 min-h-20 w-full rounded-2xl bg-[#f2f6fb] p-3" placeholder="وصف مختصر" value={desc} onChange={e=>setDesc(e.target.value)}/>
        <input className="mt-2 h-12 w-full rounded-2xl bg-[#f2f6fb] px-3" placeholder="التصنيف" value={category} onChange={e=>setCategory(e.target.value)}/>
        <div className="mt-2 grid grid-cols-2 gap-2"><button onClick={()=>setIsPublic(true)} className={`tap-action rounded-2xl p-3 font-black ${isPublic?'lammetna-gradient text-white':'bg-[#eef3f9]'}`}>🌍 عامة</button><button onClick={()=>setIsPublic(false)} className={`tap-action rounded-2xl p-3 font-black ${!isPublic?'lammetna-gradient text-white':'bg-[#eef3f9]'}`}>🔒 خاصة</button></div>
        {!isPublic?<input type="password" className="mt-2 h-12 w-full rounded-2xl bg-[#f2f6fb] px-3" placeholder="كلمة المرور" value={password} onChange={e=>setPassword(e.target.value)}/>:null}
        <button onClick={create} className="tap-action lammetna-gradient mt-3 h-12 w-full rounded-2xl font-black text-white">إنشاء اللَمّة</button>
      </section>:null}

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between"><div><h2 className="text-[22px] font-black">لمّاتي السابقة</h2><p className="text-[11px] font-bold text-[#7a869b]">كل لَمّة أنشأتها لها ID ثابت ويمكنك حذفها في أي وقت.</p></div><Hash size={22} className="text-[#1768f4]"/></div>
        <div className="space-y-2">
          {myRooms.map(room=><div key={room.id} className="pixel-card flex items-center gap-3 rounded-[22px] p-3">
            <Link href={`/spaces/${room.id}`} className="min-w-0 flex-1">
              <p className="truncate font-black">{room.emoji||'🎙️'} {room.name}</p>
              <p dir="ltr" className="mt-1 text-left text-[11px] font-black tracking-wider text-[#1768f4]">ID: {room.public_lamma_id}</p>
              <p className="mt-1 text-[10px] font-bold text-[#7a869b]">{new Date(room.created_at).toLocaleDateString('ar-EG')} · {room.is_public?'عامة':'خاصة'}</p>
            </Link>
            <button onClick={()=>removeMyRoom(room)} className="tap-action grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff0f3] text-[#d9244e]" aria-label="حذف اللَمّة"><Trash2 size={18}/></button>
          </div>)}
          {!myRooms.length?<div className="rounded-[20px] border border-dashed border-[#cfdceb] bg-white/70 p-4 text-center text-xs font-bold text-[#7a869b]">لم تنشئ أي لَمّة حتى الآن.</div>:null}
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[23px] font-black">اللَمّات النشطة الآن 🎙️</h2><button onClick={()=>setShow(true)} className="tap-action grid h-9 w-9 place-items-center rounded-full bg-[#eaf4ff] text-[#0e67f5]"><Plus size={18}/></button></div>
        <div className="space-y-2">
          {shown.map((x,i)=><div key={x.id} className="pixel-card glow-lamma-card flex items-center gap-3 rounded-[22px] p-3">
            <Link href={`/spaces/${x.id}`} className="tap-action relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full bg-[#eaf3fb]"><img src={x.image_url||fallback[i%4]} alt="" className="h-[52px] w-[52px] object-cover"/><span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#11d091] ring-2 ring-white"/></Link>
            <div className="min-w-0 flex-1"><Link href={`/spaces/${x.id}`} className="tap-action block"><p className="truncate font-black">{x.name}</p><p className="truncate text-[11px] font-bold text-[#738097]">{x.description||'لَمّة صوتية'}</p></Link><div className="mt-1 flex gap-2 text-[10px] font-black"><span className={`rounded-full px-2 py-1 ${x.is_public?'bg-[#dff8ee] text-[#11946a]':'bg-[#f1e4ff] text-[#8e31d8]'}`}>{x.is_public?'عام 🌐':'خاص 🔒'}</span><span className="text-[#748198]">{x.space_members?.[0]?.count||0} 👥</span></div>{!x.is_public?<input type="password" className="mt-2 h-9 w-full rounded-xl bg-[#f2f6fa] px-3 text-xs" placeholder="كلمة المرور" value={joinPw[x.id]||''} onChange={e=>setJoinPw(v=>({...v,[x.id]:e.target.value}))}/>:null}</div>
            <button onClick={()=>join(x)} className="tap-action lammetna-gradient rounded-[18px] px-4 py-2 text-sm font-black text-white">دخول 🎧</button>
          </div>)}
          {!shown.length?<p className="py-8 text-center text-sm font-bold text-[#758199]">لا توجد لَمّات مطابقة لهذا الفلتر.</p>:null}
        </div>
      </section>
    </main>
  </AppShell>
}
