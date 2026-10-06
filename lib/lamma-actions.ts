import type {LammaGiftItem,LammaMember} from '@/lib/lamma-room'

export async function createLammaTextMessage(
  s:any,
  spaceId:string,
  userId:string,
  text:string
){
  return s.from('space_messages')
    .insert({space_id:spaceId,sender_id:userId,body:text,message_type:'text'})
    .select('id,body,created_at,sender_id,message_type,gift_transaction_id,gift_id,gift_recipient_id')
    .single()
}

export async function requestLammaPrivateContact(
  s:any,
  spaceId:string,
  target:LammaMember
){
  return s.rpc('request_private_contact_from_space',{
    p_space:spaceId,
    p_target:target.user_id,
    p_message:null,
  })
}

export async function sendLammaGift(
  s:any,
  spaceId:string,
  gift:LammaGiftItem,
  recipient:LammaMember,
  mode:'profile'|'chat'
){
  return mode==='chat'
    ? s.rpc('send_lamma_chat_gift',{p_space:spaceId,p_gift:gift.id})
    : s.rpc('send_gift',{p_target:recipient.user_id,p_gift:gift.id,p_space:spaceId})
}

export async function assignLammaRoyal(
  s:any,
  spaceId:string,
  target:LammaMember
){
  return s.rpc('host_assign_royal',{p_space:spaceId,p_target:target.user_id})
}

export async function requestLammaRoyalSeat(s:any,spaceId:string){
  return s.rpc('request_star_seat',{p_space:spaceId})
}

export async function respondLammaRoyalSeat(
  s:any,
  requestId:string,
  accept:boolean
){
  return s.rpc('respond_star_seat_request',{p_request:requestId,p_accept:accept})
}

export type LammaRoyalAction='mute_voice'|'unmute_voice'|'mute_text'|'unmute_text'|'kick'

export async function controlLammaMember(
  s:any,
  spaceId:string,
  targetId:string,
  action:LammaRoyalAction
){
  return s.rpc('royal_control_lamma_member',{
    p_space:spaceId,
    p_target:targetId,
    p_action:action,
  })
}

export async function setLammaPairSpotlight(
  s:any,
  spaceId:string,
  userA:string,
  userB:string
){
  return s.rpc('royal_set_lamma_pair_spotlight',{
    p_space:spaceId,
    p_user_a:userA,
    p_user_b:userB,
  })
}
