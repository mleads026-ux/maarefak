'use client'
import {use,useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Ban,Flag,Heart,Send,MessageCircle,Star,X} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {PageHeader} from '@/components/page-header'
import {Button} from '@/components/ui/button'
import {Card,CardContent} from '@/components/ui/card'
import {Textarea} from '@/components/ui/textarea'
import {appConfirm,appPrompt} from '@/components/interaction-dialog'

export default function Person({params}:{params:Promise<{id:string}>}){
  const {id}=use(params)
  const s=useMemo(()=>createClient(),[])
  const r=useRouter()
  const [p,setP]=useState<any>(null)
  const [tags,setTags]=useState<any[]>([])
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [inviteOpen,setInviteOpen]=useState(false)
  const [inviteMessage,setInviteMessage]=useState('')
  const [photoOpen,setPhotoOpen]=useState(false)
  const [paidOpen,setPaidOpen]=useState(false)
  const [paidMessage,setPaidMessage]=useState('')
  const [directCost,setDirectCost]=useState(20)
  const [interested,setInterested]=useState(false)
  const [profileAge,setProfileAge]=useState<number|null>(null)
  const [isOnline,setIsOnline]=useState(false)

  useEffect(()=>{(async()=>{
    await s.rpc('record_profile_view',{p_target:id})
    const [{data:profile},{data:interests},{data:price},{data:ageValue},{data:onlineValue}]=await Promise.all([
      s.from('profiles').select('id,display_name,avatar_url,bio,mood,show_age,countries(name_ar),cities(name_ar)').eq('id',id).single(),
      s.from('profile_interests').select('interests(name_ar)').eq('profile_id',id),
      s.from('feature_prices').select('price_stars').eq('key','direct_message').eq('enabled',true).maybeSingle(),
      s.rpc('public_profile_age',{p_target:id}),
      s.rpc('public_profile_presence',{p_target:id}),
    ])
    setP(profile);setTags(interests||[]);setProfileAge(ageValue==null?null:Number(ageValue));setIsOnline(Boolean(onlineValue))
    if(price?.price_stars!=null)setDirectCost(Number(price.price_stars))
  })()},[id,s])

  useEffect(()=>{
    const presenceTimer=window.setInterval(async()=>{
      const {data}=await s.rpc('public_profile_presence',{p_target:id})
      setIsOnline(Boolean(data))
    },30000)
    return()=>window.clearInterval(presenceTimer)
  },[id,s])

  if(!p)return <AppShell><PageHeader title="الملف"/><div className="p-6 text-center text-sm text-slate-500">جاري التحميل...</div></AppShell>

  const age=profileAge

  async function findExistingConversation(){
    const {data:{user}}=await s.auth.getUser()
    if(!user)return null
    const {data:mine}=await s.from('conversation_members').select('conversation_id').eq('user_id',user.id)
    const ids=(mine||[]).map((x:any)=>x.conversation_id)
    if(!ids.length)return null
    const {data:other}=await s.from('conversation_members').select('conversation_id').eq('user_id',id).in('conversation_id',ids).limit(1)
    return other?.[0]?.conversation_id||null
  }

  async function invite(){
    setBusy(true);setNotice('')
    const {error}=await s.rpc('send_connection_request',{p_target:id,p_message:inviteMessage.trim()||null})
    setNotice(error
      ? error.message.includes('already')||error.message.includes('pending')?'يوجد طلب أو تواصل قائم بالفعل.':'تعذر إرسال دعوة التعارف.'
      : 'تم إرسال دعوة التعارف.')
    if(!error){setInviteMessage('');setInviteOpen(false)}
    setBusy(false)
  }

  async function paidDirect(){
    if(!paidMessage.trim())return
    if(!await appConfirm({
      title:'رسالة مباشرة',
      message:`إرسال هذه الرسالة مقابل ${directCost} نجمة؟`,
      confirmLabel:'إرسال'
    }))return
    setBusy(true);setNotice('')
    const existing=await findExistingConversation()
    if(existing){setPaidOpen(false);r.push(`/chats/${existing}`);return}
    const {error}=await s.rpc('request_paid_direct_message',{p_target:id,p_message:paidMessage.trim(),p_priority:false})
    if(error){
      if(error.message.includes('conversation_already_exists')){
        const conv=await findExistingConversation()
        if(conv){setPaidOpen(false);r.push(`/chats/${conv}`);return}
      }
      setNotice(error.message.includes('insufficient_stars')?'رصيد النجوم غير كافٍ.':'تعذر إرسال الرسالة الآن.')
    }else{
      setNotice('تم إرسال الرسالة بنجاح ⭐')
      setPaidMessage('');setPaidOpen(false)
    }
    setBusy(false)
  }

  async function interest(){
    setBusy(true)
    const {data,error}=await s.rpc('toggle_interest',{p_target:id})
    if(!error){setInterested(Boolean(data));setNotice(data?'تم تسجيل الاهتمام 💗':'تم إلغاء الاهتمام.')}
    else setNotice('تعذر تحديث الاهتمام.')
    setBusy(false)
  }

  async function block(){
    if(!await appConfirm({
      title:'حظر المستخدم',
      message:'لن يظهر لك هذا المستخدم في الاكتشاف أو التواصل.',
      confirmLabel:'حظر',
      danger:true
    }))return
    setBusy(true)
    const {error}=await s.rpc('block_user',{p_target:id})
    if(error){setNotice('تعذر الحظر الآن.');setBusy(false);return}
    r.push('/home')
  }

  async function report(){
    const reason=await appPrompt({
      title:'إبلاغ عن المستخدم',
      message:'اكتب سبب البلاغ باختصار.',
      placeholder:'سبب البلاغ...',
      confirmLabel:'إرسال البلاغ',
      danger:true
    })
    if(!reason)return
    setBusy(true)
    const {error}=await s.rpc('report_user',{p_target:id,p_reason:'other',p_description:reason.trim()})
    setNotice(error?'تعذر إرسال البلاغ.':'تم إرسال البلاغ للمراجعة.')
    setBusy(false)
  }

  return <AppShell><PageHeader title="الملف"/><main className="space-y-4 p-4">
    {notice?<p className="rounded-2xl bg-[#EAF2FC] p-3 text-sm font-bold text-[#1560BD]">{notice}</p>:null}
    <Card><CardContent className="text-center">
      <button onClick={()=>p.avatar_url&&setPhotoOpen(true)} className="tap-action mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-[#EAF2FC] text-4xl font-black text-[#1560BD]">
        {p.avatar_url?<img src={p.avatar_url} alt="" className="h-full w-full object-cover"/>:p.display_name?.[0]}
      </button>
      <div className="mt-3 flex items-center justify-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${isOnline?'bg-[#12d79d] shadow-[0_0_10px_rgba(18,215,157,.65)]':'bg-slate-400'}`}/><span className={`text-xs font-black ${isOnline?'text-[#159a70]':'text-slate-500'}`}>{isOnline?'متصل':'غير متصل'}</span></div><h1 className="mt-2 text-2xl font-extrabold">{p.display_name}{age?`، ${age}`:''}</h1>
      <p className="mt-1 text-sm text-slate-500">{[(p.cities as any)?.name_ar,(p.countries as any)?.name_ar].filter(Boolean).join('، ')} {p.mood?`· ${p.mood}`:''}</p>
      <p className="mt-4 text-sm leading-6 text-slate-600">{p.bio||'لا توجد نبذة بعد.'}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">{tags.map((x:any)=><span key={x.interests?.name_ar} className="rounded-full bg-[#EAF2FC] px-3 py-1.5 text-xs font-bold text-[#1560BD]">{x.interests?.name_ar}</span>)}</div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button onClick={()=>setInviteOpen(v=>!v)} disabled={busy}><Send size={16}/>دعوة تعارف</Button>
        <Button variant="secondary" onClick={interest} disabled={busy}><Heart size={16} fill={interested?'currentColor':'none'}/>{interested?'مهتم':'اهتمام'}</Button>
      </div>

      {inviteOpen?<div className="mt-3 rounded-[20px] bg-[#F4F8FD] p-3 text-right">
        <Textarea maxLength={280} value={inviteMessage} onChange={e=>setInviteMessage(e.target.value)} placeholder="رسالة قصيرة اختيارية مع دعوة التعارف"/>
        <Button className="mt-2 w-full" onClick={invite} disabled={busy}>إرسال الدعوة</Button>
      </div>:null}

      <Button className="mt-2 w-full" variant="secondary" onClick={()=>setPaidOpen(true)} disabled={busy}>
        <MessageCircle size={16}/>رسالة مباشرة · {directCost} <Star size={14} fill="currentColor"/>
      </Button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={block} disabled={busy}><Ban size={16}/>الحظر</Button>
        <Button variant="outline" onClick={report} disabled={busy}><Flag size={16}/>إبلاغ عن مخالفة</Button>
      </div>
    </CardContent></Card>
  </main>

  {paidOpen?<div className="fixed inset-0 z-[90] flex items-end bg-black/40" onClick={()=>setPaidOpen(false)}>
    <section onClick={e=>e.stopPropagation()} className="mx-auto w-full max-w-[432px] rounded-t-[34px] bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between"><div><h3 className="text-xl font-black">رسالة مباشرة</h3><p className="text-xs font-bold text-[#78849b]">التكلفة الحالية: {directCost} ⭐</p></div><button onClick={()=>setPaidOpen(false)} className="tap-action grid h-10 w-10 place-items-center rounded-full bg-[#eef3f8]"><X size={20}/></button></div>
      <Textarea className="mt-4 min-h-28" maxLength={500} value={paidMessage} onChange={e=>setPaidMessage(e.target.value)} placeholder="اكتب رسالة قصيرة لبدء التعارف..."/>
      <Button className="mt-3 w-full" onClick={paidDirect} disabled={busy||!paidMessage.trim()}>إرسال مقابل {directCost} ⭐</Button>
    </section>
  </div>:null}

  {photoOpen&&p.avatar_url?<div className="fixed inset-0 z-[95] grid place-items-center bg-black/85 p-6" onClick={()=>setPhotoOpen(false)}>
    <button className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white text-black"><X/></button>
    <img src={p.avatar_url} alt="" className="max-h-[82vh] max-w-full rounded-[28px] object-contain" onClick={e=>e.stopPropagation()}/>
  </div>:null}
  </AppShell>
}
