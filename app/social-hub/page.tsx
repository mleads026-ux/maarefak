'use client'
import Link from 'next/link'
import {useEffect,useMemo,useRef,useState} from 'react'
import {Camera,Heart,MessageCircle,Share2,MapPin,UserRound,MoreHorizontal,Play,X,ImagePlus,Send,Trash2,Ban,Flag} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {BrandLogo} from '@/components/brand-logo'
import {appConfirm,appPrompt} from '@/components/interaction-dialog'

const TOPICS=['الكل','💗 حب','✨ جمال','✈️ سفر','☕ قهوة','👥 تعارف','# تقنية']

export default function SocialHub(){
  const s=useMemo(()=>createClient(),[])
  const picker=useRef<HTMLInputElement>(null)
  const [uid,setUid]=useState('')
  const [visitors,setVisitors]=useState<any[]>([])
  const [count,setCount]=useState(0)
  const [q,setQ]=useState<any>(null)
  const [answer,setAnswer]=useState('')
  const [missions,setMissions]=useState<any[]>([])
  const [status,setStatus]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [profile,setProfile]=useState<any>(null)
  const [posts,setPosts]=useState<any[]>([])
  const [topic,setTopic]=useState('الكل')
  const [showComposer,setShowComposer]=useState(false)
  const [postBody,setPostBody]=useState('')
  const [postTopic,setPostTopic]=useState('👥 تعارف')
  const [media,setMedia]=useState<File|null>(null)
  const [mediaPreview,setMediaPreview]=useState('')
  const [viewer,setViewer]=useState<{url:string;type:string}|null>(null)
  const [commentsPost,setCommentsPost]=useState<any>(null)
  const [comment,setComment]=useState('')
  const [menuPost,setMenuPost]=useState<any>(null)
  const [visitorCost,setVisitorCost]=useState<number|null>(null)
  const [greetingCost,setGreetingCost]=useState<number|null>(null)
  const [imageUploadsEnabled,setImageUploadsEnabled]=useState(false)

  async function load(){
    setBusy(true)
    const {data:{user}}=await s.auth.getUser()
    if(!user){setBusy(false);return}
    setUid(user.id)
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
    const [v,c,dq,da,md,mc,mcOnce,p,sp,fp,gp,mediaSafety]=await Promise.all([
      s.rpc('get_my_profile_visitors',{p_limit:20}),
      s.rpc('my_profile_visitor_count'),
      s.from('daily_questions').select('id,question_ar').eq('active',true).eq('active_date',today).maybeSingle(),
      s.from('daily_answers').select('question_id,answer,highlighted_until').eq('user_id',user.id),
      s.from('daily_mission_definitions').select('code,title_ar,description_ar,reward_stars').eq('active',true),
      s.from('daily_mission_claims').select('mission_code,reward_stars').eq('user_id',user.id).eq('claim_date',today),
      s.from('daily_mission_claims').select('mission_code').eq('user_id',user.id).eq('mission_code','complete_profile').limit(1),
      s.from('profiles').select('id,display_name,avatar_url,cities(name_ar),birth_date,show_age,is_online').eq('id',user.id).single(),
      s.from('social_posts').select('id,user_id,body,media_url,media_path,media_type,topic,created_at').order('created_at',{ascending:false}).limit(40),
      s.from('feature_prices').select('price_stars').eq('key','profile_visitors_24h').eq('enabled',true).maybeSingle(),
      s.from('feature_prices').select('price_stars').eq('key','attention_ping').eq('enabled',true).maybeSingle(),
      s.from('app_media_settings').select('social_image_uploads_enabled').eq('id',1).maybeSingle(),
    ])
    setVisitors(v.data||[])
    setCount(Number(c.data||0))
    setQ(dq.data||null)
    setAnswer((da.data||[]).find((x:any)=>x.question_id===dq.data?.id)?.answer||'')
    const missionOrder:Record<string,number>={complete_profile:0,answer_daily:1,join_lamma:2,send_message:3}
    setMissions((md.data||[])
      .map((x:any)=>({
        ...x,
        claimed:(mc.data||[]).some((y:any)=>y.mission_code===x.code)
          ||(x.code==='complete_profile'&&(mcOnce.data||[]).some((y:any)=>y.mission_code==='complete_profile'))
      }))
      .sort((a:any,b:any)=>(missionOrder[a.code]??99)-(missionOrder[b.code]??99)))
    setProfile(p.data||null)
    setVisitorCost(fp.data?.price_stars==null?null:Number(fp.data.price_stars))
    setGreetingCost(gp.data?.price_stars==null?null:Number(gp.data.price_stars))
    setImageUploadsEnabled(mediaSafety.data?.social_image_uploads_enabled===true)

    const raw=sp.data||[]
    if(raw.length){
      const ids=raw.map((x:any)=>x.id)
      const userIds=[...new Set(raw.map((x:any)=>x.user_id))]
      const mediaPaths=[...new Set(raw.map((x:any)=>x.media_path).filter(Boolean))]
      const [{data:ps},{data:likes},{data:comments},signedResult]=await Promise.all([
        s.from('profiles').select('id,display_name,avatar_url,cities(name_ar),is_online').in('id',userIds),
        s.from('social_post_likes').select('post_id,user_id').in('post_id',ids),
        s.from('social_post_comments').select('id,post_id,user_id,body,created_at').in('post_id',ids).order('created_at',{ascending:true}),
        mediaPaths.length
          ? s.storage.from('social-media').createSignedUrls(mediaPaths as string[],600)
          : Promise.resolve({data:[],error:null}),
      ])
      const pmap=Object.fromEntries((ps||[]).map((x:any)=>[x.id,x]))
      const signedMap=Object.fromEntries(
        (signedResult.data||[])
          .filter((x:any)=>x.path&&x.signedUrl)
          .map((x:any)=>[x.path,x.signedUrl])
      )
      const commentUsers=[...new Set((comments||[]).map((x:any)=>x.user_id))]
      let cmap:any={}
      if(commentUsers.length){
        const {data:cp}=await s.from('profiles').select('id,display_name,avatar_url').in('id',commentUsers)
        cmap=Object.fromEntries((cp||[]).map((x:any)=>[x.id,x]))
      }
      setPosts(raw.map((x:any)=>({
        ...x,
        media_display_url:x.media_path?(signedMap[x.media_path]||null):x.media_url,
        profile:pmap[x.user_id],
        likes:(likes||[]).filter((l:any)=>l.post_id===x.id),
        comments:(comments||[]).filter((cm:any)=>cm.post_id===x.id).map((cm:any)=>({...cm,profile:cmap[cm.user_id]}))
      })))
    }else setPosts([])
    setBusy(false)
  }

  useEffect(()=>{load()},[])

  useEffect(()=>{
    if(!media){setMediaPreview('');return}
    const u=URL.createObjectURL(media);setMediaPreview(u)
    return()=>URL.revokeObjectURL(u)
  },[media])

  async function saveAnswer(){
    const text=answer.trim()
    if(!q||!text||!uid)return
    setBusy(true);setNotice('')
    const {error:answerError}=await s.rpc('answer_daily_question',{p_question:q.id,p_answer:text})
    if(answerError){setNotice('تعذر حفظ الإجابة.');setBusy(false);return}
    const {error:postError}=await s.from('social_posts').upsert({
      user_id:uid,
      daily_question_id:q.id,
      body:`${q.question_ar}\n\n${text}`,
      media_url:null,
      media_type:null,
      topic:'👥 تعارف'
    },{onConflict:'user_id,daily_question_id'})
    if(postError){setNotice('تم حفظ الإجابة لكن تعذر نشرها كسالفة.');setBusy(false);return}
    setNotice('تم نشر إجابتك كسالفة ✨')
    await load()
  }

  async function claim(code:string){
    setBusy(true)
    const {data,error}=await s.rpc('claim_daily_mission',{p_code:code})
    setNotice(error?'تعذر التنفيذ.':`تم استلام ${Number(data||0)} نجمة ترويجية ⭐ للاستخدام داخل لمتنا.`)
    await load()
  }

  async function social(){
    if(!status.trim())return
    setBusy(true)
    const {error}=await s.rpc('set_social_status',{p_status:status.trim(),p_hours:24})
    setNotice(error?'تعذر النشر.':'تم نشر حالتك لمدة 24 ساعة.')
    setStatus('');setBusy(false)
  }

  async function publishPost(){
    if((!postBody.trim()&&!media)||!uid)return
    setBusy(true);setNotice('')
    let mediaUrl:string|null=null,mediaType:string|null=null
    if(media){
      if(!imageUploadsEnabled){setNotice('رفع الصور في سوالف متوقف مؤقتًا لحين تفعيل فحص المحتوى.');setBusy(false);return}
      const allowed=['image/jpeg','image/png','image/webp']
      if(!allowed.includes(media.type)){setNotice('السوالف تقبل صور JPG أو PNG أو WebP فقط.');setBusy(false);return}
      const ext=(media.name.split('.').pop()||'jpg').toLowerCase()
      const path=`${uid}/${crypto.randomUUID()}.${ext}`
      const up=await s.storage.from('social-media').upload(path,media,{contentType:media.type,upsert:false})
      if(up.error){setNotice('تعذر رفع الصورة.');setBusy(false);return}
      mediaUrl=s.storage.from('social-media').getPublicUrl(path).data.publicUrl
      mediaType='image'
    }
    const mediaPath=media?mediaUrl?.split('/storage/v1/object/public/social-media/')[1]||null:null
    const {error}=await s.from('social_posts').insert({
      user_id:uid,
      body:postBody.trim()||null,
      media_url:mediaUrl,
      media_path:mediaPath,
      media_type:mediaType,
      topic:postTopic
    })
    if(error){
      if(mediaPath)await s.storage.from('social-media').remove([mediaPath]).catch(()=>{})
      setNotice('تعذر نشر السالفة الآن.');setBusy(false);return
    }
    setPostBody('');setMedia(null);setShowComposer(false);setNotice('تم نشر سالفتك ✨')
    await load()
  }

  async function toggleLike(post:any){
    if(!uid)return
    const liked=post.likes.some((x:any)=>x.user_id===uid)
    setPosts(v=>v.map(p=>p.id===post.id?{...p,likes:liked?p.likes.filter((x:any)=>x.user_id!==uid):[...p.likes,{post_id:p.id,user_id:uid}]}:p))
    const op=liked
      ? s.from('social_post_likes').delete().eq('post_id',post.id).eq('user_id',uid)
      : s.from('social_post_likes').insert({post_id:post.id,user_id:uid})
    const {error}=await op
    if(error){setNotice('تعذر تحديث الإعجاب.');await load()}
  }

  async function addComment(){
    if(!commentsPost||!comment.trim()||!uid)return
    setBusy(true)
    const {error}=await s.from('social_post_comments').insert({post_id:commentsPost.id,user_id:uid,body:comment.trim()})
    setComment('')
    if(error)setNotice('تعذر إضافة التعليق.')
    else await load()
    setBusy(false)
  }

  async function share(post:any){
    const text=[post.profile?.display_name||'لمتنا',post.body||'سالفة جديدة على لمتنا'].join(' — ')
    const url=`${location.origin}/social-hub?post=${post.id}`
    try{
      if(navigator.share)await navigator.share({title:'لمتنا',text,url})
      else {await navigator.clipboard.writeText(url);setNotice('تم نسخ رابط السالفة.')}
    }catch{}
  }

  async function greet(target:string){
    if(!target||target===uid)return
    if(greetingCost==null){setNotice('ميزة التحية غير متاحة الآن.');return}
    if(!await appConfirm({
      title:'إرسال تحية 💗',
      message:`سيتم لفت انتباه هذا الشخص مقابل ${greetingCost} نجمة.`,
      confirmLabel:'إرسال التحية'
    }))return
    setBusy(true)
    const {error}=await s.rpc('send_attention_ping',{p_target:target})
    setNotice(error?(error.message.includes('insufficient_stars')?'رصيد النجوم غير كافٍ.':'تعذر إرسال التحية الآن.'):'تم إرسال التحية 💗')
    setBusy(false)
  }

  async function deletePost(post:any){
    if(!await appConfirm({
      title:'حذف السالفة',
      message:'سيتم حذف هذه السالفة نهائيًا.',
      confirmLabel:'حذف',
      danger:true
    }))return
    if(post.media_path){
      const {error:mediaError}=await s.storage.from('social-media').remove([post.media_path])
      if(mediaError){
        setNotice('تعذر حذف صورة السالفة بأمان. لم يتم حذف السالفة.')
        setMenuPost(null)
        return
      }
    }
    const {error}=await s.from('social_posts').delete().eq('id',post.id)
    if(error){setNotice('تم حذف ملف الصورة لكن تعذر حذف سجل السالفة؛ أعد المحاولة.');setMenuPost(null);return}
    setMenuPost(null);await load()
  }

  async function reportPost(post:any){
    const reason=await appPrompt({
      title:'إبلاغ عن السالفة',
      message:'اكتب سبب البلاغ ليتم مراجعته.',
      placeholder:'سبب البلاغ...',
      confirmLabel:'إرسال البلاغ',
      danger:true
    })
    if(!reason)return
    await s.rpc('report_user',{p_target:post.user_id,p_reason:'other',p_description:`بلاغ من سوالف: ${reason}`})
    setNotice('تم إرسال البلاغ للمراجعة.');setMenuPost(null)
  }

  async function blockPostUser(post:any){
    if(!await appConfirm({
      title:'حظر المستخدم',
      message:'لن يظهر لك هذا المستخدم في سوالف أو الاكتشاف أو التواصل.',
      confirmLabel:'حظر',
      danger:true
    }))return
    await s.rpc('block_user',{p_target:post.user_id})
    setNotice('تم حظر المستخدم.');setMenuPost(null);await load()
  }

  async function unlockVisitors(){
    if(visitorCost==null){setNotice('ميزة كشف الزوار غير متاحة الآن.');return}
    if(!await appConfirm({
      title:'كشف زوار الملف',
      message:`تفعيل كشف هوية الزوار لمدة 24 ساعة مقابل ${visitorCost} نجمة.`,
      confirmLabel:'تفعيل'
    }))return
    const {error}=await s.rpc('unlock_profile_visitors_24h')
    setNotice(error?(error.message.includes('insufficient_stars')?'رصيد النجوم غير كافٍ.':'تعذر تفعيل كشف الزوار.'):'تم تفعيل كشف الزوار لمدة 24 ساعة.')
    if(!error)await load()
  }

  const city=(profile?.cities as any)?.name_ar||'غير محدد'
  const avatar=profile?.avatar_url||''
  const filteredPosts=topic==='الكل'?posts:posts.filter(p=>(p.topic||'').includes(topic.replace(/^.\s?/,'').replace('# ',''))||p.topic===topic)

  return <AppShell>
    <main className="px-4 pb-5 pt-3">
      <header className="safe-top flex items-center justify-between">
        <div className="flex items-center gap-3"><BrandLogo size={58}/><div><h1 className="text-[33px] font-black">سوالف</h1><p className="text-[13px] font-bold text-[#6f7b93]">شارك لحظاتك وسوالفك مع الأصدقاء</p></div></div>
        <button onClick={()=>setShowComposer(true)} className="tap-action lammetna-gradient grid h-[52px] w-[52px] place-items-center rounded-[20px] text-white shadow-lg"><Camera size={27}/></button>
      </header>

      <section className="pixel-card mt-4 rounded-[25px] p-4">
        <div className="flex items-center justify-between"><h2 className="font-black">🔥 المواضيع الرائجة</h2><button onClick={()=>setTopic('الكل')} className="tap-action text-xs font-black text-[#703deb]">عرض الكل ‹</button></div>
        <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto">{TOPICS.map(x=><button key={x} onClick={()=>setTopic(x)} className={`tap-action whitespace-nowrap rounded-[15px] px-3 py-2 text-xs font-black ${topic===x?'lammetna-gradient text-white':'bg-[linear-gradient(135deg,#fff0f8,#edf6ff)]'}`}>{x}</button>)}</div>
      </section>

      {notice?<p className="mt-3 rounded-2xl bg-[#edf5ff] p-3 text-sm font-bold text-[#2b5288]">{notice}</p>:null}

      {filteredPosts.map((post:any)=>{const liked=post.likes.some((x:any)=>x.user_id===uid);return <article key={post.id} className="pixel-card mt-4 rounded-[27px] p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/people/${post.user_id}`} className="tap-action flex items-center gap-3">
            <div className="relative">{post.profile?.avatar_url?<img src={post.profile.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover"/>:<span className="grid h-14 w-14 place-items-center rounded-full bg-[#eaf4ff] text-[#0e67f5]"><UserRound size={24}/></span>}{post.profile?.is_online===true?<span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#11d092] shadow-[0_0_9px_rgba(17,208,146,.75)] ring-2 ring-white"/>:null}</div>
            <div><p className="font-black">{post.profile?.display_name||'صديق لمتنا'}</p><p className="mt-1 flex items-center gap-2 text-[11px] font-bold text-[#7a869b]"><MapPin className="inline" size={12}/>{(post.profile?.cities as any)?.name_ar||'لمتنا'}</p></div>
          </Link>
          <div className="flex items-center gap-2">{post.user_id!==uid?<button onClick={()=>greet(post.user_id)} className="tap-action rounded-full bg-[#ffe9f7] px-3 py-2 text-xs font-black text-[#ec2aa1]">💗 أرسل تحية</button>:null}<button onClick={()=>setMenuPost(post)} className="tap-action p-2"><MoreHorizontal size={20}/></button></div>
        </div>
        {post.body?<p className="mt-4 text-[16px] font-bold leading-7">{post.body}</p>:null}
        {post.media_display_url?<button onClick={()=>setViewer({url:post.media_display_url,type:post.media_type})} className="tap-action relative mt-4 block w-full overflow-hidden rounded-[20px] bg-[#eef3f8]">
          {post.media_type==='video'?<video src={post.media_display_url} className="h-[230px] w-full object-cover" muted playsInline/>:<img src={post.media_display_url} alt="" className="max-h-[320px] w-full object-cover"/>}
          {post.media_type==='video'?<span className="absolute inset-0 grid place-items-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-black/50 text-white"><Play fill="white"/></span></span>:null}
        </button>:null}
        {post.topic?<span className="mt-3 inline-flex rounded-full bg-[#f2eaff] px-3 py-1.5 text-xs font-black text-[#6930d8]">{post.topic}</span>:null}
        <div className="mt-4 flex items-center justify-between text-[#45536c]"><p className="text-[11px] font-bold text-[#7a869b]">{new Date(post.created_at).toLocaleString('ar-EG')}</p><div className="flex items-center gap-5">
          <button onClick={()=>share(post)} className="tap-action"><Share2 size={19}/></button>
          <button onClick={()=>setCommentsPost(post)} className="tap-action flex items-center gap-1 text-xs font-black"><MessageCircle size={19}/>{post.comments.length}</button>
          <button onClick={()=>toggleLike(post)} className={`tap-action flex items-center gap-1 text-xs font-black ${liked?'text-[#e72596]':''}`}><Heart size={20} fill={liked?'currentColor':'none'}/>{post.likes.length}</button>
        </div></div>
      </article>})}

      {!busy&&!filteredPosts.length?<section className="pixel-card mt-4 rounded-[27px] p-6 text-center"><p className="font-black">مفيش سوالف في التصنيف ده لسه.</p><button onClick={()=>setShowComposer(true)} className="tap-action lammetna-gradient mt-3 rounded-full px-5 py-2 text-sm font-black text-white">ابدأ أول سالفة</button></section>:null}

      <article className="pixel-card mt-4 rounded-[27px] p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3"><div className="relative">{avatar?<img src={avatar} alt="" className="h-14 w-14 rounded-full object-cover"/>:<span className="grid h-14 w-14 place-items-center rounded-full bg-[#eaf4ff] text-[#0e67f5]"><UserRound size={24}/></span>}{profile?.is_online===true?<span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#11d092] shadow-[0_0_9px_rgba(17,208,146,.75)] ring-2 ring-white"/>:null}</div><div><p className="font-black">{profile?.display_name||'حسابي'}</p><p className="mt-1 flex items-center gap-2 text-[11px] font-bold text-[#7a869b]"><span><MapPin className="inline" size={12}/> {city}</span></p></div></div>
          <span className="rounded-full bg-[#eaf4ff] px-3 py-2 text-xs font-black text-[#0e67f5]">سؤال اليوم</span>
        </div>
        <p className="mt-4 text-[16px] font-bold leading-7">{q?.question_ar||'ما هي السالفة التي تحب تشاركها اليوم؟'}</p>
        <textarea value={answer} onChange={e=>setAnswer(e.target.value)} className="mt-3 min-h-20 w-full rounded-[18px] bg-[#f3f7fb] p-3 text-sm outline-none" placeholder="اكتب إجابتك..."/>
        <button onClick={saveAnswer} disabled={busy||!answer.trim()} className="tap-action lammetna-gradient mt-3 rounded-[17px] px-4 py-2 text-sm font-black text-white">نشر الإجابة</button>
      </article>

      <article className="pixel-card mt-4 rounded-[27px] p-4">
        <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-3"><div className="relative"><img src="/demo/face-2.jpg" alt="" className="h-14 w-14 rounded-full object-cover"/><span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#11d092] ring-2 ring-white"/></div><div><p className="font-black">مرّوا من هنا 👀</p><p className="mt-1 text-[11px] font-bold text-[#7a869b]">{count} زيارة لملفك</p></div></div><button onClick={unlockVisitors} className="tap-action rounded-full bg-[#eaf4ff] px-3 py-2 text-xs font-black text-[#0e67f5]">{visitorCost==null?'عرض الزوار':`كشف الزوار · ${visitorCost} ⭐`}</button></div>
        <div className="mt-4"><p className="text-[16px] font-bold leading-7">شوف مين زار ملفك مؤخرًا، وابدأ تعارف جديد من الناس المهتمة بيك.</p><div className="mt-4 flex -space-x-2 space-x-reverse">{visitors.slice(0,5).map((x:any,i:number)=>x.identity_revealed?<Link href={`/people/${x.viewer_id}`} key={x.view_id||i} className="tap-action grid h-10 w-10 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#edf3f9]">{x.avatar_url?<img src={x.avatar_url} alt="" className="h-full w-full object-cover"/>:<UserRound size={18}/>}</Link>:<button onClick={unlockVisitors} key={x.view_id||i} className="tap-action grid h-10 w-10 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#edf3f9]"><UserRound size={18}/></button>)}</div></div>
      </article>

      <article className="pixel-card mt-4 rounded-[27px] p-4">
        <div className="flex items-start justify-between"><div className="flex items-center gap-3"><img src="/demo/face-4.jpg" alt="" className="h-14 w-14 rounded-full object-cover"/><div><p className="font-black">مهمات اليوم 🎁</p><p className="text-[11px] font-bold text-[#7a869b]">اجمع نجومًا من نشاطك داخل لمتنا</p></div></div></div>
        <div className="mt-3 space-y-2">{missions.slice(0,4).map((m:any)=><div key={m.code} className="flex items-center justify-between rounded-[17px] bg-[#f4f8fc] p-3"><div className="min-w-0 flex-1 pl-3"><p className="text-sm font-black">{m.title_ar}</p><p className="text-[10px] font-bold text-[#77839a]">{m.description_ar}</p>{m.code==='complete_profile'?<p className="mt-1 text-[10px] font-black text-[#9a6b00]">تُمنح هذه النجوم مرة واحدة فقط.</p>:null}</div><button disabled={busy||m.claimed} onClick={()=>claim(m.code)} className={`tap-action shrink-0 rounded-full px-3 py-2 text-xs font-black ${m.claimed?'bg-[#e8eef4] text-[#8290a4]':'bg-[#fff4c6] text-[#8c6200]'}`}>{m.claimed?'تم':'+'+m.reward_stars+' ⭐ ترويجية'}</button></div>)}</div>
        <p className="mt-3 rounded-[16px] bg-[#eef5ff] px-3 py-2 text-[10px] font-bold leading-5 text-[#52627d]">ملاحظة: النجوم الترويجية تُستخدم للصرف داخل التطبيق فقط، ولا تُضاف إلى رصيد قابل للسحب.</p>
        <div className="mt-3 flex items-center gap-2"><input value={status} onChange={e=>setStatus(e.target.value)} className="h-11 flex-1 rounded-[16px] bg-[#f3f7fb] px-3 text-sm outline-none" placeholder="حالتك الآن..."/><button onClick={social} disabled={busy||!status.trim()} className="tap-action lammetna-gradient rounded-[16px] px-4 py-3 text-xs font-black text-white">نشر</button></div>
      </article>
    </main>

    {showComposer?<div className="fixed inset-0 z-[80] flex items-end bg-black/40" onClick={()=>setShowComposer(false)}>
      <section onClick={e=>e.stopPropagation()} className="mx-auto w-full max-w-[432px] rounded-t-[34px] bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between"><h3 className="text-xl font-black">سالفة جديدة</h3><button onClick={()=>setShowComposer(false)} className="tap-action grid h-10 w-10 place-items-center rounded-full bg-[#eef3f8]"><X size={20}/></button></div>
        <textarea value={postBody} onChange={e=>setPostBody(e.target.value)} maxLength={1000} className="mt-4 min-h-28 w-full rounded-[22px] bg-[#f3f7fb] p-4 outline-none" placeholder="شارك لحظتك أو سالفتك..."/>
        {mediaPreview?<div className="relative mt-3 overflow-hidden rounded-[20px] bg-[#eef3f8]"><img src={mediaPreview} alt="" className="max-h-64 w-full object-cover"/><button onClick={()=>setMedia(null)} className="absolute left-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white"><X size={18}/></button></div>:null}
        <div className="mt-3 flex items-center gap-2">
          <button disabled={!imageUploadsEnabled} title={imageUploadsEnabled?'إضافة صورة':'رفع الصور متوقف مؤقتًا لحين تفعيل فحص المحتوى'} onClick={()=>picker.current?.click()} className="tap-action flex items-center gap-2 rounded-full bg-[#eaf4ff] px-4 py-2 text-xs font-black text-[#0e67f5] disabled:opacity-50"><ImagePlus size={18}/> صورة</button>
          <select value={postTopic} onChange={e=>setPostTopic(e.target.value)} className="h-10 flex-1 rounded-full bg-[#f3f7fb] px-3 text-xs font-black outline-none">{TOPICS.slice(1).map(x=><option key={x}>{x}</option>)}</select>
          <input ref={picker} hidden disabled={!imageUploadsEnabled} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setMedia(e.target.files?.[0]||null)}/>
        </div>
        <button onClick={publishPost} disabled={busy||(!postBody.trim()&&!media)} className="tap-action lammetna-gradient mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[18px] font-black text-white"><Send size={18}/> نشر السالفة</button>
      </section>
    </div>:null}

    {commentsPost?<div className="fixed inset-0 z-[82] flex items-end bg-black/40" onClick={()=>setCommentsPost(null)}>
      <section onClick={e=>e.stopPropagation()} className="mx-auto max-h-[72vh] w-full max-w-[432px] overflow-y-auto rounded-t-[34px] bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between"><h3 className="text-xl font-black">التعليقات</h3><button onClick={()=>setCommentsPost(null)} className="tap-action grid h-10 w-10 place-items-center rounded-full bg-[#eef3f8]"><X size={20}/></button></div>
        <div className="mt-4 space-y-3">{(posts.find(p=>p.id===commentsPost.id)?.comments||[]).map((cm:any)=><div key={cm.id} className="flex gap-3 rounded-[18px] bg-[#f5f8fb] p-3">{cm.profile?.avatar_url?<img src={cm.profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover"/>:<span className="grid h-9 w-9 place-items-center rounded-full bg-white"><UserRound size={17}/></span>}<div><p className="text-xs font-black">{cm.profile?.display_name||'مستخدم'}</p><p className="mt-1 text-sm">{cm.body}</p></div></div>)}{!(posts.find(p=>p.id===commentsPost.id)?.comments||[]).length?<p className="py-5 text-center text-sm text-[#758199]">كن أول من يعلق.</p>:null}</div>
        <div className="sticky bottom-0 mt-4 flex gap-2 bg-white pt-2"><input value={comment} onChange={e=>setComment(e.target.value)} className="h-11 flex-1 rounded-[16px] bg-[#f3f7fb] px-3 text-sm outline-none" placeholder="اكتب تعليقًا..."/><button onClick={addComment} disabled={busy||!comment.trim()} className="tap-action lammetna-gradient grid h-11 w-11 place-items-center rounded-[16px] text-white"><Send size={18}/></button></div>
      </section>
    </div>:null}

    {menuPost?<div className="fixed inset-0 z-[84] flex items-end bg-black/40" onClick={()=>setMenuPost(null)}>
      <section onClick={e=>e.stopPropagation()} className="mx-auto w-full max-w-[432px] rounded-t-[34px] bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between"><h3 className="text-lg font-black">خيارات السالفة</h3><button onClick={()=>setMenuPost(null)} className="grid h-10 w-10 place-items-center rounded-full bg-[#eef3f8]"><X size={20}/></button></div>
        {menuPost.user_id===uid?<button onClick={()=>deletePost(menuPost)} className="tap-action mt-4 flex w-full items-center gap-3 rounded-[18px] bg-red-50 p-4 font-black text-red-700"><Trash2 size={20}/> حذف السالفة</button>:<>
          <button onClick={()=>reportPost(menuPost)} className="tap-action mt-4 flex w-full items-center gap-3 rounded-[18px] bg-amber-50 p-4 font-black text-amber-800"><Flag size={20}/> إبلاغ عن السالفة</button>
          <button onClick={()=>blockPostUser(menuPost)} className="tap-action mt-2 flex w-full items-center gap-3 rounded-[18px] bg-red-50 p-4 font-black text-red-700"><Ban size={20}/> حظر المستخدم</button>
        </>}
      </section>
    </div>:null}

    {viewer?<div className="fixed inset-0 z-[90] grid place-items-center bg-black/90 p-4" onClick={()=>setViewer(null)}>
      <button className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white text-black"><X/></button>
      {viewer.type==='video'?<video src={viewer.url} controls autoPlay className="max-h-[82vh] max-w-full rounded-[24px]" onClick={e=>e.stopPropagation()}/>:<img src={viewer.url} alt="" className="max-h-[82vh] max-w-full rounded-[24px] object-contain" onClick={e=>e.stopPropagation()}/>}
    </div>:null}
  </AppShell>
}
