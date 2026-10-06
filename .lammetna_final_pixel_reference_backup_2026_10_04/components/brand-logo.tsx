type Props={size?:number;className?:string}
export function BrandLogo({size=56,className=''}:Props){
  return <div style={{width:size,height:size}} className={`relative grid shrink-0 place-items-center overflow-hidden rounded-[26%] bg-gradient-to-br from-[#1FE0E7] via-[#1679F2] to-[#D400FF] shadow-[0_12px_30px_rgba(87,79,255,.28)] ${className}`}>
    <svg viewBox="0 0 100 100" className="h-[76%] w-[76%] text-white" fill="none" aria-hidden="true">
      <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="5"/>
      <g fill="currentColor">
        <circle cx="50" cy="10" r="4"/><circle cx="68" cy="15" r="4"/><circle cx="82" cy="29" r="4"/>
        <circle cx="90" cy="50" r="4"/><circle cx="82" cy="71" r="4"/><circle cx="68" cy="85" r="4"/>
        <circle cx="50" cy="90" r="4"/><circle cx="32" cy="85" r="4"/><circle cx="18" cy="71" r="4"/>
        <circle cx="10" cy="50" r="4"/><circle cx="18" cy="29" r="4"/><circle cx="32" cy="15" r="4"/>
      </g>
      <path d="M38 31c3-2 6-1 8 3l4 8c1 2 1 4-1 6l-5 5c5 9 11 15 20 20l5-5c2-2 4-2 6-1l8 4c4 2 5 5 3 8-3 5-8 8-14 8-15 0-43-28-43-43 0-6 3-11 9-13Z" fill="currentColor"/>
    </svg>
  </div>
}
