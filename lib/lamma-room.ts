export type LammaMember={
  user_id:string
  role:string
  profiles:{
    display_name:string|null
    avatar_url:string|null
    mood:string|null
  }|null
}

export type LammaVoiceParticipant={
  user_id:string
  mic_enabled:boolean
  profiles:{
    display_name:string|null
    avatar_url:string|null
  }|null
}

export type LammaGiftItem={
  id:string
  name_ar:string
  emoji:string
  price_stars:number
  animation_tier:string
}

export const lammaFallbackAvatars=[
  '/demo/face-1.jpg',
  '/demo/face-2.jpg',
  '/demo/face-3.jpg',
  '/demo/face-4.jpg',
]

export function findLammaMember(
  members:LammaMember[],
  userId?:string|null
):LammaMember|null{
  if(!userId)return null
  return members.find(member=>member.user_id===userId)||null
}

export function findLammaVoiceParticipant(
  voiceMembers:LammaVoiceParticipant[],
  userId:string
):LammaVoiceParticipant|undefined{
  return voiceMembers.find(member=>member.user_id===userId)
}

export function buildLammaGuestLayout(
  members:LammaMember[],
  royalId?:string|null,
  challengeAId?:string|null,
  challengeBId?:string|null
){
  const royalMember=findLammaMember(members,royalId)
  const challengeA=findLammaMember(members,challengeAId)
  const challengeB=findLammaMember(members,challengeBId)
  const reserved=new Set(
    [royalId,challengeAId,challengeBId].filter((value):value is string=>Boolean(value))
  )

  return {
    royalMember,
    challengeA,
    challengeB,
    otherGuests:members.filter(member=>!reserved.has(member.user_id)).slice(0,8),
    orderedGuests:[
      ...(royalMember?[royalMember]:[]),
      ...(challengeA?[challengeA]:[]),
      ...(challengeB?[challengeB]:[]),
      ...members.filter(member=>!reserved.has(member.user_id)),
    ],
  }
}
