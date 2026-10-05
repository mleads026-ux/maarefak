export type AuthCooldownState={
  failures:number
  blockedUntil:number
}

const keyFor=(scope:string,identity:string)=>`lammetna-auth:${scope}:${identity.trim().toLowerCase()}`

export function getAuthCooldown(scope:string,identity:string){
  if(typeof window==='undefined'||!identity.trim())return 0
  try{
    const raw=localStorage.getItem(keyFor(scope,identity))
    if(!raw)return 0
    const state=JSON.parse(raw) as AuthCooldownState
    return Math.max(0,Number(state.blockedUntil||0)-Date.now())
  }catch{return 0}
}

export function registerAuthFailure(scope:string,identity:string){
  if(typeof window==='undefined'||!identity.trim())return 0
  const key=keyFor(scope,identity)
  let state:AuthCooldownState={failures:0,blockedUntil:0}
  try{
    const raw=localStorage.getItem(key)
    if(raw)state=JSON.parse(raw)
  }catch{}

  const failures=Math.max(0,Number(state.failures||0))+1
  let delay=0
  if(failures>=10)delay=30*60_000
  else if(failures>=8)delay=10*60_000
  else if(failures>=6)delay=2*60_000
  else if(failures>=5)delay=30_000

  const next={failures,blockedUntil:delay?Date.now()+delay:0}
  localStorage.setItem(key,JSON.stringify(next))
  return delay
}

export function clearAuthFailures(scope:string,identity:string){
  if(typeof window==='undefined'||!identity.trim())return
  localStorage.removeItem(keyFor(scope,identity))
}

export function formatCooldown(ms:number){
  const sec=Math.max(1,Math.ceil(ms/1000))
  if(sec<60)return `${sec} ثانية`
  const min=Math.ceil(sec/60)
  return `${min} دقيقة`
}
