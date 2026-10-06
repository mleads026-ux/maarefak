export function StatusBarMock({light=false}:{light?:boolean}){
  return <div dir="ltr" className={`reference-status h-8 items-center justify-between px-6 text-[14px] font-black ${light?'text-white':'text-[#08122d]'}`}>
    <span>9:41</span>
    <div className="flex items-center gap-2">
      <span className="flex items-end gap-[2px]">
        <i className="block h-1.5 w-[3px] rounded-sm bg-current"/>
        <i className="block h-2.5 w-[3px] rounded-sm bg-current"/>
        <i className="block h-3.5 w-[3px] rounded-sm bg-current"/>
        <i className="block h-[18px] w-[3px] rounded-sm bg-current"/>
      </span>
      <span className="text-[16px]">⌁</span>
      <span className="inline-block h-[12px] w-[24px] rounded-[4px] border-2 border-current p-[1px]"><i className="block h-full w-[16px] rounded-[2px] bg-current"/></span>
    </div>
  </div>
}
