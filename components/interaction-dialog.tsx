'use client'
import {useEffect,useState} from 'react'
import {X,AlertTriangle} from 'lucide-react'

type DialogKind='confirm'|'prompt'
type Request={
  id:number
  kind:DialogKind
  title:string
  message?:string
  placeholder?:string
  confirmLabel?:string
  cancelLabel?:string
  danger?:boolean
}
type ConfirmOptions=Omit<Request,'id'|'kind'|'placeholder'>
type PromptOptions=Omit<Request,'id'|'kind'>

let seq=0
const resolvers=new Map<number,(value:any)=>void>()

function emit(req:Request){
  window.dispatchEvent(new CustomEvent('lammetna-dialog',{detail:req}))
}

export function appConfirm(options:string|ConfirmOptions){
  if(typeof window==='undefined')return Promise.resolve(false)
  const opts:ConfirmOptions=typeof options==='string'?{title:'تأكيد',message:options}:options
  const id=++seq
  return new Promise<boolean>(resolve=>{
    resolvers.set(id,resolve)
    emit({id,kind:'confirm',cancelLabel:'إلغاء',confirmLabel:'تأكيد',...opts})
  })
}

export function appPrompt(options:string|PromptOptions){
  if(typeof window==='undefined')return Promise.resolve(null)
  const opts:PromptOptions=typeof options==='string'?{title:'أدخل البيانات',message:options}:options
  const id=++seq
  return new Promise<string|null>(resolve=>{
    resolvers.set(id,resolve)
    emit({id,kind:'prompt',cancelLabel:'إلغاء',confirmLabel:'إرسال',...opts})
  })
}

export function InteractionDialogHost(){
  const [req,setReq]=useState<Request|null>(null)
  const [value,setValue]=useState('')

  useEffect(()=>{
    const handler=(event:Event)=>{
      const detail=(event as CustomEvent<Request>).detail
      setValue('')
      setReq(detail)
    }
    window.addEventListener('lammetna-dialog',handler)
    return()=>window.removeEventListener('lammetna-dialog',handler)
  },[])

  function finish(valueOut:any){
    if(!req)return
    const resolve=resolvers.get(req.id)
    resolvers.delete(req.id)
    setReq(null)
    setValue('')
    resolve?.(valueOut)
  }

  if(!req)return null

  return <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 px-0" onMouseDown={e=>{if(e.target===e.currentTarget)finish(req.kind==='prompt'?null:false)}}>
    <section className="w-full max-w-[432px] rounded-t-[34px] bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-[0_-24px_70px_rgba(5,20,49,.22)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {req.danger?<span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={20}/></span>:null}
          <div><h3 className="text-[20px] font-black">{req.title}</h3>{req.message?<p className="mt-1 whitespace-pre-line text-sm font-bold leading-6 text-[#6d7890]">{req.message}</p>:null}</div>
        </div>
        <button type="button" onClick={()=>finish(req.kind==='prompt'?null:false)} className="tap-action grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eef3f8] text-[#43516b]"><X size={19}/></button>
      </div>

      {req.kind==='prompt'?<textarea autoFocus maxLength={500} value={value} onChange={e=>setValue(e.target.value)} placeholder={req.placeholder||'اكتب هنا...'} className="mt-4 min-h-28 w-full rounded-[20px] border border-[#dfe9f5] bg-[#f5f8fc] p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-[#8cc7ff]"/>:null}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={()=>finish(req.kind==='prompt'?null:false)} className="tap-action h-12 rounded-[18px] bg-[#eef3f8] font-black text-[#45536d]">{req.cancelLabel||'إلغاء'}</button>
        <button type="button" disabled={req.kind==='prompt'&&!value.trim()} onClick={()=>finish(req.kind==='prompt'?value.trim():true)} className={`tap-action h-12 rounded-[18px] font-black text-white disabled:opacity-50 ${req.danger?'bg-red-600':'lammetna-gradient'}`}>{req.confirmLabel||'تأكيد'}</button>
      </div>
    </section>
  </div>
}
