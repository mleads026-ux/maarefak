'use client'

import {useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {CheckCircle2,FileText,LogOut,ShieldCheck,X} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'

type LegalKind='terms'|'privacy'|'community'
type LegalDoc={
  kind:LegalKind
  title_ar:string
  content_ar:string
  version:string
  effective_at:string|null
  created_at:string
}

export default function LegalAcceptance(){
  const s=useMemo(()=>createClient(),[])
  const r=useRouter()
  const [docs,setDocs]=useState<Partial<Record<LegalKind,LegalDoc>>>({})
  const [checks,setChecks]=useState([false,false,false,false])
  const [openDoc,setOpenDoc]=useState<LegalKind|null>(null)
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')

  useEffect(()=>{(async()=>{
    const {data,error}=await s
      .from('legal_documents')
      .select('kind,title_ar,content_ar,version,effective_at,created_at')
      .eq('active',true)
      .in('kind',['terms','privacy','community'])
      .order('effective_at',{ascending:false})
      .order('created_at',{ascending:false})

    if(error){
      setNotice('تعذر تحميل المستندات القانونية الحالية. حاول مرة أخرى.')
      return
    }

    const current:Partial<Record<LegalKind,LegalDoc>>={}
    for(const row of (data||[]) as LegalDoc[]){
      if(!current[row.kind])current[row.kind]=row
    }
    setDocs(current)
  })()},[s])

  const legalRows:[string,LegalKind][]=[
    ['أوافق على الشروط والأحكام الحالية','terms'],
    ['أوافق على سياسة الخصوصية الحالية','privacy'],
    ['أوافق على إرشادات المجتمع الحالية','community'],
  ]

  const docsReady=Boolean(docs.terms&&docs.privacy&&docs.community)
  const canAccept=docsReady&&checks.every(Boolean)&&!busy

  async function accept(){
    if(!canAccept)return
    setBusy(true);setNotice('')

    const {error}=await s.rpc('accept_current_legal',{
      p_adult_confirmed:checks[3],
    })

    if(error){
      setNotice(error.message.includes('adult_confirmation_required')
        ?'يلزم تأكيد أن عمرك 18 عامًا أو أكثر.'
        :'تعذر تسجيل الموافقات القانونية. حاول مرة أخرى.')
      setBusy(false)
      return
    }

    const {data:profile}=await s
      .from('profiles')
      .select('profile_complete')
      .maybeSingle()

    r.push(profile?.profile_complete?'/home':'/onboarding')
    r.refresh()
  }

  async function logout(){
    await s.auth.signOut()
    r.push('/login')
    r.refresh()
  }

  return <main className="mx-auto min-h-[100dvh] w-full max-w-[432px] bg-[linear-gradient(180deg,#f8fcff,#eef7ff)] px-5 pb-8 pt-[max(28px,env(safe-area-inset-top))]">
    <section className="rounded-[32px] bg-white p-5 shadow-[0_18px_45px_rgba(20,63,120,.12)] ring-1 ring-[#deebf8]">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-[#eaf3ff] text-[#1560BD]">
        <ShieldCheck size={34}/>
      </div>
      <h1 className="mt-4 text-center text-[27px] font-black">تحديث الموافقات القانونية</h1>
      <p className="mt-2 text-center text-sm font-bold leading-6 text-[#697890]">
        قبل متابعة استخدام لمتنا، راجع ووافق على الإصدارات الحالية من المستندات التالية.
      </p>

      {notice?<p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{notice}</p>:null}

      <div className="mt-5 space-y-3">
        {legalRows.map(([label,kind],i)=><div key={kind} className="rounded-[20px] border border-[#e1eaf5] bg-[#fbfdff] p-3">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={()=>setOpenDoc(kind)} className="tap-action min-w-0 flex-1 text-right">
              <span className="flex items-center gap-2 text-sm font-black text-[#173fbd]"><FileText size={17}/>{label}</span>
              <span className="mt-1 block text-[10px] font-bold text-[#7c899e]">الإصدار {docs[kind]?.version||'جاري التحميل...'}</span>
            </button>
            <input
              type="checkbox"
              checked={checks[i]}
              disabled={!docs[kind]}
              onChange={e=>setChecks(v=>v.map((x,n)=>n===i?e.target.checked:x))}
              className="h-5 w-5 accent-[#1560BD]"
            />
          </div>
        </div>)}

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[20px] border border-[#f0d8dc] bg-[#fffafb] p-3">
          <span className="text-sm font-black text-[#263550]">أؤكد أن عمري 18 عامًا أو أكثر <b className="mr-1 rounded-full border border-red-500 px-1.5 py-0.5 text-[10px] text-red-500">18+</b></span>
          <input
            type="checkbox"
            checked={checks[3]}
            onChange={e=>setChecks(v=>v.map((x,n)=>n===3?e.target.checked:x))}
            className="h-5 w-5 accent-[#1560BD]"
          />
        </label>
      </div>

      <button
        onClick={accept}
        disabled={!canAccept}
        className="tap-action lammetna-gradient hero-shadow mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-[22px] text-base font-black text-white disabled:opacity-50"
      >
        <CheckCircle2 size={20}/> موافق ومتابعة
      </button>

      <button onClick={logout} disabled={busy} className="tap-action mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[20px] bg-[#f1f5f9] text-sm font-black text-[#56657a]">
        <LogOut size={17}/> تسجيل الخروج
      </button>
    </section>

    {openDoc?<div className="fixed inset-0 z-[100] flex items-end bg-black/45" onClick={()=>setOpenDoc(null)}>
      <section onClick={e=>e.stopPropagation()} className="mx-auto max-h-[82vh] w-full max-w-[432px] overflow-y-auto rounded-t-[34px] bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 flex items-center justify-between bg-white pb-3">
          <div>
            <h2 className="text-lg font-black">{docs[openDoc]?.title_ar||'المستند القانوني'}</h2>
            <p className="text-[10px] font-bold text-[#7a869b]">الإصدار {docs[openDoc]?.version||'الحالي'}</p>
          </div>
          <button onClick={()=>setOpenDoc(null)} className="tap-action grid h-10 w-10 place-items-center rounded-full bg-[#eef3f8]"><X size={20}/></button>
        </div>
        <div className="whitespace-pre-wrap text-sm font-medium leading-7 text-[#35435e]">{docs[openDoc]?.content_ar||'جاري تحميل المستند...'}</div>
      </section>
    </div>:null}
  </main>
}
