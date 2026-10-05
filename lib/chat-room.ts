export type ChatCallRow={
  id:string
  conversation_id:string
  caller_id:string
  callee_id:string
  status:'ringing'|'accepted'|'rejected'|'ended'|'missed'
  call_kind:'voice'|'video'
}

export type ChatGiftItem={
  id:string
  name_ar:string
  emoji:string
  price_stars:number
  animation_tier?:string
}

export function calculateStarTransferBreakdown(value:string|number){
  const gross=Math.max(0,Number(value)||0)
  const fee=gross?Math.ceil(gross*0.15):0
  const net=Math.max(0,gross-fee)
  return {gross,fee,net}
}

export function isApprovedChatMedia(message:any){
  return (
    ['image','video'].includes(message?.message_type)
    && message?.moderation_status==='approved'
    && Boolean(message?.media_path)
  )
}
