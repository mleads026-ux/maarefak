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
      <span aria-hidden="true" className="auth-live-hero__glow"/>
      <span aria-hidden="true" className="auth-live-hero__sheen"/>
      <span aria-hidden="true" className="auth-icon-ring-eraser"/>
      <img aria-hidden="true" src={src} alt="" className="auth-icon-ring-live select-none" draggable={false}/>
    </>:null}
    {children}
  </div>
}
