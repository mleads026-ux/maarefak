'use client'

import {useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {ChevronLeft,Globe2,Lock,Search,Users,X} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {BrandLogo} from '@/components/brand-logo'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'

type Lamma={
  id:string
  owner_id:string
  public_lamma_id:string
  name:string
  emoji:string|null
  is_public:boolean
  created_at:string
  profiles:{display_name:string|null;avatar_url:string|null}|null
  space_members:{count:number}[]
}

const fallback=['/demo/face-1.jpg','/demo/face-2.jpg','/demo/face-3.jpg','/demo/face-4.jpg']

export default function AllLammatPage(){
  const s=useMemo(()=>createClient(),[])
  const r=useRouter()
  const [items,setItems]=useState<Lamma[]>([])
  const [query,setQuery]=useState('')
  const [notice,setNotice]=useState('')
  const [privateRoom,setPrivateRoom]=useState<Lamma|null>(null)
  const [password,setPassword]=useState('')

  async function load(){
    const {data:{user}}=await s.auth.getUser()
    if(!user){r.push('/login');return}

    const {data,error}=await s.from('spaces')
      .select('id,owner_id,public_lamma_id,name,emoji,is_public,created_at,profiles!spaces_owner_id_fkey(display_name,avatar_url),space_members(count)')
      .order('created_at',{ascending:false})
      .limit(200)

    if(error){
      setNotice('تعذر تحميل اللمّات الآن.')
      return
    }

    const rows=(data||[]) as any as Lamma[]
    rows.sort((a,b)=>(b.space_members?.[0]?.count||0)-(a.space_members?.[0]?.count||0))
    setItems(rows)
  }

  useEffect(()=>{
    load()
    const ch=s.channel('all-lammat-page')
      .on('postgres_changes',{event:'*',schema:'public',table:'spaces'},()=>load())
      .on('postgres_changes',{event:'*',schema:'public',table:'space_members'},()=>load())
      .subscribe()
    return()=>{s.removeChannel(ch)}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  const shown=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase('ar')
    if(!q)return items
    const upper=query.trim().toUpperCase()
    return items.filter(room=>
      room.name.toLocaleLowerCase('ar').includes(q)
      || room.public_lamma_id.toUpperCase().includes(upper)
    )
  },[items,query])

  async function enter(room:Lamma,pw?:string){
    setNotice('')
    const {error}=await s.rpc('join_lamma',{
      p_space:room.id,
      p_password:room.is_public?null:(pw||null)
    })
    if(error){
      if(error.message.includes('wrong_password')){
        setNotice('كلمة مرور اللَمّة غير صحيحة.')
      }else{
        setNotice('تعذر دخول اللَمّة الآن.')
      }
      return
    }
    setPrivateRoom(null)
    setPassword('')
    r.push(`/spaces/${room.id}`)
  }

  function openRoom(room:Lamma){
    if(room.is_public){
      void enter(room)
    }else{
      setPassword('')
      setPrivateRoom(room)
    }
  }

  return <AppShell>
    <main className="px-4 pb-8 pt-3">
      <header className="safe-top flex items-center justify-between">
        <button
          onClick={()=>r.push('/spaces')}
          aria-label="رجوع"
          className="tap-action grid h-11 w-11 place-items-center rounded-full bg-white text-[#1768f4] shadow-sm ring-1 ring-[#dfe9f5]"
        ><ChevronLeft size={22}/></button>

        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <h1 className="text-[25px] font-black leading-none">كل اللَمّات</h1>
            <p className="mt-1 text-[11px] font-bold text-[#748198]">ابحث بالاسم أو ID اللَمّة</p>
          </div>
          <BrandLogo size={48}/>
        </div>
      </header>

      {notice?<div className="mt-3 rounded-2xl bg-[#edf5ff] px-3 py-2 text-center text-xs font-black text-[#24528d]">{notice}</div>:null}

      <section className="mt-4 rounded-[26px] bg-white p-3 shadow-sm ring-1 ring-[#dfe9f5]">
        <div className="flex h-12 items-center gap-2 rounded-[18px] bg-[#f1f5fa] px-3 ring-1 ring-[#d9e4f0]">
          <Search size={20} className="shrink-0 text-[#1768f4]"/>
          <input
            value={query}
            onChange={e=>setQuery(e.target.value)}
            dir="auto"
            placeholder="ابحث باسم اللَمّة أو LM100002"
            className="min-w-0 flex-1 bg-transparent text-right text-sm font-bold outline-none placeholder:text-[#98a4b6]"
          />
          {query?<button onClick={()=>setQuery('')} aria-label="مسح البحث" className="tap-action grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[#6f7d94]"><X size={15}/></button>:null}
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-[10px] font-black text-[#7b879a]">
          <span>{shown.length} لَمّة</span>
          <span>الاسم أو الـID</span>
        </div>
      </section>

      <section className="mt-5 space-y-[22px]">
        {shown.map((room,index)=>{
          const count=room.space_members?.[0]?.count||0
          const hostName=room.profiles?.display_name||'Host'
          const avatar=room.profiles?.avatar_url||fallback[index%fallback.length]

          return <button
            key={room.id}
            onClick={()=>openRoom(room)}
            className="tap-action relative block h-[54px] w-full text-right"
          >
            <span className="lammetna-gradient absolute inset-0 overflow-hidden rounded-[18px] border border-white/45 shadow-[0_9px_22px_rgba(57,80,216,.22)]">
              <span className="absolute -right-4 -top-7 h-20 w-20 rounded-full border-[14px] border-white/10"/>
              <span className="absolute left-[40%] top-1 h-10 w-10 rounded-full bg-white/10"/>
            </span>

            <span className="absolute right-3 top-1/2 min-w-0 max-w-[42%] -translate-y-1/2 text-white">
              <span className="block truncate text-[13px] font-black">{room.emoji||'🎙️'} {room.name}</span>
              <span dir="ltr" className="mt-0.5 block truncate text-left text-[8px] font-black tracking-wide text-white/75">{room.public_lamma_id}</span>
            </span>

            <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-white/35 bg-white/16 px-3 py-1.5 text-[10px] font-black text-white backdrop-blur">
              <Users size={14}/>{count}
            </span>

            <span className="ornate-silver-ring absolute left-2 top-1/2 z-10 h-[76px] w-[76px] -translate-y-1/2 rounded-full p-[4px] shadow-[0_5px_16px_rgba(34,62,119,.28)]">
              <span className="relative block h-full w-full overflow-hidden rounded-full bg-[#dfeaf7]">
                <img src={avatar} alt={hostName} className="h-full w-full object-cover"/>
                <span className="absolute inset-x-0 bottom-0 bg-black/38 px-1 py-0.5 text-center text-[7px] font-black text-white">{hostName}</span>
              </span>
            </span>

            <span className="absolute left-[91px] top-1/2 -translate-y-1/2 text-white/90">
              {room.is_public?<Globe2 size={14}/>:<Lock size={14}/>}
            </span>
          </button>
        })}

        {!shown.length?<div className="rounded-[24px] border border-dashed border-[#cfdceb] bg-white/75 p-8 text-center">
          <Search className="mx-auto text-[#1768f4]" size={25}/>
          <p className="mt-2 text-sm font-black">مفيش لَمّة مطابقة للبحث</p>
          <p className="mt-1 text-[11px] font-bold text-[#7a869b]">جرّب اسم مختلف أو اكتب الـID كاملًا.</p>
        </div>:null}
      </section>

      {privateRoom?<div className="fixed inset-0 z-[120] flex items-end bg-black/45" onClick={()=>setPrivateRoom(null)}>
        <section onClick={e=>e.stopPropagation()} className="mx-auto w-full max-w-[432px] rounded-t-[30px] bg-white p-4 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl">
          <div className="flex items-center justify-between">
            <div><p className="text-base font-black">🔒 {privateRoom.name}</p><p className="mt-1 text-[10px] font-bold text-[#7b879a]">اكتب كلمة مرور اللَمّة للدخول</p></div>
            <button onClick={()=>setPrivateRoom(null)} className="tap-action grid h-9 w-9 place-items-center rounded-full bg-[#eef3f8]"><X size={18}/></button>
          </div>
          <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="كلمة المرور" className="mt-3 h-12 rounded-2xl"/>
          <Button onClick={()=>enter(privateRoom,password)} className="lammetna-gradient mt-2 h-12 w-full rounded-2xl font-black text-white">دخول اللَمّة</Button>
        </section>
      </div>:null}
    </main>
  </AppShell>
}
