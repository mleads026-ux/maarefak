import type {DailyMission} from '@/lib/daily-missions'

type Props={
  mission:DailyMission
  busy:boolean
  onClaim:(code:string)=>void
}

export function DailyMissionRow({mission,busy,onClaim}:Props){
  return <div className="flex items-center justify-between rounded-[17px] bg-[#f4f8fc] p-3">
    <div className="min-w-0 flex-1 pl-3">
      <p className="text-sm font-black">{mission.title_ar}</p>
      <p className="text-[10px] font-bold text-[#77839a]">{mission.description_ar}</p>
      {mission.cadence==='once'
        ?<p className="mt-1 text-[10px] font-black text-[#9a6b00]">تُمنح هذه النجوم مرة واحدة فقط.</p>
        :null}
    </div>
    <button
      disabled={busy||mission.claimed}
      onClick={()=>onClaim(mission.code)}
      className={`tap-action shrink-0 rounded-full px-3 py-2 text-xs font-black ${mission.claimed?'bg-[#e8eef4] text-[#8290a4]':'bg-[#fff4c6] text-[#8c6200]'}`}
    >
      {mission.claimed?'تم':`+${mission.reward_stars} ⭐ ترويجية`}
    </button>
  </div>
}
