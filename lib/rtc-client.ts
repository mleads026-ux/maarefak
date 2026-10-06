'use client'

const FALLBACK_ICE_SERVERS:RTCIceServer[]=[
  {urls:'stun:stun.l.google.com:19302'},
]

function validIceServer(value:any):value is RTCIceServer{
  if(!value||typeof value!=='object')return false
  const urls=value.urls
  return typeof urls==='string'
    || (Array.isArray(urls)&&urls.length>0&&urls.every((item:any)=>typeof item==='string'))
}

export async function loadRtcIceServers(){
  try{
    const response=await fetch('/api/rtc/ice-servers',{
      cache:'no-store',
      credentials:'same-origin',
    })
    if(!response.ok)return FALLBACK_ICE_SERVERS

    const payload=await response.json()
    if(!Array.isArray(payload?.iceServers))return FALLBACK_ICE_SERVERS

    const servers=payload.iceServers.filter(validIceServer)
    return servers.length?servers:FALLBACK_ICE_SERVERS
  }catch{
    return FALLBACK_ICE_SERVERS
  }
}
