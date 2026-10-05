import {createServerClient} from '@supabase/ssr'
import {NextResponse,type NextRequest} from 'next/server'
import {supabaseUrl,supabasePublishableKey} from './config'

type CookieItem={name:string;value:string;options?:any}

function redirect(request:NextRequest,path:string,source?:NextResponse){
  const u=request.nextUrl.clone()
  u.pathname=path
  u.search=''
  const target=NextResponse.redirect(u)
  source?.cookies.getAll().forEach(cookie=>target.cookies.set(cookie))
  return target
}

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
  const authCallback=path.startsWith('/auth/callback')
  const signedOutPath=path.startsWith('/login')||path.startsWith('/signup')
  const legalPath=path==='/legal'||path.startsWith('/legal/')
  const onboardingPath=path==='/onboarding'||path.startsWith('/onboarding/')
  const publicPath=signedOutPath||authCallback||path==='/manifest.webmanifest'

  if(!user&&!publicPath)return redirect(request,'/login',response)
  if(!user)return response

  if(authCallback)return response

  const [{data:needsLegal,error:legalError},{data:profile,error:profileError}]=await Promise.all([
    supabase.rpc('needs_current_legal_acceptance'),
    supabase.from('profiles').select('profile_complete').eq('id',user.id).maybeSingle(),
  ])

  if((legalError||needsLegal===true)&&!legalPath){
    return redirect(request,'/legal',response)
  }

  if(!legalError&&needsLegal===false){
    const profileComplete=!profileError&&profile?.profile_complete===true

    if(!profileComplete&&!onboardingPath){
      return redirect(request,'/onboarding',response)
    }

    if(profileComplete&&(signedOutPath||onboardingPath||legalPath)){
      return redirect(request,'/home',response)
    }
  }

  if(signedOutPath){
    return redirect(request,'/legal',response)
  }

  return response
}
