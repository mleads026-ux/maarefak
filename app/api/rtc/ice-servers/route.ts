import {NextResponse} from 'next/server'
import {createRtcIceServerPayload} from '@/lib/rtc-server'
import {createClient} from '@/lib/supabase/server'

export const runtime='nodejs'
export const dynamic='force-dynamic'

export async function GET(){
  const s=await createClient()
  const {data:{user}}=await s.auth.getUser()

  if(!user){
    return NextResponse.json({error:'not_authenticated'},{status:401})
  }

  return NextResponse.json(
    createRtcIceServerPayload(user.id),
    {headers:{'Cache-Control':'no-store, private'}},
  )
}
