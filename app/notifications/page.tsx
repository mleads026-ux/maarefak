'use client'
import {useEffect,useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {createClient} from '@/lib/supabase/client'
import {AppShell} from '@/components/app-shell'
import {PageHeader} from '@/components/page-header'
import {Button} from '@/components/ui/button'
import {Card,CardContent} from '@/components/ui/card'
import {ChevronLeft} from 'lucide-react'

export default function Notifications(){
  const s=useMemo(()=>createClient(),[])
  const router=useRouter()
  const [notes,setNotes]=useState<any[]>([])
  const [requests,setRequests]=useState<any[]>([])

  async function load(){
    const {data:{user}}=await s.auth.getUser()
    if(!user)return
    const [{data:n},{data:r}]=await Promise.all([
      s.from('notifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50),
      s.from('connection_requests').select('id,sender_id,message,created_at,profiles!connection_requests_sender_id_fkey(display_name,avatar_url)').eq('receiver_id',user.id).eq('status','pending').order('created_at',{ascending:false})
    ])
    setNotes(n||[]);setRequests(r||[])
  }
  useEffect(()=>{
    let channel:any=null
    let disposed=false

    void (async()=>{
      const {data:{user}}=await s.auth.getUser()
      if(!user||disposed)return
      await load()
      channel=s
        .channel(`notifications-${user.id}`)
        .on('postgres_changes',{
          event:'*',
          schema:'public',
          table:'notifications',
          filter:`user_id=eq.${user.id}`,
        },()=>{void load()})
        .subscribe()
    })()

    return()=>{
      disposed=true
      if(channel)s.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[s])

  async function respond(id:string,action:'accept'|'ignore'){
    await s.rpc('respond_connection_request',{p_request:id,p_action:action})
    load()
  }

  function routeFor(x:any){
    const d=x?.data||{}
    if(d.conversation_id)return `/chats/${d.conversation_id}`
    if(d.space_id)return `/spaces/${d.space_id}`
    const person=d.from_user_id||d.sender_id||d.other_user_id||d.user_id
    if(person)return `/people/${person}`
    return null
  }

  async function openNote(x:any){
    if(!x.read_at){
      const now=new Date().toISOString()
      await s.from('notifications').update({read_at:now}).eq('id',x.id)
      setNotes(v=>v.map(n=>n.id===x.id?{...n,read_at:now}:n))
    }
    const href=routeFor(x)
    if(href)router.push(href)
  }

  return <AppShell><PageHeader title="الإشعارات"/><main className="space-y-4 p-4">
    {requests.length>0&&<section>
      <h2 className="mb-2 font-extrabold">طلبات التواصل</h2>
      <div className="space-y-2">{requests.map((x:any)=><Card key={x.id}><CardContent>
        <button onClick={()=>router.push(`/people/${x.sender_id}`)} className="tap-action flex w-full items-center gap-3 text-right">
          <div className="h-12 w-12 overflow-hidden rounded-full bg-[#eaf3fb]">{x.profiles?.avatar_url?<img src={x.profiles.avatar_url} alt="" className="h-full w-full object-cover"/>:null}</div>
          <div className="min-w-0 flex-1"><p className="font-bold">{x.profiles?.display_name||'مستخدم'}</p>{x.message&&<p className="mt-1 truncate text-sm text-slate-500">{x.message}</p>}</div>
          <ChevronLeft size={18} className="text-[#0e67f5]"/>
        </button>
        <div className="mt-3 flex gap-2"><Button size="sm" onClick={()=>respond(x.id,'accept')}>قبول</Button><Button size="sm" variant="outline" onClick={()=>respond(x.id,'ignore')}>تجاهل</Button></div>
      </CardContent></Card>)}</div>
    </section>}
    <section>
      <h2 className="mb-2 font-extrabold">آخر الإشعارات</h2>
      <div className="space-y-2">{notes.map(x=>{
        const href=routeFor(x)
        return <button key={x.id} type="button" onClick={()=>openNote(x)} disabled={!href} className={`tap-action block w-full text-right ${!href?'cursor-default':''}`}>
          <Card className={!x.read_at?'ring-1 ring-[#90c9ff]':''}><CardContent>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1"><p className="font-bold">{x.title}</p>{x.body&&<p className="mt-1 text-sm text-slate-500">{x.body}</p>}<p className="mt-2 text-[10px] text-slate-400">{new Date(x.created_at).toLocaleString('ar-EG')}</p></div>
              {href?<ChevronLeft size={18} className="mt-1 shrink-0 text-[#0e67f5]"/>:null}
            </div>
          </CardContent></Card>
        </button>
      })}{!notes.length&&<p className="py-10 text-center text-sm text-slate-500">لا توجد إشعارات حتى الآن.</p>}</div>
    </section>
  </main></AppShell>
}
