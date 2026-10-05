'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Mic,Square,Play,RotateCcw,Trash2,Volume2} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {PageHeader} from '@/components/page-header'
import {Button} from '@/components/ui/button'
import {Card,CardContent} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {appConfirm} from '@/components/interaction-dialog'

const moods=['😊 مبسوط','😌 هادئ','🤔 بفكر','🔥 متحمس','😴 مرهق','☕ رايق','💬 عايز أتكلم','🎧 بسمع مزيكا']

function preferredMime(){
  if(typeof MediaRecorder==='undefined')return ''
  const candidates=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg']
  return candidates.find(x=>MediaRecorder.isTypeSupported(x))||''
}
function extFor(mime:string){
  if(mime.includes('mp4'))return 'm4a'
  if(mime.includes('ogg'))return 'ogg'
  if(mime.includes('mpeg'))return 'mp3'
  if(mime.includes('wav'))return 'wav'
  return 'webm'
}

export default function Settings(){
  const s=useMemo(()=>createClient(),[])
  const r=useRouter()
  const [uid,setUid]=useState('')
  const [name,setName]=useState('')
  const [bio,setBio]=useState('')
  const [mood,setMood]=useState('')
  const [discoverable,setDiscoverable]=useState(true)
  const [allowInvites,setAllowInvites]=useState(true)
  const [showAge,setShowAge]=useState(true)
  const [blocked,setBlocked]=useState<any[]>([])
  const [confirmText,setConfirmText]=useState('')
  const [theme,setTheme]=useState('classic')
  const [owned,setOwned]=useState<string[]>([])
  const [boostUntil,setBoostUntil]=useState<string|null>(null)
  const [audioPath,setAudioPath]=useState('')
  const [audioTitle,setAudioTitle]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)

  const [recording,setRecording]=useState(false)
  const [recordSecs,setRecordSecs]=useState(0)
  const [recordedBlob,setRecordedBlob]=useState<Blob|null>(null)
  const [recordedUrl,setRecordedUrl]=useState('')
  const [currentAudioUrl,setCurrentAudioUrl]=useState('')
  const recorderRef=useRef<MediaRecorder|null>(null)
  const streamRef=useRef<MediaStream|null>(null)
  const timerRef=useRef<any>(null)
  const chunksRef=useRef<Blob[]>([])

  useEffect(()=>{(async()=>{
    const {data:{user}}=await s.auth.getUser()
    if(!user)return
    setUid(user.id)
    const [{data:p},{data:b}]=await Promise.all([
      s.from('profiles').select('display_name,bio,mood,discoverable,allow_invitations,show_age,profile_theme,boost_until,voice_intro_path,audio_intro_kind,audio_intro_title').eq('id',user.id).single(),
      s.from('blocks').select('blocked_id,profiles!blocks_blocked_id_fkey(display_name)').eq('blocker_id',user.id)
    ])
    if(p){
      setName(p.display_name)
      setBio(p.bio||'')
      setMood(p.mood||'')
      setDiscoverable(p.discoverable)
      setAllowInvites(p.allow_invitations)
      setShowAge(p.show_age)
      setTheme(p.profile_theme||'classic')
      setBoostUntil(p.boost_until||null)
      setAudioPath(p.voice_intro_path||'')
      setAudioTitle(p.audio_intro_title||'مقدمتي الصوتية')
      if(p.voice_intro_path){
        const {data}=await s.storage.from('voice-intros').createSignedUrl(p.voice_intro_path,900)
        setCurrentAudioUrl(data?.signedUrl||'')
      }
    }
    setBlocked(b||[])
    const {data:o}=await s.from('profile_theme_purchases').select('theme').eq('user_id',user.id)
    setOwned((o||[]).map((x:any)=>x.theme))
  })()},[s])

  useEffect(()=>{
    return()=>{
      if(recordedUrl)URL.revokeObjectURL(recordedUrl)
      if(timerRef.current)clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach(t=>t.stop())
    }
  },[recordedUrl])

  async function save(){
    setBusy(true)
    const {error}=await s.from('profiles').update({display_name:name,bio:bio||null,mood,discoverable,allow_invitations:allowInvites,show_age:showAge}).eq('id',uid)
    setNotice(error?'تعذر حفظ التغييرات.':'تم حفظ التغييرات.')
    setBusy(false)
  }

  async function unblock(id:string){
    await s.rpc('unblock_user',{p_target:id})
    setBlocked(x=>x.filter(y=>y.blocked_id!==id))
    setNotice('تم إلغاء الحظر.')
  }

  async function buyTheme(t:string){
    setBusy(true)
    const {error}=await s.rpc('buy_profile_theme',{p_theme:t})
    setNotice(error?(error.message.includes('insufficient_stars')?'رصيد النجوم غير كافٍ.':'تعذر شراء الثيم.'):'تم تفعيل الثيم.')
    if(!error){setTheme(t);setOwned(x=>Array.from(new Set([...x,t])))}
    setBusy(false)
  }

  async function activateTheme(t:string){
    setBusy(true)
    const {error}=await s.rpc('activate_owned_profile_theme',{p_theme:t})
    setNotice(error?'الثيم غير مملوك أو تعذر تفعيله.':'تم تغيير شكل الملف.')
    if(!error)setTheme(t)
    setBusy(false)
  }

  async function boost(kind:'30m'|'2h'){
    if(!await appConfirm({
      title:'تشغيل Boost 🚀',
      message:`تشغيل Boost ${kind==='30m'?'لمدة 30 دقيقة':'لمدة ساعتين'} باستخدام النجوم؟`,
      confirmLabel:'تشغيل'
    }))return
    setBusy(true)
    const {error}=await s.rpc('activate_profile_boost',{p_kind:kind})
    setNotice(error?(error.message.includes('insufficient_stars')?'رصيد النجوم غير كافٍ.':'تعذر تشغيل Boost.'):'تم تشغيل Boost للملف 🚀')
    setBusy(false)
  }

  async function startRecording(){
    setNotice('')
    if(typeof navigator==='undefined'||!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
      setNotice('التسجيل الصوتي غير مدعوم على هذا الجهاز أو المتصفح.')
      return
    }
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true})
      streamRef.current=stream
      chunksRef.current=[]
      const mime=preferredMime()
      const rec=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream)
      recorderRef.current=rec
      rec.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data)}
      rec.onstop=()=>{
        const actual=rec.mimeType||mime||'audio/webm'
        const blob=new Blob(chunksRef.current,{type:actual})
        if(recordedUrl)URL.revokeObjectURL(recordedUrl)
        const url=URL.createObjectURL(blob)
        setRecordedBlob(blob)
        setRecordedUrl(url)
        stream.getTracks().forEach(t=>t.stop())
        streamRef.current=null
      }
      rec.start(250)
      setRecordSecs(0)
      setRecording(true)
      timerRef.current=setInterval(()=>{
        setRecordSecs(v=>{
          if(v>=59){
            stopRecording()
            return 60
          }
          return v+1
        })
      },1000)
    }catch{
      setNotice('لا يمكن الوصول إلى الميكروفون. اسمح للتطبيق باستخدام المايك وحاول مرة أخرى.')
    }
  }

  function stopRecording(){
    if(timerRef.current){clearInterval(timerRef.current);timerRef.current=null}
    const rec=recorderRef.current
    if(rec&&rec.state!=='inactive')rec.stop()
    setRecording(false)
  }

  function resetRecording(){
    if(recordedUrl)URL.revokeObjectURL(recordedUrl)
    setRecordedBlob(null)
    setRecordedUrl('')
    setRecordSecs(0)
  }

  async function saveRecording(){
    if(!recordedBlob||!uid)return
    if(recordedBlob.size>5*1024*1024){setNotice('التسجيل أكبر من الحد المسموح 5MB. سجل مقدمة أقصر.');return}
    setBusy(true);setNotice('')
    const mime=recordedBlob.type||'audio/webm'
    const ext=extFor(mime)
    const path=`${uid}/${crypto.randomUUID()}.${ext}`
    const up=await s.storage.from('voice-intros').upload(path,recordedBlob,{contentType:mime,upsert:false})
    if(up.error){setNotice('تعذر رفع التسجيل الصوتي.');setBusy(false);return}
    const {error}=await s.rpc('set_audio_intro',{p_path:path,p_kind:'voice',p_title:audioTitle.trim()||'مقدمتي الصوتية'})
    if(error){
      await s.storage.from('voice-intros').remove([path])
      setNotice('تعذر حفظ المقدمة الصوتية.')
      setBusy(false)
      return
    }
    if(audioPath&&audioPath!==path)await s.storage.from('voice-intros').remove([audioPath])
    const signed=await s.storage.from('voice-intros').createSignedUrl(path,900)
    setAudioPath(path)
    setCurrentAudioUrl(signed.data?.signedUrl||recordedUrl)
    resetRecording()
    setNotice('تم حفظ المقدمة الصوتية 🎙️')
    setBusy(false)
  }

  async function deleteAudio(){
    if(!audioPath&&!recordedBlob)return
    if(!await appConfirm({
      title:'حذف المقدمة الصوتية',
      message:'سيتم حذف المقدمة الصوتية الحالية من ملفك.',
      confirmLabel:'حذف',
      danger:true
    }))return
    setBusy(true)
    const {error}=await s.rpc('set_audio_intro',{p_path:null,p_kind:'voice',p_title:null})
    if(!error&&audioPath)await s.storage.from('voice-intros').remove([audioPath])
    if(error)setNotice('تعذر حذف المقدمة.')
    else{
      setAudioPath('')
      setCurrentAudioUrl('')
      resetRecording()
      setNotice('تم حذف المقدمة الصوتية.')
    }
    setBusy(false)
  }

  async function logout(){
    await s.auth.signOut();r.push('/login');r.refresh()
  }

  async function del(){
    if(confirmText!=='حذف')return
    if(!await appConfirm({
      title:'حذف الحساب نهائيًا',
      message:'هذا الإجراء نهائي وسيحذف الحساب وبياناته. هل تريد الاستمرار؟',
      confirmLabel:'حذف الحساب',
      danger:true
    }))return
    setBusy(true);setNotice('')
    const {data,error}=await s.functions.invoke('delete-account',{body:{}})
    if(error||!data?.deleted){
      const code=data?.error||''
      setNotice(code==='mfa_required'
        ?'يلزم إكمال التحقق بخطوتين قبل حذف الحساب.'
        :'تعذر حذف الحساب بالكامل الآن. لم يتم حذف الحساب جزئيًا؛ حاول مرة أخرى.')
      setBusy(false)
      return
    }
    await s.auth.signOut()
    r.push('/login');r.refresh()
  }

  return <AppShell><PageHeader title="التحكم"/><main className="space-y-4 p-4">
    {notice?<p className="rounded-2xl bg-[#EAF2FC] p-3 text-sm font-bold text-[#1560BD]">{notice}</p>:null}

    <Card><CardContent className="space-y-4">
      <h2 className="font-extrabold">تعديل الملف</h2>
      <Input value={name} onChange={e=>setName(e.target.value)} placeholder="الاسم الظاهر"/>
      <Textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="عنّي"/>
      <div><p className="mb-2 text-sm font-bold">مزاجي الآن</p><div className="flex flex-wrap gap-2">{moods.map(m=><button key={m} onClick={()=>setMood(m)} className={`tap-action rounded-full px-3 py-2 text-xs font-bold ${mood===m?'bg-[#1560BD] text-white':'bg-[#EAF2FC] text-[#1560BD]'}`}>{m}</button>)}</div></div>
      {[
        ['الظهور في اكتشف',discoverable,setDiscoverable],
        ['السماح بدعوات التعارف',allowInvites,setAllowInvites],
        ['إظهار العمر',showAge,setShowAge]
      ].map(([label,val,setter]:any)=><label key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold"><span>{label}</span><input type="checkbox" checked={val} onChange={e=>setter(e.target.checked)} className="h-5 w-5 accent-[#1560BD]"/></label>)}
      <Button className="w-full" onClick={save} disabled={busy}>حفظ التغييرات</Button>
    </CardContent></Card>

    <Card><CardContent>
      <h2 className="font-extrabold">شكل ملفي</h2>
      <p className="mt-1 text-xs text-slate-500">Classic مجاني، والثيمات الإضافية تُشترى مرة واحدة بالنجوم ثم يمكن تبديلها.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">{['classic','ocean','midnight','glass','spark'].map(t=><button key={t} disabled={busy} onClick={()=>t==='classic'||owned.includes(t)?activateTheme(t):buyTheme(t)} className={`tap-action ${theme===t?'rounded-2xl border-2 border-[#1560BD] bg-[#EAF2FC] p-3 text-sm font-extrabold text-[#1560BD]':'rounded-2xl border border-slate-200 p-3 text-sm font-bold'}`}>{t}{t!=='classic'&&!owned.includes(t)?' · شراء ⭐':''}</button>)}</div>
    </CardContent></Card>

    <Card><CardContent>
      <h2 className="font-extrabold">لفت الأنظار 🚀</h2>
      <p className="mt-1 text-xs text-slate-500">{boostUntil&&new Date(boostUntil)>new Date()?'Boost نشط حتى '+new Date(boostUntil).toLocaleString('ar-EG'):'زِد ظهور ملفك في الاكتشاف.'}</p>
      <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" disabled={busy} onClick={()=>boost('30m')}>Boost · 30 دقيقة</Button><Button variant="secondary" disabled={busy} onClick={()=>boost('2h')}>Boost · ساعتان</Button></div>
    </CardContent></Card>

    <Card><CardContent>
      <div className="flex items-center gap-2"><Mic className="text-[#1560BD]"/><h2 className="font-extrabold">مقدمتي الصوتية</h2></div>
      <p className="mt-1 text-xs text-slate-500">سجّل صوتك مباشرة من المايك. الحد الأقصى دقيقة واحدة.</p>
      <Input className="mt-3" value={audioTitle} onChange={e=>setAudioTitle(e.target.value)} placeholder="عنوان المقدمة — اختياري"/>

      {recording?<div className="mt-4 rounded-[22px] bg-red-50 p-4 text-center">
        <div className="mx-auto mb-2 h-4 w-4 animate-pulse rounded-full bg-red-500"/>
        <p className="font-black text-red-700">جاري التسجيل… {recordSecs} ثانية</p>
        <Button className="mt-3 w-full" variant="danger" onClick={stopRecording}><Square size={17}/>إيقاف التسجيل</Button>
      </div>:recordedUrl?<div className="mt-4 rounded-[22px] bg-[#F4F8FD] p-4">
        <p className="mb-2 text-sm font-black">معاينة التسجيل الجديد</p>
        <audio src={recordedUrl} controls className="w-full"/>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={resetRecording}><RotateCcw size={17}/>إعادة التسجيل</Button>
          <Button onClick={saveRecording} disabled={busy}>حفظ المقدمة</Button>
        </div>
      </div>:<>
        {currentAudioUrl?<div className="mt-4 rounded-[22px] bg-[#F4F8FD] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-black"><Volume2 size={17}/>المقدمة الحالية</div>
          <audio src={currentAudioUrl} controls className="w-full"/>
        </div>:null}
        <Button className="mt-4 w-full" onClick={startRecording} disabled={busy}><Mic size={18}/>{audioPath?'تسجيل مقدمة جديدة':'ابدأ التسجيل'}</Button>
      </>}

      {(audioPath||recordedBlob)&&!recording?<Button className="mt-2 w-full" variant="outline" onClick={deleteAudio} disabled={busy}><Trash2 size={17}/>حذف المقدمة الصوتية</Button>:null}
    </CardContent></Card>

    <Card><CardContent>
      <h2 className="font-extrabold">الحظر</h2>
      <div className="mt-3 space-y-2">{blocked.map((x:any)=><div key={x.blocked_id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"><span className="text-sm font-bold">{x.profiles?.display_name||'مستخدم محظور'}</span><Button size="sm" variant="outline" onClick={()=>unblock(x.blocked_id)}>إلغاء الحظر</Button></div>)}{!blocked.length&&<p className="text-sm text-slate-500">لا يوجد مستخدمون محظورون.</p>}</div>
    </CardContent></Card>

    <Button className="w-full" variant="outline" onClick={logout}>تسجيل الخروج</Button>

    <Card className="border-red-200"><CardContent className="space-y-3">
      <h2 className="font-extrabold text-red-700">حذف الحساب</h2>
      <p className="text-sm text-slate-500">اكتب كلمة «حذف» لتأكيد حذف الحساب نهائيًا.</p>
      <Input value={confirmText} onChange={e=>setConfirmText(e.target.value)} placeholder="حذف"/>
      <Button className="w-full" variant="danger" disabled={confirmText!=='حذف'} onClick={del}>حذف الحساب</Button>
    </CardContent></Card>
  </main></AppShell>
}
