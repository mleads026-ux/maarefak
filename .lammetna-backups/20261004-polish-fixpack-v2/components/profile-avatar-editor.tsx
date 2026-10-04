'use client'
import {useRef,useState} from 'react'
import {Camera,X} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'

export function ProfileAvatarEditor({userId,avatar,isOnline}:{userId:string;avatar:string;isOnline:boolean}){
  const input=useRef<HTMLInputElement>(null)
  const [src,setSrc]=useState(avatar)
  const [open,setOpen]=useState(false)
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')

  async function upload(file?:File){
    if(!file)return
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setNotice('اختر صورة JPG أو PNG أو WebP.');return}
    if(file.size>8*1024*1024){setNotice('حجم الصورة يجب أن يكون أقل من 8MB.');return}
    setBusy(true);setNotice('')
    const s=createClient()
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase()
    const path=`${userId}/${crypto.randomUUID()}.${ext}`
    const up=await s.storage.from('avatars').upload(path,file,{contentType:file.type,upsert:false})
    if(up.error){setNotice('تعذر رفع الصورة الآن.');setBusy(false);return}
    const {data}=s.storage.from('avatars').getPublicUrl(path)
    const {error}=await s.from('profiles').update({avatar_url:data.publicUrl}).eq('id',userId)
    if(error){setNotice('تم الرفع لكن تعذر تحديث الملف.');setBusy(false);return}
    setSrc(data.publicUrl);setNotice('تم تحديث الصورة.');setBusy(false)
  }

  return <div className="relative mx-auto">
    <button type="button" onClick={()=>setOpen(true)} className="tap-action block h-36 w-36 overflow-hidden rounded-full border-[5px] border-white shadow-lg">
      <img src={src} alt="الصورة الشخصية" className="h-full w-full object-cover"/>
    </button>
    <span className={`pointer-events-none absolute bottom-2 right-2 h-5 w-5 rounded-full ${isOnline?'bg-[#13d292]':'bg-slate-400'} ring-4 ring-white`}/>
    <button type="button" disabled={busy} onClick={()=>input.current?.click()} className="tap-action absolute -left-2 top-0 grid h-11 w-11 place-items-center rounded-full bg-white text-[#0e67f5] shadow-lg">
      <Camera size={20}/>
    </button>
    <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload(e.target.files?.[0])}/>
    {notice?<span className="absolute -bottom-8 left-1/2 z-20 w-48 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-center text-[10px] font-black text-[#31557f] shadow">{notice}</span>:null}
    {open?<div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-6" onClick={()=>setOpen(false)}>
      <button className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white text-black"><X/></button>
      <img src={src} alt="" className="max-h-[78vh] max-w-full rounded-[28px] object-contain" onClick={e=>e.stopPropagation()}/>
    </div>:null}
  </div>
}
