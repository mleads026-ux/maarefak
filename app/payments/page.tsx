'use client'
import {useEffect,useMemo,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {PageHeader} from '@/components/page-header'
import {Button} from '@/components/ui/button'
import {Card,CardContent} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {BadgeCheck,Banknote,CreditCard,ShieldAlert,Star,Wallet,Copy,Check,Send} from 'lucide-react'
import {appConfirm} from '@/components/interaction-dialog'
import {calculateStarTransferBreakdown,explainFinancialError,explainStarTransferError} from '@/lib/payments'
import {fetchPaymentsSnapshot} from '@/lib/payments-data'

export default function Payments(){
 const s=useMemo(()=>createClient(),[])
 const [uid,setUid]=useState('')
 const [wallet,setWallet]=useState(0)
 const [packs,setPacks]=useState<any[]>([])
 const [earn,setEarn]=useState<any>({})
 const [risk,setRisk]=useState<any>({})
 const [profile,setProfile]=useState<any>({})
 const [methods,setMethods]=useState<any[]>([])
 const [withdrawals,setWithdrawals]=useState<any[]>([])
 const [settings,setSettings]=useState<any>({})
 const [identity,setIdentity]=useState<any>({})
 const [publicId,setPublicId]=useState('')
 const [recipientId,setRecipientId]=useState('')
 const [recipient,setRecipient]=useState<any>(null)
 const [transferStars,setTransferStars]=useState('')
 const [transferRef,setTransferRef]=useState(()=>crypto.randomUUID())
 const [stars,setStars]=useState('')
 const [notice,setNotice]=useState('')
 const [busy,setBusy]=useState(false)
 const [copied,setCopied]=useState(false)

 async function load(){
   setBusy(true)
   const {data:{user}}=await s.auth.getUser()
   if(!user){setBusy(false);return}
   setUid(user.id)
   const snapshot=await fetchPaymentsSnapshot(s,user.id)
   setWallet(snapshot.wallet)
   setPacks(snapshot.packs)
   setEarn(snapshot.earnings)
   setRisk(snapshot.risk)
   setProfile(snapshot.profile)
   setPublicId(snapshot.publicId)
   setMethods(snapshot.methods)
   setWithdrawals(snapshot.withdrawals)
   setSettings(snapshot.settings)
   setIdentity(snapshot.identity)
   setBusy(false)
 }

 useEffect(()=>{load()},[])

 async function useEarnings(action:'convert'|'withdraw'){
   const n=Number(stars)
   if(!n||n<1)return
   const label=action==='convert'?'تحويل الأرباح إلى رصيد نجوم':'نقل الأرباح إلى مسار السحب'
   if(!await appConfirm({
     title:label,
     message:`العدد: ${n.toLocaleString('ar-EG')} ⭐`,
     confirmLabel:'متابعة'
   }))return
   setBusy(true)
   const {error}=await s.rpc('use_lamma_earnings',{p_action:action,p_stars:n})
   setNotice(error?explainFinancialError(error):action==='convert'?'تم تحويل الأرباح إلى رصيد نجوم.':'تم نقل الأرباح لمسار السحب.')
   await load()
 }

 async function withdraw(method:string){
   const n=Number(stars)
   if(!n||n<1)return
   const m=methods.find((x:any)=>x.id===method)
   const destination=[m?.label||m?.route,m?.destination_masked].filter(Boolean).join(' · ')
   if(!await appConfirm({
     title:'إنشاء طلب سحب',
     message:`${n.toLocaleString('ar-EG')} ⭐${destination?`\nإلى: ${destination}`:''}`,
     confirmLabel:'إنشاء الطلب'
   }))return
   setBusy(true)
   const {error}=await s.rpc('request_withdrawal_to_saved_method',{p_stars:n,p_method:method})
   setNotice(error?explainFinancialError(error):'تم إنشاء طلب السحب.')
   await load()
 }

 async function lookupRecipient(){
   const id=recipientId.trim().toUpperCase()
   if(!id)return
   setBusy(true);setRecipient(null)
   const {data,error}=await s.rpc('lookup_user_for_star_transfer',{p_public_user_id:id})
   const row=Array.isArray(data)?data[0]:data
   setRecipient(error?null:(row||null))
   setNotice(error?'تعذر البحث عن المستخدم.':row?'تأكد من الاسم قبل التحويل.':'لم يتم العثور على User ID.')
   setBusy(false)
 }

 async function transferStarsToUser(){
   const n=Number(transferStars)
   if(!recipient||!Number.isInteger(n)||n<1)return
   if(!await appConfirm({
     title:'تأكيد تحويل النجوم',
     message:`إلى: ${recipient.display_name}\nUser ID: ${recipient.public_user_id}\nالمرسل: ${n.toLocaleString('ar-EG')} ⭐\nعمولة التطبيق 15%: ${Math.ceil(n*0.15).toLocaleString('ar-EG')} ⭐\nسيصل للمستلم: ${(n-Math.ceil(n*0.15)).toLocaleString('ar-EG')} ⭐\n\nالتحويل نهائي بعد التأكيد.`,
     confirmLabel:'تحويل النجوم',
     danger:true
   }))return
   setBusy(true)
   const {error}=await s.rpc('transfer_stars_by_user_id',{p_public_user_id:recipient.public_user_id,p_amount:n,p_client_reference_id:transferRef})
   if(error){
     setNotice(explainStarTransferError(error))
   }else{
     setNotice('تم إرسال '+n+' ⭐. وصل للمستلم '+(n-Math.ceil(n*0.15))+' ⭐ بعد عمولة التطبيق 15%.')
     setTransferStars('');setRecipient(null);setRecipientId('');setTransferRef(crypto.randomUUID())
     await load()
   }
   setBusy(false)
 }

 async function verify(){
   setBusy(true)
   const {error}=await s.rpc('start_identity_verification')
   setNotice(error?(identity.enabled?'تعذر بدء التحقق الآن.':'مزود التحقق من الهوية لم يتم ربطه بعد.'):'تم بدء التحقق من الهوية.')
   setBusy(false)
 }

 async function copyId(){
   if(!publicId)return
   try{
     await navigator.clipboard.writeText(publicId)
     setCopied(true)
     setNotice('تم نسخ User ID.')
     setTimeout(()=>setCopied(false),1400)
   }catch{
     setNotice('تعذر النسخ تلقائيًا.')
   }
 }

 const blocked=Number(risk.iap_debt_stars||0)>0||!!risk.manual_payout_hold
 const {gross:transferGross,fee:transferFee,net:transferNet}=calculateStarTransferBreakdown(transferStars)

 return <AppShell><PageHeader title="المدفوعات"/><main className="space-y-4 p-4">
 {notice&&<p className="rounded-2xl bg-[#EAF2FC] p-3 text-sm font-bold text-[#1560BD]">{notice}</p>}

 <section className="grid grid-cols-2 gap-3">
   <Card><CardContent><Wallet className="text-[#1560BD]"/><p className="mt-2 text-xs text-slate-500">رصيد النجوم</p><p className="text-2xl font-black">{wallet.toLocaleString()} ⭐</p></CardContent></Card>
   <Card><CardContent><Banknote className="text-[#1560BD]"/><p className="mt-2 text-xs text-slate-500">أرباح متاحة</p><p className="text-2xl font-black">{Number(earn.available_stars||0).toLocaleString()} ⭐</p></CardContent></Card>
 </section>

 {blocked?<div className="rounded-3xl border border-red-200 bg-red-50 p-4"><div className="flex gap-2"><ShieldAlert className="text-red-600"/><div><p className="font-extrabold text-red-700">قيود مالية على الحساب</p>{Number(risk.iap_debt_stars||0)>0?<p className="mt-1 text-sm text-red-700">مديونية IAP: {risk.iap_debt_stars} ⭐ — أي شراء نجوم جديد يسدد الدين أولًا.</p>:null}{risk.manual_payout_hold?<p className="mt-1 text-sm text-red-700">السحب تحت المراجعة{risk.manual_hold_reason?' · '+risk.manual_hold_reason:''}</p>:null}</div></div></div>:null}

 <Card><CardContent>
   <div className="flex items-center gap-2"><Send className="text-[#1560BD]"/><h2 className="font-extrabold">تحويل النجوم</h2></div>
   <div className="mt-3 rounded-2xl bg-[#F4F8FD] p-3">
     <p className="text-xs font-bold text-slate-500">User ID الخاص بك — ID الراسل</p>
     <div className="mt-1 flex items-center gap-2" dir="ltr"><b className="flex-1 text-left tracking-wider">{publicId||'—'}</b><Button size="icon" variant="outline" onClick={copyId} disabled={!publicId}>{copied?<Check size={15}/>:<Copy size={15}/>}</Button></div>
   </div>
   <p className="mt-3 text-xs text-slate-500">أدخل User ID للمستلم. سيظهر اسمه للتأكد قبل التحويل.</p>
   <div className="mt-2 flex gap-2" dir="ltr"><Input className="text-left uppercase" value={recipientId} onChange={e=>{setRecipientId(e.target.value.toUpperCase());setRecipient(null)}} placeholder="LM0000000000"/><Button variant="secondary" onClick={lookupRecipient} disabled={busy||!recipientId.trim()}>تحقق</Button></div>
   {recipient?<div className="mt-3 rounded-2xl border border-[#BFD6F3] bg-[#F8FBFF] p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-extrabold">{recipient.display_name}</p><p className="text-xs text-slate-500" dir="ltr">{recipient.public_user_id}</p></div><span className="rounded-full bg-[#E4F8F0] px-3 py-1 text-[11px] font-black text-[#12845E]">تم التحقق ✓</span></div><Input className="mt-3" type="number" min="1" inputMode="numeric" value={transferStars} onChange={e=>setTransferStars(e.target.value)} placeholder="عدد النجوم"/>{transferGross>0?<div className="mt-2 grid grid-cols-2 gap-2 text-center text-[11px] font-black"><div className="rounded-xl bg-white p-2"><p className="text-slate-500">عمولة التطبيق 15%</p><p className="text-[#d16a00]">{transferFee.toLocaleString()} ⭐</p></div><div className="rounded-xl bg-white p-2"><p className="text-slate-500">سيصل للمستلم</p><p className="text-[#12845E]">{transferNet.toLocaleString()} ⭐</p></div></div>:null}<Button className="mt-2 w-full" onClick={transferStarsToUser} disabled={busy||!transferStars}>إرسال النجوم ⭐</Button><p className="mt-2 text-[11px] text-slate-500">يُخصم 15% للتطبيق، وتُقرب عمولة التطبيق لأعلى إلى نجمة صحيحة.</p></div>:null}
 </CardContent></Card>

 <Card><CardContent>
   <div className="flex items-center gap-2"><CreditCard className="text-[#1560BD]"/><h2 className="font-extrabold">باقات النجوم</h2></div>
   <p className="mt-1 text-xs text-slate-500">السعر المعروض حسب بلد حسابك. سعر متجر Apple/Google هو السعر النهائي عند الشراء.</p>
   <div className="mt-3 grid grid-cols-2 gap-2">{packs.map((p:any)=><div key={p.pack_id} className="rounded-2xl border border-[#DCE8F7] p-3"><p className="font-black">{p.stars_amount} ⭐</p><p className="mt-1 text-lg font-extrabold text-[#1560BD]">{p.display_price} {p.currency_code}</p><p className="text-[11px] text-slate-500">{p.unit_price} / نجمة {Number(p.savings_percent)>0?'· وفر '+p.savings_percent+'%':''}</p><Button className="mt-2 w-full" size="sm" disabled>الشراء من التطبيق</Button></div>)}</div>
   <p className="mt-3 text-xs text-slate-500">الشراء الحقيقي يظل مقفولًا هنا حتى ربط Apple IAP وGoogle Play Billing والتحقق Server-side.</p>
 </CardContent></Card>

 <Card><CardContent>
   <h2 className="font-extrabold">أرباح اللَمّة</h2>
   <div className="mt-3 grid grid-cols-2 gap-2 text-center">
     <div className="rounded-2xl bg-[#F4F8FD] p-3"><p className="text-xs text-slate-500">معلّقة</p><p className="font-black">{Number(earn.pending_stars||0)} ⭐</p></div>
     <div className="rounded-2xl bg-[#F4F8FD] p-3"><p className="text-xs text-slate-500">متاحة</p><p className="font-black">{Number(earn.available_stars||0)} ⭐</p></div>
     <div className="rounded-2xl bg-[#F4F8FD] p-3"><p className="text-xs text-slate-500">تم سحبها</p><p className="font-black">{Number(earn.withdrawn_stars||0)} ⭐</p></div>
     <div className="rounded-2xl bg-[#F4F8FD] p-3"><p className="text-xs text-slate-500">تم تحويلها</p><p className="font-black">{Number(earn.converted_stars||0)} ⭐</p></div>
   </div>
   {earn.next_action_at?<p className="mt-2 text-xs text-slate-500">موعد الإتاحة التالي: {new Date(earn.next_action_at).toLocaleString('ar-EG')}</p>:null}
   <Input className="mt-3" type="number" inputMode="numeric" value={stars} onChange={e=>setStars(e.target.value)} placeholder="عدد النجوم"/>
   <div className="mt-2 grid grid-cols-2 gap-2"><Button onClick={()=>useEarnings('convert')} disabled={busy||!stars}>تحويل لرصيد ⭐</Button><Button variant="secondary" onClick={()=>useEarnings('withdraw')} disabled={busy||!stars||blocked}>استخدام للسحب</Button></div>
 </CardContent></Card>

 <Card><CardContent>
   <div className="flex items-center gap-2"><BadgeCheck className="text-[#1560BD]"/><h2 className="font-extrabold">التحقق من الهوية KYC</h2></div>
   <p className="mt-2 text-sm">الحالة: <b>{profile.verification_status||'غير متحقق'}</b></p>
   <p className="mt-1 text-xs text-slate-500">Liveness: {identity.liveness_required?'مطلوب':'غير مطلوب'} · المزود: {identity.enabled?(identity.provider||'مفعّل'):'غير مربوط بعد'}</p>
   <Button className="mt-3 w-full" variant="secondary" onClick={verify} disabled={busy||profile.verification_status==='verified'}>{profile.verification_status==='verified'?'تم التحقق ✓':'بدء التحقق'}</Button>
 </CardContent></Card>

 <Card><CardContent>
   <h2 className="font-extrabold">طرق السحب المحفوظة</h2>
   {methods.length?<div className="mt-3 space-y-2">{methods.map((m:any)=><div key={m.id} className="rounded-2xl border border-[#DCE8F7] p-3"><div className="flex justify-between gap-2"><div><p className="font-bold">{m.label||m.route}{m.is_default?' · الافتراضي':''}</p><p className="text-xs text-slate-500">{m.bank_name_masked||m.wallet_issuer||''} {m.destination_masked||''}</p></div><Button size="sm" onClick={()=>withdraw(m.id)} disabled={busy||blocked||!settings.payouts_enabled||!stars}>سحب</Button></div></div>)}</div>:<p className="mt-2 text-sm text-slate-500">لا توجد طريقة سحب محفوظة بعد.</p>}
   {!settings.payouts_enabled?<p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800">السحب الحقيقي غير مفعّل حاليًا حتى اكتمال مزود الدفع وKYC واختبارات Sandbox.</p>:null}
 </CardContent></Card>

 <Card><CardContent>
   <h2 className="font-extrabold">طلبات السحب</h2>
   <div className="mt-3 space-y-2">{withdrawals.length?withdrawals.map((w:any)=><div key={w.id} className="flex items-center justify-between rounded-2xl bg-[#F4F8FD] p-3"><div><p className="font-bold">{w.requested_stars} ⭐</p><p className="text-xs text-slate-500">{w.destination_masked||w.payout_method||w.payout_route||'طريقة سحب'}</p></div><span className="rounded-full bg-white px-2 py-1 text-xs font-bold">{w.status}</span></div>):<p className="text-sm text-slate-500">لا توجد طلبات سحب.</p>}</div>
 </CardContent></Card>
 </main></AppShell>
}
