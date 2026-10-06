import {createHmac} from 'node:crypto'
import {NextResponse} from 'next/server'
import {createClient} from '@/lib/supabase/server'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const DEFAULT_STUN=['stun:stun.l.google.com:19302']

function csv(value:string|undefined){
  return (value||'')
    .split(',')
    .map(item=>item.trim())
    .filter(Boolean)
}

export async function GET(){
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()

  if(!user){
    return NextResponse.json({error:'not_authenticated'},{status:401})
  }

  const turnUrls=csv(process.env.TURN_URLS)
  const secret=process.env.TURN_SHARED_SECRET
  const iceServers:RTCIceServer[]=[{urls:DEFAULT_STUN}]

  if(turnUrls.length&&secret){
    const expiresAt=Math.floor(Date.now()/1000)+60*60
    const username=`${expiresAt}:${user.id}`
    const credential=createHmac('sha1',secret)
      .update(username)
      .digest('base64')

    iceServers.push({
      urls:turnUrls,
      username,
      credential,
    })
  }

  return NextResponse.json(
    {
      iceServers,
      turnConfigured:Boolean(turnUrls.length&&secret),
    },
    {
      headers:{
        'Cache-Control':'no-store, private',
      },
    }
  )
}
