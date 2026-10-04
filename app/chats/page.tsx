import {redirect} from 'next/navigation'
import {createClient} from '@/lib/supabase/server'
import {AppShell} from '@/components/app-shell'
import {ChatsExperience} from '@/components/chats-experience'

export default async function Chats(){
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()
  if(!user)redirect('/login')

  const [{data:own},{data:people}]=await Promise.all([
    s.from('conversation_members').select('conversation_id').eq('user_id',user.id),
    s.from('profiles').select('id,display_name,avatar_url').neq('id',user.id).eq('profile_complete',true).eq('discoverable',true).limit(3),
  ])
  const ids=(own||[]).map((x:any)=>x.conversation_id)
  let rows:any[]=[]
  if(ids.length){
    const [{data:members},{data:messages}]=await Promise.all([
      s.from('conversation_members').select('conversation_id,user_id,profiles(display_name,avatar_url,is_online)').in('conversation_id',ids),
      s.from('messages').select('conversation_id,body,created_at,sender_id,message_type,read_at,media_path').in('conversation_id',ids).order('created_at',{ascending:false}),
    ])
    rows=ids.map(id=>{
      const ownMsgs=(messages||[]).filter((m:any)=>m.conversation_id===id)
      return {
        id,
        other:(members||[]).find((m:any)=>m.conversation_id===id&&m.user_id!==user.id),
        last:ownMsgs[0]||null,
        unread:ownMsgs.filter((m:any)=>m.sender_id!==user.id&&!m.read_at).length,
      }
    })
  }

  return <AppShell><ChatsExperience rows={rows} people={people||[]}/></AppShell>
}
