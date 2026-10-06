import {createHmac} from 'node:crypto'

export type IceServerConfig={
  urls:string|string[]
  username?:string
  credential?:string
}

const DEFAULT_STUN:IceServerConfig={
  urls:['stun:stun.l.google.com:19302'],
}

function csv(value:string|undefined){
  return (value||'')
    .split(',')
    .map(item=>item.trim())
    .filter(Boolean)
}

export function createRtcIceServerPayload(userId:string){
  const turnUrls=csv(process.env.TURN_URLS)
  const secret=process.env.TURN_SHARED_SECRET
  const iceServers:IceServerConfig[]=[DEFAULT_STUN]

  if(turnUrls.length&&secret){
    const expiresAt=Math.floor(Date.now()/1000)+60*60
    const username=`${expiresAt}:${userId}`
    const credential=createHmac('sha1',secret)
      .update(username)
      .digest('base64')

    iceServers.push({
      urls:turnUrls,
      username,
      credential,
    })
  }

  return {
    iceServers,
    turnConfigured:Boolean(turnUrls.length&&secret),
  }
}
