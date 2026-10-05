import type {ChatCallRow,ChatGiftItem} from '@/lib/chat-room'

type SupabaseClientLike=any

export async function fetchConversationPartnerIdentity(
  s:SupabaseClientLike,
  conversationId:string
){
  const {data}=await s.rpc('conversation_partner_identity',{p_conversation:conversationId})
  return Array.isArray(data)?data[0]:data
}

export async function transferStarsToPublicUser(
  s:SupabaseClientLike,
  publicUserId:string,
  amount:number,
  clientReferenceId:string
){
  return s.rpc('transfer_stars_by_user_id',{
    p_public_user_id:publicUserId,
    p_amount:amount,
    p_client_reference_id:clientReferenceId,
  })
}

export async function fetchPrivatePhotoTools(
  s:SupabaseClientLike,
  targetId:string
){
  const [{data:status},{data:photos}]=await Promise.all([
    s.rpc('private_photo_reveal_status',{p_target:targetId}),
    s.rpc('mutually_revealed_private_photos',{p_target:targetId}),
  ])
  return {
    status:Array.isArray(status)?status[0]:status,
    photos:photos||[],
  }
}

export async function consentPrivatePhotos(
  s:SupabaseClientLike,
  targetId:string
){
  return s.rpc('set_private_photo_reveal_consent',{
    p_target:targetId,
    p_consent:true,
  })
}

export async function requestSpeedIntro(
  s:SupabaseClientLike,
  targetId:string
){
  return s.rpc('request_speed_intro',{p_target:targetId})
}

export async function startDuoChallenge(
  s:SupabaseClientLike,
  conversationId:string
){
  return s.rpc('start_duo_challenge_v2',{p_conversation:conversationId})
}

export async function fetchConversationPrompt(
  s:SupabaseClientLike,
  conversationId:string,
  kind:'surprise'|'restart'
){
  const fn=kind==='surprise'?'conversation_surprise_prompt':'smart_restart_prompt'
  return s.rpc(fn,{p_conversation:conversationId})
}

export async function insertChatTextMessage(
  s:SupabaseClientLike,
  conversationId:string,
  senderId:string,
  body:string
){
  return s.from('messages').insert({
    conversation_id:conversationId,
    sender_id:senderId,
    body,
    message_type:'text',
  }).select(
    'id,body,created_at,sender_id,message_type,media_path,media_duration_seconds,moderation_status,moderation_reason,gift_transaction_id,gift_id,gift_recipient_id'
  ).single()
}

export async function sendConversationGift(
  s:SupabaseClientLike,
  conversationId:string,
  targetId:string,
  gift:ChatGiftItem
){
  return s.rpc('send_gift',{
    p_target:targetId,
    p_gift:gift.id,
    p_conversation:conversationId,
  })
}

export async function requestConversationCall(
  s:SupabaseClientLike,
  conversationId:string,
  kind:'voice'|'video'
){
  const {data,error}=await s.rpc('request_chat_call',{
    p_conversation:conversationId,
    p_kind:kind,
  })
  if(error)return {data:null,error,row:null}
  const {data:row}=await s
    .from('voice_call_sessions')
    .select('*')
    .eq('id',data)
    .single()

  return {data,error:null,row:(row||null) as ChatCallRow|null}
}

export async function respondConversationCall(
  s:SupabaseClientLike,
  callId:string,
  accept:boolean
){
  await s.rpc('respond_voice_call',{
    p_call:callId,
    p_accept:accept,
  })

  if(!accept)return null

  const {data:row}=await s
    .from('voice_call_sessions')
    .select('*')
    .eq('id',callId)
    .single()

  return (row||null) as ChatCallRow|null
}

export async function endConversationCall(
  s:SupabaseClientLike,
  callId:string
){
  return s.rpc('end_voice_call',{p_call:callId})
}
