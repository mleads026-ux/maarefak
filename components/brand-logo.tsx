type Props={size?:number;className?:string}
export function BrandLogo({size=52,className=''}:Props){
  return <img
    src="/brand/lammetna-logo.png"
    alt="لمتنا"
    width={size}
    height={size}
    draggable={false}
    className={`shrink-0 object-cover ${className}`}
    style={{width:size,height:size,borderRadius:Math.max(12,Math.round(size*.24))}}
  />
}
