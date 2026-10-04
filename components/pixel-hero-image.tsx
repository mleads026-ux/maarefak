type Props={src:string;alt:string;className?:string;children?:React.ReactNode}
export function PixelHeroImage({src,alt,className='',children}:Props){
  return <div className={`relative overflow-hidden ${className}`}>
    <img src={src} alt={alt} className="block h-auto w-full select-none" draggable={false}/>
    {children}
  </div>
}
