'use client'
import {useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Camera} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {friendlyError} from '@/lib/utils'
import {BrandLogo} from '@/components/brand-logo'

type Country={id:string;name_ar:string}
type City={id:string;country_id:string;name_ar:string}
type Interest={id:string;name_ar:string}
const moods=['😊 مبسوط','😌 هادئ','🤔 بفكر','🔥 متحمس','☕ رايق','💬 عايز أتكلم']

export default function Onboarding(){
  const s=useMemo(()=>createClient(),[])
  const r=useRouter()
  const [welcome,setWelcome]=useState(true)
  const [step,setStep]=useState(1)
  const [countries,setCountries]=useState<Country[]>([])
  const [cities,setCities]=useState<City[]>([])
  const [interests,setInterests]=useState<Interest[]>([])
  const [name,setName]=useState('')
  const [birth,setBirth]=useState('')
  const [gender,setGender]=useState('')
  const [country,setCountry]=useState('')
  const [city,setCity]=useState('')
  const [bio,setBio]=useState('')
  const [mood,setMood]=useState('☕ رايق')
  const [selected,setSelected]=useState<string[]>([])
  const [avatar,setAvatar]=useState<File|null>(null)
  const [msg,setMsg]=useState('')
  const [busy,setBusy]=useState(false)

  useEffect(()=>{(async()=>{
    const [{data:c},{data:ct},{data:i}]=await Promise.all([
      s.from('countries').select('id,name_ar').order('name_ar'),
      s.from('cities').select('id,country_id,name_ar').order('name_ar'),
      s.from('interests').select('id,name_ar').order('name_ar')
    ])
    setCountries(c||[]);setCities(ct||[]);setInterests(i||[])
  })()},[s])

  const available=cities.filter(x=>x.country_id===country)

  async function save(){
    setBusy(true);setMsg('')
    const {data:{user}}=await s.auth.getUser()
    if(!user){r.push('/login');return}
    const {error}=await s.rpc('complete_profile',{
      p_display_name:name,p_birth_date:birth,p_country_id:country,p_city_id:city,
      p_bio:bio||null,p_mood:mood,p_interest_ids:selected,p_gender:gender
    })
    if(error){setMsg(friendlyError(error.message));setBusy(false);return}
    if(avatar){
      const ext=avatar.name.split('.').pop()?.toLowerCase()||'jpg'
      const path=`${user.id}/${crypto.randomUUID()}.${ext}`
      const up=await s.storage.from('avatars').upload(path,avatar,{upsert:false,contentType:avatar.type})
      if(!up.error){
        const {data}=s.storage.from('avatars').getPublicUrl(path)
        await s.from('profiles').update({avatar_url:data.publicUrl}).eq('id',user.id)
      }
    }
    r.push('/home');r.refresh()
  }

  if(welcome)return <main className="mx-auto min-h-[100dvh] w-full max-w-[432px] overflow-hidden bg-[#eef8ff]">
    <div className="relative">
      <img src="/reference/onboarding.jpg" alt="لمتنا" className="block h-auto w-full select-none" draggable={false}/>
      <button aria-label="ابدأ الآن" onClick={()=>setWelcome(false)} className="absolute left-[9.5%] top-[84.5%] h-[7.7%] w-[81%] rounded-[26px] bg-transparent"/>
      <button aria-label="تخطي" onClick={()=>setWelcome(false)} className="absolute left-[9.5%] top-[93%] h-[5%] w-[81%] rounded-[24px] bg-transparent"/>
    </div>
  </main>

  return <main className="mx-auto min-h-[100dvh] w-full max-w-[432px] bg-[linear-gradient(180deg,#f7fdff,#eef8ff)] p-5">
    <div className="flex items-center gap-3"><BrandLogo size={54}/><div><p className="text-xs font-black text-[#1268f5]">استكمال الملف</p><h1 className="text-2xl font-black">عرّفنا بنفسك</h1></div></div>
    <div className="mt-5 flex gap-2">{[1,2,3,4].map(n=><span key={n} className={`h-2 flex-1 rounded-full ${n<=step?'lammetna-gradient':'bg-[#dce7f2]'}`}/>)}</div>
    <section className="pixel-card mt-5 rounded-[30px] p-5">
      {step===1?<div className="space-y-4">
        <h2 className="text-xl font-black">المعلومات الأساسية</h2>
        <label className="block text-sm font-black">الاسم الظاهر<input className="mt-2 h-12 w-full rounded-2xl bg-[#f2f6fb] px-4 outline-none" value={name} onChange={e=>setName(e.target.value)} placeholder="اكتب اسمك"/></label>
        <label className="block text-sm font-black">تاريخ الميلاد<input type="date" className="mt-2 h-12 w-full rounded-2xl bg-[#f2f6fb] px-4 outline-none" value={birth} onChange={e=>setBirth(e.target.value)}/></label>
        <div><p className="mb-2 text-sm font-black">الجنس</p><div className="grid grid-cols-3 gap-2">{[['male','ذكر'],['female','أنثى'],['other','آخر']].map(([v,l])=><button key={v} onClick={()=>setGender(v)} className={`h-12 rounded-2xl font-black ${gender===v?'lammetna-gradient text-white':'bg-[#eef3f9] text-[#36506f]'}`}>{l}</button>)}</div></div>
      </div>:null}

      {step===2?<div className="space-y-4">
        <h2 className="text-xl font-black">مكانك</h2>
        <select value={country} onChange={e=>{setCountry(e.target.value);setCity('')}} className="h-12 w-full rounded-2xl bg-[#f2f6fb] px-4 outline-none"><option value="">اختر الدولة</option>{countries.map(x=><option key={x.id} value={x.id}>{x.name_ar}</option>)}</select>
        <select value={city} disabled={!country} onChange={e=>setCity(e.target.value)} className="h-12 w-full rounded-2xl bg-[#f2f6fb] px-4 outline-none"><option value="">اختر المدينة</option>{available.map(x=><option key={x.id} value={x.id}>{x.name_ar}</option>)}</select>
      </div>:null}

      {step===3?<div><h2 className="text-xl font-black">مزاجك واهتماماتك</h2><div className="mt-4 flex flex-wrap gap-2">{moods.map(m=><button key={m} onClick={()=>setMood(m)} className={`rounded-full px-3 py-2 text-xs font-black ${mood===m?'lammetna-gradient text-white':'bg-[#eef3f9] text-[#36506f]'}`}>{m}</button>)}</div><div className="mt-5 flex flex-wrap gap-2">{interests.map(x=>{const on=selected.includes(x.id);return <button key={x.id} onClick={()=>setSelected(v=>on?v.filter(y=>y!==x.id):[...v,x.id])} className={`rounded-full px-3 py-2 text-xs font-black ${on?'bg-[#6c48ff] text-white':'bg-[#f1f5fa] text-[#4b5d78]'}`}>{x.name_ar}</button>})}</div></div>:null}

      {step===4?<div className="space-y-4"><h2 className="text-xl font-black">اللمسات الأخيرة</h2><label className="flex h-24 cursor-pointer items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-[#b8cff0] bg-[#f5faff] font-black text-[#1567f4]"><Camera/> اختر صورة شخصية<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setAvatar(e.target.files?.[0]||null)}/></label><textarea value={bio} maxLength={500} onChange={e=>setBio(e.target.value)} placeholder="نبذة قصيرة عنك" className="min-h-28 w-full rounded-[22px] bg-[#f2f6fb] p-4 outline-none"/></div>:null}

      {msg?<p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{msg}</p>:null}
      <div className="mt-6 flex gap-2">
        {step>1?<button onClick={()=>setStep(step-1)} className="flex-1 rounded-2xl bg-[#eef3f9] py-3 font-black">السابق</button>:null}
        <button onClick={()=>step<4?setStep(step+1):save()} disabled={busy||(step===1&&(!name||!birth||!gender))||(step===2&&(!country||!city))} className="lammetna-gradient flex-1 rounded-2xl py-3 font-black text-white">{step<4?'التالي':busy?'جاري الحفظ...':'حفظ ومتابعة'}</button>
      </div>
    </section>
  </main>
}
