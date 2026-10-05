'use client'

import { use, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gift, ImagePlus, Phone, PhoneOff, Send, X, Sparkles, Images, Timer, Gamepad2, RefreshCw, Video, Copy, Star, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AppShell } from '@/components/app-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {calculateStarTransferBreakdown,type ChatCallRow,type ChatGiftItem} from '@/lib/chat-room'
import {fetchChatRoomSnapshot} from '@/lib/chat-room-data'
import {subscribeChatCalls,subscribeChatMessages} from '@/lib/chat-room-realtime'
import {
  consentPrivatePhotos,
  endConversationCall,
  fetchConversationPartnerIdentity,
  fetchConversationPrompt,
  fetchPrivatePhotoTools,
  insertChatTextMessage,
  requestConversationCall,
  requestSpeedIntro,
  respondConversationCall,
  sendConversationGift,
  startDuoChallenge,
  transferStarsToPublicUser,
} from '@/lib/chat-room-actions'
import {ChatGiftSheet,ChatPartnerSheet} from '@/components/chat-bottom-sheets'
import {ChatMessageList} from '@/components/chat-message-list'
import {ChatComposer} from '@/components/chat-composer'
import {useChatWebRtc} from '@/hooks/use-chat-webrtc'

export default function Chat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const s = useMemo(() => createClient(), [])
  const r = useRouter()

  const [uid, setUid] = useState('')
  const [other, setOther] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [body, setBody] = useState('')
  const [notice, setNotice] = useState('')
  const [incomingCall, setIncomingCall] = useState<ChatCallRow | null>(null)
  const [activeCall, setActiveCall] = useState<ChatCallRow | null>(null)
  const [callLabel, setCallLabel] = useState('')
  const [giftItems, setChatGiftItems] = useState<ChatGiftItem[]>([])
  const [showGifts, setShowGifts] = useState(false)
  const [revealedImages, setRevealedImages] = useState<Set<string>>(new Set())
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

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const {
    remoteAudioRef,
    localVideoRef,
    remoteVideoRef,
    cleanupPeer,
  }=useChatWebRtc({
    s,
    uid,
    activeCall,
    setNotice,
  })

  async function load() {
    const { data: { user } } = await s.auth.getUser()

    if (!user) {
      r.push('/login')
      return
    }

    setUid(user.id)

    const snapshot=await fetchChatRoomSnapshot(s,id,user.id)
    if(!snapshot.authorized){
      r.push('/chats')
      return
    }

    setOther(snapshot.other)
    setChatGiftItems(snapshot.gifts)
    if(snapshot.partner)setPartner(snapshot.partner)
    setMessages(snapshot.messages)

    const call=snapshot.call
    if(call){
      if(call.status==='ringing'&&call.callee_id===user.id){
        setIncomingCall(call)
      }else{
        setActiveCall(call)
        setCallLabel(
          call.status==='ringing'
            ? 'جارٍ انتظار موافقة الطرف الآخر...'
            : 'المكالمة متصلة'
        )
      }
    }
  }

  useEffect(() => {
    load()
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
    refreshPartnerIdentity()
    const timer=window.setInterval(refreshPartnerIdentity,30000)
    return()=>window.clearInterval(timer)
  },[uid,id])

  useEffect(()=>{
    if(!uid)return
    const ch=subscribeChatCalls(s,id,uid,handleChatCallRow)
    return()=>{s.removeChannel(ch)}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[uid,id])

  function handleChatCallRow(row: ChatCallRow) {
    if (row.caller_id !== uid && row.callee_id !== uid) return

    if (row.status === 'ringing') {
      if (row.callee_id === uid) {
        setIncomingCall(row)
      } else {
        setActiveCall(row)
        setCallLabel(row.call_kind==='video'?'جارٍ انتظار موافقة الطرف الآخر على الفيديو...':'جارٍ انتظار موافقة الطرف الآخر على المكالمة الصوتية...')
      }
      return
    }

    if (row.status === 'accepted') {
      setIncomingCall(null)
      setActiveCall(row)
      setCallLabel(row.call_kind==='video'?'مكالمة الفيديو متصلة':'المكالمة الصوتية متصلة')
      return
    }

    if (row.status === 'rejected') {
      cleanupPeer()
      setIncomingCall(null)
      setActiveCall(null)
      setCallLabel('')
      setNotice('تم رفض المكالمة.')
      return
    }

    if (row.status === 'ended' || row.status === 'missed') {
      cleanupPeer()
      setIncomingCall(null)
      setActiveCall(null)
      setCallLabel('')
      setNotice(row.status === 'missed' ? 'لم يتم الرد على المكالمة.' : 'انتهت المكالمة.')
    }
  }


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
    if(!partner?.public_user_id||!Number.isInteger(amount)||amount<1)return
    const {error}=await transferStarsToPublicUser(
      s,
      partner.public_user_id,
      amount,
      transferRef
    )
    if(error){
      setNotice(error.message.includes('insufficient_stars')?'رصيد النجوم غير كافٍ.':'تعذر إرسال النجوم.')
      return
    }
    const fee=Math.ceil(amount*0.15)
    setNotice(`تم إرسال ${amount} ⭐ — وصل للطرف الآخر ${amount-fee} ⭐ بعد عمولة التطبيق 15%.`)
    setTransferStars('')
    setTransferRef(crypto.randomUUID())
    setShowPartner(false)
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
  async function send() {
    const text = body.trim()
    if (!text) return

    setBody('')

    const {data:row,error}=await insertChatTextMessage(s,id,uid,text)

    if (error) {
      setNotice('لا يمكن إرسال الرسالة الآن.')
      setBody(text)
      return
    }

    if(row){
      setMessages(current=>current.some((x:any)=>x.id===row.id)?current:[...current,row])
    }
  }

  async function sendGift(gift: ChatGiftItem) {
    const targetId = other?.user_id
    if (!targetId) return

    setNotice('')

    const {error}=await sendConversationGift(s,id,targetId,gift)

    if (error) {
      setNotice(
        error.message.includes('insufficient_stars')
          ? 'رصيد النجوم غير كافٍ لإرسال الهدية.'
          : 'تعذر إرسال الهدية.'
      )
      return
    }

    setNotice(
      `تم إرسال ${gift.emoji} ${gift.name_ar}. يصل للطرف الآخر 85% من قيمة النجوم والمنصة تحتفظ بـ15%.`
    )
    setShowGifts(false)
    await load()
  }

  async function startCall(kind:'voice'|'video') {
    setNotice('')

    const {error,row}=await requestConversationCall(s,id,kind)

    if (error) {
      setNotice(kind==='video'?'تعذر بدء مكالمة الفيديو الآن.':'تعذر بدء المكالمة الصوتية الآن.')
      return
    }

    if (row) {
      setActiveCall(row as ChatCallRow)
      setCallLabel(kind==='video'?'جارٍ انتظار موافقة الطرف الآخر على الفيديو...':'جارٍ انتظار موافقة الطرف الآخر على المكالمة الصوتية...')
    }
  }

  async function respondToCall(accept: boolean) {
    if (!incomingCall) return

    const row=await respondConversationCall(s,incomingCall.id,accept)

    if (!accept) {
      setIncomingCall(null)
      return
    }

    if (row) {
      setIncomingCall(null)
      setActiveCall(row as ChatCallRow)
      setCallLabel((row as ChatCallRow).call_kind==='video'?'مكالمة الفيديو متصلة':'المكالمة الصوتية متصلة')
    }
  }

  async function endCall() {
    if (!activeCall) return

    await endConversationCall(s,activeCall.id)

    cleanupPeer()
    setActiveCall(null)
    setCallLabel('')
  }

  async function readVideoDuration(file:File){
    return await new Promise<number>((resolve,reject)=>{
      const url=URL.createObjectURL(file)
      const video=document.createElement('video')
      video.preload='metadata'
      video.onloadedmetadata=()=>{
        const duration=Number(video.duration||0)
        URL.revokeObjectURL(url)
        resolve(duration)
      }
      video.onerror=()=>{
        URL.revokeObjectURL(url)
        reject(new Error('invalid_video'))
      }
      video.src=url
    })
  }

  async function uploadMedia(file: File) {
    setNotice('')

    const imageTypes=['image/jpeg','image/png','image/webp']
    const videoTypes=['video/mp4','video/webm','video/quicktime']
    const isImage=imageTypes.includes(file.type)
    const isVideo=videoTypes.includes(file.type)

    if(!isImage&&!isVideo){
      setNotice('المسموح صورة JPG/PNG/WEBP أو فيديو MP4/MOV/WEBM.')
      return
    }

    if(file.size>25*1024*1024){
      setNotice('حجم الملف يجب ألا يتجاوز 25MB.')
      return
    }

    let duration:number|null=null
    if(isVideo){
      try{duration=await readVideoDuration(file)}catch{
        setNotice('تعذر قراءة مدة الفيديو.')
        return
      }
      if(!duration||duration>10.05){
        setNotice('الفيديو يجب ألا يتجاوز 10 ثوانٍ.')
        return
      }
    }

    const ext=file.name.split('.').pop()?.toLowerCase()||(isVideo?'mp4':'jpg')
    const path=`${id}/${uid}/${crypto.randomUUID()}.${ext}`

    const {error:uploadError}=await s.storage
      .from('chat-media-approved')
      .upload(path,file,{upsert:false,contentType:file.type})

    if(uploadError){
      setNotice(isVideo?'تعذر رفع الفيديو.':'تعذر رفع الصورة.')
      return
    }

    const {error}=await s.rpc('create_media_message',{
      p_conversation:id,
      p_media_path:path,
      p_kind:isVideo?'video':'image',
      p_duration_seconds:duration,
    })

    if(error){
      setNotice(isVideo?'تعذر إرسال الفيديو.':'تعذر إرسال الصورة.')
      return
    }

    setNotice(isVideo?'تم إرسال الفيديو.':'تم إرسال الصورة. ستظهر للطرف الآخر مموهة حتى يختار إظهارها.')
    await load()
  }

  const visibleMessages = messages

  function revealImage(messageId: string) {
    setRevealedImages((current) => {
      const next = new Set(current)
      next.add(messageId)
      return next
    })
  }

  function hideImage(messageId: string) {
    setRevealedImages((current) => {
      const next = new Set(current)
      next.delete(messageId)
      return next
    })
  }

  const {
    gross:transferGross,
    fee:transferFee,
    net:transferNet,
  }=calculateStarTransferBreakdown(transferStars)

  return (
    <AppShell>
      <PageHeader title={other?.profiles?.display_name || 'الحوار'} />

      <audio ref={remoteAudioRef} autoPlay />

      {activeCall?.status==='accepted'&&activeCall.call_kind==='video'?<div className="fixed inset-0 z-[160] bg-[#07111f]">
        <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover"/>
        <video ref={localVideoRef} autoPlay playsInline muted className="absolute right-4 top-[max(24px,env(safe-area-inset-top))] h-40 w-28 rounded-[22px] border-2 border-white/70 bg-black object-cover shadow-2xl"/>
        <div className="absolute bottom-[max(38px,env(safe-area-inset-bottom))] left-0 right-0 flex justify-center">
          <button onClick={endCall} className="tap-action flex items-center gap-2 rounded-full bg-[#ef3356] px-6 py-3 text-sm font-black text-white"><PhoneOff size={19}/> إنهاء الفيديو</button>
        </div>
      </div>:null}

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
          <p className="mb-2 truncate text-center text-xs font-bold text-[#1560BD]">{callLabel || 'المكالمات تبدأ فقط بعد قبول الطرف الآخر'}</p>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={()=>setShowGifts(true)}><Gift size={15}/> هدية</Button>
            {activeCall
              ? <Button size="sm" variant="outline" className="gap-1 text-red-600" onClick={endCall}><PhoneOff size={15}/> إنهاء</Button>
              : <Button size="sm" variant="outline" className="gap-1" onClick={()=>startCall('voice')}><Phone size={15}/> صوتي</Button>}
            {!activeCall
              ? <Button size="sm" variant="outline" className="gap-1" onClick={()=>startCall('video')}><Video size={15}/> فيديو</Button>
              : <Button size="sm" variant="outline" disabled className="gap-1"><Video size={15}/> فيديو</Button>}
          </div>
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
        {incomingCall ? (
          <div className="mb-4 rounded-3xl border border-[#D7E7FB] bg-[#EAF2FC] p-4">
            <p className="flex items-center gap-2 font-extrabold">
              {incomingCall.call_kind==='video'?<Video size={18}/>:<Phone size={18}/>}
              {other?.profiles?.display_name || 'الطرف الآخر'} يتصل بك {incomingCall.call_kind==='video'?'بالفيديو':'صوتيًا'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              لن تبدأ المكالمة إلا بعد موافقتك.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button onClick={() => respondToCall(true)}>
                <Phone size={16} className="ml-2" />
                قبول
              </Button>

              <Button
                variant="outline"
                onClick={() => respondToCall(false)}
              >
                <X size={16} className="ml-2" />
                رفض
              </Button>
            </div>
          </div>
        ) : null}

        {notice ? (
          <p className="mb-3 rounded-2xl bg-slate-100 p-3 text-xs font-bold text-slate-600">
            {notice}
          </p>
        ) : null}

        <ChatMessageList
          messages={visibleMessages}
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
  )
}
