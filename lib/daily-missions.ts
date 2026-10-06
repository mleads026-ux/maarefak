export const ONE_TIME_CLAIM_DATE='1970-01-01'

export type DailyMissionCadence='daily'|'once'

export type DailyMissionDefinition={
  code:string
  title_ar:string
  description_ar:string
  reward_stars:number
  cadence:DailyMissionCadence
}

export type DailyMissionClaim={
  mission_code:string
  claim_date:string
}

export type DailyMission=DailyMissionDefinition&{
  claimed:boolean
}

const MISSION_ORDER:Record<string,number>={
  complete_profile:0,
  answer_daily:1,
  join_lamma:2,
  send_message:3,
}

export function prepareDailyMissions(
  definitions:DailyMissionDefinition[],
  claims:DailyMissionClaim[]
):DailyMission[]{
  const claimedCodes=new Set(claims.map(claim=>claim.mission_code))

  return definitions
    .map(mission=>({...mission,claimed:claimedCodes.has(mission.code)}))
    .sort((a,b)=>(MISSION_ORDER[a.code]??99)-(MISSION_ORDER[b.code]??99))
}
