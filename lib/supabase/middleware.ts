import {createServerClient} from '@supabase/ssr'
import {NextResponse,type NextRequest} from 'next/server'
import {supabaseUrl,supabasePublishableKey} from './config'

type CookieItem={name:string;value:string;options?:any}

export async function updateSession(request:NextRequest){
  let response=NextResponse.next({request})

  const supabase=createServerClient(supabaseUrl,supabasePublishableKey,{cookies:{
    getAll(){return request.cookies.getAll()},
    setAll(items:CookieItem[]){
      items.forEach(({name,value})=>request.cookies.set(name,value))
      response=NextResponse.next({request})
      items.forEach(({name,value,options})=>response.cookies.set(name,value,options))
    }
  }})

  const {data:{user}}=await supabase.auth.getUser()
  const path=request.nextUrl.pathname

  const anonymousAllowed=
    path.startsWith('/login')
    ||path.startsWith('/signup')
    ||path.startsWith('/auth/callback')

  if(!user&&!anonymousAllowed){
    const u=request.nextUrl.clone()
    u.pathname='/login'
    u.search=''
    return NextResponse.redirect(u)
  }

  if(user){
    const {data:aal}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const requiresMfa=aal?.nextLevel==='aal2'&&aal.currentLevel!=='aal2'

    if(requiresMfa&&path!=='/mfa'){
      const u=request.nextUrl.clone()
      u.pathname='/mfa'
      u.search=''
      if(!path.startsWith('/login')&&!path.startsWith('/signup')&&!path.startsWith('/auth/callback')){
        u.searchParams.set('next',path)
      }
      return NextResponse.redirect(u)
    }

    if(!requiresMfa&&(path==='/login'||path==='/signup'||path==='/mfa')){
      const u=request.nextUrl.clone()
      u.pathname='/home'
      u.search=''
      return NextResponse.redirect(u)
    }
  }

  return response
}
