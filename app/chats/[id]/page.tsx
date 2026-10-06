'use client'

import {use,useEffect,useMemo,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Gift,Phone,PhoneOff,Sparkles,Images,Timer,Gamepad2,RefreshCw,Video,UserRound} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {PageHeader} from '@/components/page-header'
import {Button} from '@/components/ui/button'
import {calculateStarTransferBreakdown,type ChatGiftItem} from '@/lib/chat-room'
import {fetchChatRoomSnapshot} from '@/lib/chat-room-data'
import {uploadConversationMedia} from '@/lib/chat-media'
import {subscribeChatMessages} from '@/lib/chat-room-realtime'
import {
  consentPrivatePhotos,
  fetchConversationPartnerIdentity,
  fetchConversationPrompt,
  fetchPrivatePhotoTools,
  insertChatTextMessage,
  requestSpeedIntro,
  sendConversationGift,
  startDuoChallenge,
  transferStarsInConversation,
} from '@/lib/chat-room-actions'
import {ChatGiftSheet,ChatPartnerSheet} from '@/components/chat-bottom-sheets'
import {ChatMessageList} from '@/components/chat-message-list'
import {ChatComposer} from '@/components/chat-composer'
import {useCallSession} from '@/components/call-session-provider'

export default function Chat({params}:{params:Promise<{id:string}>}){
  const {id}=use(params)
  const s=useMemo(()=>createClient(),[])
  const r=useRouter()
  const {activeCall,callLabel,startCall,endCall,restoreCall}=useCallSession()

  const [uid,setUid]=useState('')
  const [other,setOther]=useState<any>(null)
  const [messages,setMessages]=useState<any[]>([])
  const [body,setBody]=useState('')
  const [notice,setNotice]=useState('')
  const [giftItems,setChatGiftItems]=useState<ChatGiftItem[]>([])
  const [showGifts,setShowGifts]=useState(false)
  const [revealedImages,setRevealedImages]=useState<Set<string>>(new Set())
  const [socialOpen,setSocialOpen]=useState(false)
  const [privateStatus,setPrivateStatus]=useState<any>(null)
  const [privatePhotos,setPrivatePhotos]=useState<any[]>([])
  const [duo,setDuo]=useState<any>(null)
  const [speedSession,setSpeedSession]=useState<string|null>(null)
  const [prompt,setPrompt]=useState('')
  const [partner,setPartner]=useState<any>(null)
  const [showPartner,setShowPartner]=useState(false)
  const [transferStars,setTransferStars]=useState('')
  const [transferRef,setTransferRef]=useState(()=>crypto.randomUUID())
  const [copiedId,setCopiedId]=useState(false)
  const [mediaEnabled,setMediaEnabled]=useState(false)

  const fileInputRef=useRef<HTMLInputElement|null>(null)
  const callInThisChat=activeCall?.conversation_id===id

  async function load(){
    const {data:{user}}=await s.auth.getUser()
    if(!user){
      r.push('/login')
      return
    }

    setUid(user.id)

    const [snapshot,{data:mediaSettings}]=await Promise.all([
      fetchChatRoomSnapshot(s,id,user.id),
      s.from('app_media_settings').select('chat_media_uploads_enabled').eq('id',1).maybeSingle(),
    ])
    setMediaEnabled(mediaSettings?.chat_media_uploads_enabled===true)

    if(!snapshot.authorized){
      r.push('/chats')
      return
    }

    setOther(snapshot.other)
    setChatGiftItems(snapshot.gifts)
    if(snapshot.partner)setPartner(snapshot.partner)
    setMessages(snapshot.messages)
  }

  useEffect(()=>{
    void load()
    const ch=subscribeChatMessages(s,id,load)
    return()=>{s.removeChannel(ch)}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[id])

  async function refreshPartnerIdentity(){
    const row=await fetchConversationPartnerIdentity(s,id)
    if(row)setPartner(row)
  }

  useEffect(()=>{
    if(!uid)return
    void refreshPartnerIdentity()
    const timer=window.setInterval(()=>void refreshPartnerIdentity(),30000)
    return()=>window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[uid,id])

  async function copyPartnerId(){
    if(!partner?.public_user_id)return
    try{
      await navigator.clipboard.writeText(partner.public_user_id)
      setCopiedId(true)
      setTimeout(()=>setCopiedId(false),1400)
    }catch{
      setNotice('تعذر نسخ الـID.')
    }
  }

  async function sendStarsToPartner(){
    const amount=Number(transferStars)
    if(!Number.isInteger(amount)||amount<1)return

    const {error}=await transferStarsInConversation(s,id,amount,transferRef)
    if(error){
      setNotice(
        error.message.includes('promotional_stars_not_transferable')
          ?'النجوم الترويجية مخصصة للاستخدام داخل لمتنا ولا يمكن تحويلها لمستخدم آخر.'
          :error.message.includes('insufficient_stars')
            ?'رصيد النجوم غير كافٍ.'
            :'تعذر إرسال النجوم.'
      )
      return
    }

    const fee=Math.ceil(amount*0.15)
    setNotice(`تم إرسال ${amount} ⭐ — وصل للطرف الآخر ${amount-fee} ⭐ بعد عمولة التطبيق 15%.`)
    setTransferStars('')
    setTransferRef(crypto.randomUUID())
    setShowPartner(false)
    window.dispatchEvent(new Event('lammetna:wallet-change'))
  }

  async function loadSocialTools(){
    const target=other?.user_id
    if(!target)return
    setSocialOpen(true)
    const snapshot=await fetchPrivatePhotoTools(s,target)
    setPrivateStatus(snapshot.status)
    setPrivatePhotos(snapshot.photos)
  }

  async function privateConsent(){
    const target=other?.user_id
    if(!target)return
    const {data,error}=await consentPrivatePhotos(s,target)
    if(error)setNotice('تعذر تحديث الموافقة.')
    else{
      setNotice(data?'الموافقة متبادلة ويمكن عرض الصور الخاصة.':'تم تسجيل موافقتك وفي انتظار الطرف الآخر.')
      await loadSocialTools()
    }
  }

  async function speedIntro(){
    const target=other?.user_id
    if(!target)return
    const {data,error}=await requestSpeedIntro(s,target)
    if(error)setNotice('تعذر إرسال طلب دقيقة التعارف.')
    else{
      setSpeedSession(data)
      setNotice('تم إرسال طلب دقيقة التعارف للطرف الآخر.')
    }
  }

  async function startDuo(){
    const {data,error}=await startDuoChallenge(s,id)
    if(error)setNotice('تعذر بدء تحدي الثنائي.')
    else{
      setDuo(data)
      setNotice('بدأ تحدي الثنائي — 5 أسئلة بدون درجة توافق.')
    }
  }

  async function surprise(kind:'surprise'|'restart'){
    const {data,error}=await fetchConversationPrompt(s,id,kind)
    if(error)setNotice('تعذر تجهيز السؤال الآن.')
    else setPrompt(String(data||''))
  }

  async function send(){
    const text=body.trim()
    if(!text)return

    setBody('')
    const {data:row,error}=await insertChatTextMessage(s,id,uid,text)

    if(error){
      setNotice('لا يمكن إرسال الرسالة الآن.')
      setBody(text)
      return
    }

    if(row)setMessages(current=>current.some((x:any)=>x.id===row.id)?current:[...current,row])
  }

  async function sendGift(gift:ChatGiftItem){
    const targetId=other?.user_id
    if(!targetId)return

    setNotice('')
    const {error}=await sendConversationGift(s,id,targetId,gift)

    if(error){
      setNotice(
        error.message.includes('promotional_stars_not_transferable')
          ?'النجوم الترويجية لا تُستخدم في الهدايا التي تتحول إلى أرباح للمستلم.'
          :error.message.includes('insufficient_stars')
            ?'رصيد النجوم غير كافٍ لإرسال الهدية.'
            :'تعذر إرسال الهدية.'
      )
      return
    }

    setNotice(`تم إرسال ${gift.emoji} ${gift.name_ar}. يصل للطرف الآخر 85% من قيمة النجوم والمنصة تحتفظ بـ15%.`)
    setShowGifts(false)
    window.dispatchEvent(new Event('lammetna:wallet-change'))
    await load()
  }

  async function uploadMedia(file:File){
    setNotice('')
    if(!mediaEnabled){
      setNotice('إرسال الصور والفيديو متوقف مؤقتًا لحين تفعيل فحص المحتوى.')
      return
    }
    const result=await uploadConversationMedia(s,id,uid,file)

    if(!result.ok){
      if(result.code==='invalid_type')setNotice('المسموح صورة JPG/PNG/WEBP أو فيديو MP4/MOV/WEBM.')
      else if(result.code==='too_large')setNotice('حجم الملف يجب ألا يتجاوز 25MB.')
      else if(result.code==='duration_read')setNotice('تعذر قراءة مدة الفيديو.')
      else if(result.code==='too_long')setNotice('الفيديو يجب ألا يتجاوز 10 ثوانٍ.')
      else if(result.code==='upload')setNotice(result.isVideo?'تعذر رفع الفيديو.':'تعذر رفع الصورة.')
      else setNotice(result.isVideo?'تعذر إرسال الفيديو.':'تعذر إرسال الصورة.')
      return
    }

    setNotice(result.isVideo?'تم إرسال الفيديو.':'تم إرسال الصورة. ستظهر للطرف الآخر مموهة حتى يختار إظهارها.')
    await load()
  }

  function revealImage(messageId:string){
    setRevealedImages(current=>{
      const next=new Set(current)
      next.add(messageId)
      return next
    })
  }

  function hideImage(messageId:string){
    setRevealedImages(current=>{
      const next=new Set(current)
      next.delete(messageId)
      return next
    })
  }

  const {gross:transferGross,fee:transferFee,net:transferNet}=calculateStarTransferBreakdown(transferStars)

  return <AppShell>
    <PageHeader title={other?.profiles?.display_name||'الحوار'}/>

    <main className="flex min-h-[calc(100vh-160px)] flex-col p-4">
      <button onClick={()=>setShowPartner(true)} className="tap-action mb-3 flex items-center gap-3 rounded-[24px] bg-white p-3 text-right shadow-sm ring-1 ring-[#dfe9f5]">
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[#eaf3fb]">
          {partner?.avatar_url||other?.profiles?.avatar_url?<img src={partner?.avatar_url||other?.profiles?.avatar_url} alt="" className="h-full w-full object-cover"/>:<span className="grid h-full w-full place-items-center font-black text-[#1768f4]">{(partner?.display_name||other?.profiles?.display_name||'م')[0]}</span>}
          <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-white ${partner?.is_online?'bg-[#12d79d]':'bg-slate-400'}`}/>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-black">{partner?.display_name||other?.profiles?.display_name||'المستخدم'}</span>
          <span className={`mt-0.5 block text-[10px] font-black ${partner?.is_online?'text-[#159a70]':'text-[#7d8798]'}`}>{partner?.is_online?'متصل':'غير متصل'}</span>
        </span>
        <UserRound size={20} className="text-[#1768f4]"/>
      </button>

      <div className="mb-3">
        <p className="mb-2 truncate text-center text-xs font-bold text-[#1560BD]">{callInThisChat?callLabel:'المكالمات تبدأ فقط بعد قبول الطرف الآخر'}</p>
        {callInThisChat?<div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={()=>setShowGifts(true)}><Gift size={15}/> هدية</Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={restoreCall}><Phone size={15}/> فتح المكالمة</Button>
          <Button size="sm" variant="outline" className="gap-1 text-red-600" onClick={()=>void endCall()}><PhoneOff size={15}/> إنهاء</Button>
        </div>:<div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={()=>setShowGifts(true)}><Gift size={15}/> هدية</Button>
          <Button size="sm" variant="outline" className="gap-1" disabled={!!activeCall} onClick={()=>void startCall(id,'voice')}><Phone size={15}/> صوتي</Button>
          <Button size="sm" variant="outline" className="gap-1" disabled={!!activeCall} onClick={()=>void startCall(id,'video')}><Video size={15}/> فيديو</Button>
        </div>}
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2">
        <Button size="sm" variant="outline" onClick={loadSocialTools}><Images size={15}/> صور خاصة</Button>
        <Button size="sm" variant="outline" onClick={speedIntro}><Timer size={15}/> دقيقة تعارف</Button>
        <Button size="sm" variant="outline" onClick={startDuo}><Gamepad2 size={15}/> تحدي</Button>
        <Button size="sm" variant="outline" onClick={()=>surprise('surprise')}><Sparkles size={15}/> مفاجأة</Button>
      </div>

      {prompt?<div className="mb-3 rounded-2xl border border-[#DCE8F7] bg-[#EAF2FC] p-3"><p className="text-xs font-bold text-[#1560BD]">اقتراح للكلام</p><p className="mt-1 text-sm font-extrabold">{prompt}</p><Button className="mt-2" size="sm" variant="secondary" onClick={()=>surprise('restart')}><RefreshCw size={14}/> اقتراح آخر</Button></div>:null}
      {socialOpen?<div className="mb-3 rounded-3xl border border-[#DCE8F7] bg-white p-3"><div className="flex items-center justify-between"><div><p className="font-extrabold">الصور الخاصة</p><p className="text-xs text-slate-500">لا تظهر إلا بعد موافقة الطرفين.</p></div><Button size="sm" onClick={privateConsent} disabled={privateStatus?.mutual}>{privateStatus?.mutual?'الموافقة متبادلة ✓':privateStatus?.my_consented?'في انتظار الطرف الآخر':'أوافق على المشاركة'}</Button></div>{privatePhotos.length?<div className="mt-3 grid grid-cols-3 gap-2">{privatePhotos.map((p:any)=><div key={p.photo_id} className="grid aspect-square place-items-center rounded-2xl bg-[#EAF2FC] text-xs font-bold text-[#1560BD]">صورة خاصة ✓</div>)}</div>:<p className="mt-3 text-xs text-slate-500">{privateStatus?.target_has_photos?'لديه صور خاصة؛ ستظهر بعد اكتمال الموافقة.':'لا توجد صور خاصة متاحة حاليًا.'}</p>}</div>:null}
      {duo?<div className="mb-3 rounded-2xl bg-[#F4F8FD] p-3 text-sm font-bold">تحدي الثنائي نشط 🎮 — أجبوا عن 5 أسئلة للتعارف، بدون تقييم أو نسبة توافق.</div>:null}
      {speedSession?<div className="mb-3 rounded-2xl bg-[#F4F8FD] p-3 text-sm font-bold">طلب دقيقة التعارف مرسل ⏱️ — يبدأ فقط بعد موافقة الطرف الآخر.</div>:null}

      {notice?<p className="mb-3 rounded-2xl bg-slate-100 p-3 text-xs font-bold text-slate-600">{notice}</p>:null}

      <ChatMessageList
        messages={messages}
        uid={uid}
        revealedImages={revealedImages}
        onRevealImage={revealImage}
        onHideImage={hideImage}
      />

      <ChatComposer
        fileInputRef={fileInputRef}
        body={body}
        onBodyChange={setBody}
        onSend={send}
        onOpenGifts={()=>setShowGifts(true)}
        onMediaFile={uploadMedia}
        mediaEnabled={mediaEnabled}
      />
    </main>

    <ChatPartnerSheet
      open={showPartner}
      partner={partner}
      copiedId={copiedId}
      transferStars={transferStars}
      transferGross={transferGross}
      transferFee={transferFee}
      transferNet={transferNet}
      onClose={()=>setShowPartner(false)}
      onCopy={copyPartnerId}
      onChangeTransfer={setTransferStars}
      onSendStars={sendStarsToPartner}
    />

    <ChatGiftSheet
      open={showGifts}
      gifts={giftItems}
      onClose={()=>setShowGifts(false)}
      onSend={sendGift}
    />
  </AppShell>
}
