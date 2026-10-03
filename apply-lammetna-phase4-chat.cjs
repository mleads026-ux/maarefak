const fs=require('fs'),path=require('path');const f=path.join(process.cwd(),'app','chats','[id]','page.tsx');if(!fs.existsSync(f))throw Error('chat page not found');let s=fs.readFileSync(f,'utf8');
s=s.replace("import { Gift, ImagePlus, Phone, PhoneOff, Send, X } from 'lucide-react'","import { Gift, ImagePlus, Phone, PhoneOff, Send, X, Sparkles, Images, Timer, Gamepad2, RefreshCw } from 'lucide-react'");
s=s.replace("const [revealedImages, setRevealedImages] = useState<Set<string>>(new Set())",`const [revealedImages, setRevealedImages] = useState<Set<string>>(new Set())
  const [socialOpen,setSocialOpen]=useState(false)
  const [privateStatus,setPrivateStatus]=useState<any>(null)
  const [privatePhotos,setPrivatePhotos]=useState<any[]>([])
  const [duo,setDuo]=useState<any>(null)
  const [speedSession,setSpeedSession]=useState<string|null>(null)
  const [prompt,setPrompt]=useState('')`);
s=s.replace("  async function send() {",`  async function loadSocialTools(){
    const target=other?.user_id;if(!target)return;setSocialOpen(true)
    const {data}=await s.rpc('private_photo_reveal_status',{p_target:target});setPrivateStatus(Array.isArray(data)?data[0]:data)
    const {data:photos}=await s.rpc('mutually_revealed_private_photos',{p_target:target});setPrivatePhotos(photos||[])
  }
  async function privateConsent(){const target=other?.user_id;if(!target)return;const {data,error}=await s.rpc('set_private_photo_reveal_consent',{p_target:target,p_consent:true});if(error)setNotice('تعذر تحديث الموافقة.');else{setNotice(data?'الموافقة متبادلة ويمكن عرض الصور الخاصة.':'تم تسجيل موافقتك وفي انتظار الطرف الآخر.');await loadSocialTools()}}
  async function speedIntro(){const target=other?.user_id;if(!target)return;const {data,error}=await s.rpc('request_speed_intro',{p_target:target});if(error)setNotice('تعذر إرسال طلب دقيقة التعارف.');else{setSpeedSession(data);setNotice('تم إرسال طلب دقيقة التعارف للطرف الآخر.')}}
  async function startDuo(){const {data,error}=await s.rpc('start_duo_challenge_v2',{p_conversation:id});if(error)setNotice('تعذر بدء تحدي الثنائي.');else{setDuo(data);setNotice('بدأ تحدي الثنائي — 5 أسئلة بدون درجة توافق.')}}
  async function surprise(kind:'surprise'|'restart'){const fn=kind==='surprise'?'conversation_surprise_prompt':'smart_restart_prompt';const {data,error}=await s.rpc(fn,{p_conversation:id});if(error)setNotice('تعذر تجهيز السؤال الآن.');else setPrompt(String(data||''))}
  async function send() {`);
s=s.replace('<div className="mb-3 flex items-center justify-between gap-2">','<div className="mb-3 flex items-center justify-between gap-2">');
s=s.replace('{showGifts ? (',`<div className="mb-3 grid grid-cols-4 gap-2">
          <Button size="sm" variant="outline" onClick={loadSocialTools}><Images size={15}/> صور خاصة</Button>
          <Button size="sm" variant="outline" onClick={speedIntro}><Timer size={15}/> دقيقة تعارف</Button>
          <Button size="sm" variant="outline" onClick={startDuo}><Gamepad2 size={15}/> تحدي</Button>
          <Button size="sm" variant="outline" onClick={()=>surprise('surprise')}><Sparkles size={15}/> مفاجأة</Button>
        </div>
        {prompt?<div className="mb-3 rounded-2xl border border-[#DCE8F7] bg-[#EAF2FC] p-3"><p className="text-xs font-bold text-[#1560BD]">اقتراح للكلام</p><p className="mt-1 text-sm font-extrabold">{prompt}</p><Button className="mt-2" size="sm" variant="secondary" onClick={()=>surprise('restart')}><RefreshCw size={14}/> اقتراح آخر</Button></div>:null}
        {socialOpen?<div className="mb-3 rounded-3xl border border-[#DCE8F7] bg-white p-3"><div className="flex items-center justify-between"><div><p className="font-extrabold">الصور الخاصة</p><p className="text-xs text-slate-500">لا تظهر إلا بعد موافقة الطرفين.</p></div><Button size="sm" onClick={privateConsent} disabled={privateStatus?.mutual}>{privateStatus?.mutual?'الموافقة متبادلة ✓':privateStatus?.my_consented?'في انتظار الطرف الآخر':'أوافق على المشاركة'}</Button></div>{privatePhotos.length?<div className="mt-3 grid grid-cols-3 gap-2">{privatePhotos.map((p:any)=><div key={p.photo_id} className="grid aspect-square place-items-center rounded-2xl bg-[#EAF2FC] text-xs font-bold text-[#1560BD]">صورة خاصة ✓</div>)}</div>:<p className="mt-3 text-xs text-slate-500">{privateStatus?.target_has_photos?'لديه صور خاصة؛ ستظهر بعد اكتمال الموافقة.':'لا توجد صور خاصة متاحة حاليًا.'}</p>}</div>:null}
        {duo?<div className="mb-3 rounded-2xl bg-[#F4F8FD] p-3 text-sm font-bold">تحدي الثنائي نشط 🎮 — أجبوا عن 5 أسئلة للتعارف، بدون تقييم أو نسبة توافق.</div>:null}
        {speedSession?<div className="mb-3 rounded-2xl bg-[#F4F8FD] p-3 text-sm font-bold">طلب دقيقة التعارف مرسل ⏱️ — يبدأ فقط بعد موافقة الطرف الآخر.</div>:null}
        {showGifts ? (`);
s=s.replaceAll('#006B57','#1560BD').replaceAll('#CDECE3','#D7E7FB').replaceAll('#E7F5F1','#EAF2FC');
fs.writeFileSync(f,s,'utf8');console.log('Phase 4 Chat parity applied.');console.log('Run: npm run build');