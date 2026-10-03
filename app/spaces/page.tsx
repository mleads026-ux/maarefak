'use client'
import {useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Bell,Plus,Users,Mic2,Lock,Globe2,Flame,Crown,Headphones,ChevronLeft} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {BrandLogo} from '@/components/brand-logo'

type Space={
  id:string;owner_id:string;name:string;description:string|null;emoji:string|null;category:string|null;
  image_url:string|null;is_public:boolean;pinned_until:string|null;created_at:string;space_members:{count:number}[]
}
const fallback=['/demo/face-1.jpg','/demo/face-2.jpg','/demo/face-3.jpg','/demo/face-4.jpg']

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

  async function load(){
    const {data}=await s.from('spaces').select('id,owner_id,name,description,emoji,category,image_url,is_public,pinned_until,created_at,space_members(count)').limit(100)
    const sorted=((data||[]) as any).sort((a:Space,b:Space)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())
    setItems(sorted)
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
    if(!isPublic&&password.trim().length<4){setNotice('كلمة مرور اللَمّة الخاصة لازم تكون 4 أحرف على الأقل.');return}
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

  const featured=items[0]
  const royalSeat=seats.find((x:any)=>x.seat_type==='star'||x.seat_no===1)
  const royal=royalSeat?profiles[royalSeat.user_id]:null
  const a=spot?.user_a?profiles[spot.user_a]:null
  const b=spot?.user_b?profiles[spot.user_b]:null
  const members=featured?.space_members?.[0]?.count||0

  return <AppShell>
    <main className="px-4 pb-5 pt-3">
      <header className="safe-top flex items-center justify-between">
        <div className="flex items-center gap-2.5"><BrandLogo size={50}/><div><h1 className="text-[31px] font-black leading-none">اللَّمّة</h1><p className="mt-1 text-[12px] font-bold text-[#6d7890]">غرف صوتية مباشرة تجمعنا دائمًا</p></div></div>
        <div className="flex gap-2"><button onClick={()=>setShow(!show)} className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#0e67f5] shadow-sm ring-1 ring-[#dfe9f5]"><Plus/></button><button className="relative grid h-11 w-11 place-items-center rounded-full bg-white text-[#0e67f5] shadow-sm ring-1 ring-[#dfe9f5]"><Bell size={21}/><span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#ff1678] ring-2 ring-white"/></button></div>
      </header>

      {notice?<p className="mt-3 rounded-2xl bg-[#edf5ff] p-3 text-sm font-bold text-[#244e87]">{notice}</p>:null}

      {featured?<section className="lammetna-gradient hero-shadow mt-4 overflow-hidden rounded-[31px] p-5 text-white">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-white/18 px-3 py-1.5 text-xs font-black">⭐ اللَّمّة الجديدة</span>
          <div className="flex items-center gap-2"><span className="rounded-full bg-[#116ddf]/65 px-3 py-1.5 text-xs font-black">◉ {Math.max(128,members)}</span><span className="rounded-full bg-[#ff1678] px-3 py-1.5 text-xs font-black">مباشر 🎙️</span></div>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_155px] gap-3">
          <div>
            <h2 className="text-[32px] font-black">{featured.name||'قهوة الصباح'} {featured.emoji||'☕'}</h2>
            <p className="mt-2 text-[14px] font-bold leading-6 text-white/90">{featured.description||'سوالف يومية ومشاركة تجارب مع أصدقاء لمتنا'}</p>

            <div className="mt-3 rounded-[23px] border border-white/25 bg-black/10 p-3">
              <p className="text-center text-[14px] font-black">⚔️ تحدي الآن</p>
              <div className="mt-2 flex items-center justify-center gap-3">
                <Mini user={a} fallback={fallback[0]} label="المقعد 2"/>
                <span className="text-lg font-black">⚡<br/>VS</span>
                <Mini user={b} fallback={fallback[1]} label="المقعد 3"/>
              </div>
            </div>

            <button onClick={()=>join(featured)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[21px] bg-white py-3 text-[18px] font-black text-[#6127df]"><Headphones/>دخول الآن <ChevronLeft/></button>
          </div>

          <div className="flex flex-col items-center">
            <div className="relative h-36 w-36 overflow-hidden rounded-full border-[4px] border-[#ffd552] bg-white/15 shadow-[0_0_0_7px_rgba(255,210,70,.20)]">
              <img src={royal?.avatar_url||fallback[2]} alt="" className="h-full w-full object-cover"/>
              <Crown className="absolute left-1/2 top-0 -translate-x-1/2 text-[#ffd02b]" fill="#ffd02b" size={40}/>
            </div>
            <span className="-mt-3 rounded-full bg-[#ffe7a1] px-3 py-1.5 text-[11px] font-black text-[#7a4d00]">الضيف الملكي 👑</span>
            <div className="mt-3 grid h-14 w-14 place-items-center rounded-full border-2 border-white bg-white/15"><Mic2 size={28}/></div>
            <div className="mt-4 flex -space-x-2 space-x-reverse">{fallback.map((src,i)=><img key={i} src={src} alt="" className="h-8 w-8 rounded-full border-2 border-white object-cover"/>)}</div>
            <p className="mt-2 flex items-center gap-1 text-[11px] font-black"><Users size={14}/>+{Math.max(128,members)} من الأعضاء</p>
          </div>
        </div>
      </section>:<section className="lammetna-gradient hero-shadow mt-4 rounded-[31px] p-8 text-center text-white"><Mic2 className="mx-auto" size={46}/><h2 className="mt-3 text-2xl font-black">ابدأ أول لَمّة</h2><p className="mt-2 text-sm font-bold text-white/80">أنشئ غرفة صوتية وابدأ الكلام.</p></section>}

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[[Flame,'الأكثر نشاطًا','#ff2b84'],[Lock,'خاص','#8a37e8'],[Users,'عام','#13b987'],[Globe2,'كل اللَمّات','#0e67f5']].map(([I,t,c]:any)=><button key={t} className="pixel-card rounded-[20px] p-3 text-[11px] font-black"><span className="mx-auto mb-1 grid h-9 w-9 place-items-center rounded-full bg-[#edf5ff]" style={{color:c}}><I size={20}/></span>{t}</button>)}
      </div>

      {show?<section className="pixel-card mt-4 rounded-[28px] p-4">
        <h3 className="text-lg font-black">إنشاء لَمّة جديدة</h3>
        <div className="mt-3 grid grid-cols-[70px_1fr] gap-2"><input className="h-12 rounded-2xl bg-[#f2f6fb] px-3" value={emoji} onChange={e=>setEmoji(e.target.value.slice(0,4))}/><input className="h-12 rounded-2xl bg-[#f2f6fb] px-3" placeholder="اسم اللَمّة" value={name} onChange={e=>setName(e.target.value)}/></div>
        <textarea className="mt-2 min-h-20 w-full rounded-2xl bg-[#f2f6fb] p-3" placeholder="وصف مختصر" value={desc} onChange={e=>setDesc(e.target.value)}/>
        <input className="mt-2 h-12 w-full rounded-2xl bg-[#f2f6fb] px-3" placeholder="التصنيف" value={category} onChange={e=>setCategory(e.target.value)}/>
        <div className="mt-2 grid grid-cols-2 gap-2"><button onClick={()=>setIsPublic(true)} className={`rounded-2xl p-3 font-black ${isPublic?'lammetna-gradient text-white':'bg-[#eef3f9]'}`}>🌍 عامة</button><button onClick={()=>setIsPublic(false)} className={`rounded-2xl p-3 font-black ${!isPublic?'lammetna-gradient text-white':'bg-[#eef3f9]'}`}>🔒 خاصة</button></div>
        {!isPublic?<input type="password" className="mt-2 h-12 w-full rounded-2xl bg-[#f2f6fb] px-3" placeholder="كلمة المرور" value={password} onChange={e=>setPassword(e.target.value)}/>:null}
        <button onClick={create} className="lammetna-gradient mt-3 h-12 w-full rounded-2xl font-black text-white">إنشاء اللَمّة</button>
      </section>:null}

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[23px] font-black">اللَمّات النشطة الآن 🎙️</h2><button onClick={()=>setShow(true)} className="grid h-9 w-9 place-items-center rounded-full bg-[#eaf4ff] text-[#0e67f5]"><Plus size={18}/></button></div>
        <div className="space-y-2">
          {items.map((x,i)=><div key={x.id} className="pixel-card flex items-center gap-3 rounded-[22px] p-3">
            <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full bg-[#eaf3fb]"><img src={x.image_url||fallback[i%4]} alt="" className="h-[52px] w-[52px] object-cover"/><span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#11d091] ring-2 ring-white"/></div>
            <div className="min-w-0 flex-1"><p className="truncate font-black">{x.name}</p><p className="truncate text-[11px] font-bold text-[#738097]">{x.description||'لَمّة صوتية'}</p><div className="mt-1 flex gap-2 text-[10px] font-black"><span className={`rounded-full px-2 py-1 ${x.is_public?'bg-[#dff8ee] text-[#11946a]':'bg-[#f1e4ff] text-[#8e31d8]'}`}>{x.is_public?'عام 🌐':'خاص 🔒'}</span><span className="text-[#748198]">{x.space_members?.[0]?.count||0} 👥</span></div>{!x.is_public?<input type="password" className="mt-2 h-9 w-full rounded-xl bg-[#f2f6fa] px-3 text-xs" placeholder="كلمة المرور" value={joinPw[x.id]||''} onChange={e=>setJoinPw(v=>({...v,[x.id]:e.target.value}))}/>:null}</div>
            <button onClick={()=>join(x)} className="lammetna-gradient rounded-[18px] px-4 py-2 text-sm font-black text-white">دخول 🎧</button>
          </div>)}
        </div>
      </section>
    </main>
  </AppShell>
}

function Mini({user,fallback,label}:{user:any;fallback:string;label:string}){
  return <div className="text-center"><div className="mx-auto h-[52px] w-[52px] overflow-hidden rounded-full border-2 border-white bg-white/15"><img src={user?.avatar_url||fallback} alt="" className="h-full w-full object-cover"/></div><p className="mt-1 rounded-full bg-white/13 px-2 py-1 text-[10px] font-black">{label}</p></div>
}
