import {AuthLayeredAppIcon} from '@/components/auth-layered-app-icon'

type Props={
  src:string
  alt:string
  className?:string
  children?:React.ReactNode
  liveIcon?:'login'|'signup'
}

export function PixelHeroImage({src,alt,className='',children,liveIcon}:Props){
  return <div
    className={`relative overflow-hidden ${className} ${liveIcon?'auth-live-hero':''}`}
    data-auth-hero={liveIcon||undefined}
  >
    <img src={src} alt={alt} className="block h-auto w-full select-none" draggable={false}/>
    {liveIcon?<>
      {liveIcon==='signup'?<>
        <span aria-hidden="true" className="auth-live-hero__glow"/>
        <span aria-hidden="true" className="auth-live-hero__sheen"/>
      </>:null}
      <AuthLayeredAppIcon/>
    </>:null}
    {children}
  </div>
}
