import {isApprovedChatMedia,type ChatCallRow,type ChatGiftItem} from '@/lib/chat-room'

export type ChatRoomSnapshot={
  authorized:boolean
  other:any|null
  gifts:ChatGiftItem[]
  partner:any|null
  messages:any[]
  call:ChatCallRow|null
}

export async function fetchChatRoomSnapshot(
  s:any,
  conversationId:string,
  userId:string
):Promise<ChatRoomSnapshot>{
  const {data:members}=await s
    .from('conversation_members')
    .select('user_id,profiles(display_name,avatar_url)')
    .eq('conversation_id',conversationId)

  if(!members?.some((member:any)=>member.user_id===userId)){
    return {
      authorized:false,
      other:null,
      gifts:[],
      partner:null,
      messages:[],
      call:null,
    }
  }

  const other=(members as any[]).find(member=>member.user_id!==userId)||null

  const [
    {data:giftRows},
    {data:partnerRow},
    {data:messageRows},
    {data:call},
  ]=await Promise.all([
    s.from('gift_catalog')
      .select('id,name_ar,emoji,price_stars,animation_tier')
      .eq('active',true)
      .order('price_stars'),
    s.rpc('conversation_partner_identity',{p_conversation:conversationId}),
    s.from('messages')
      .select('id,body,created_at,sender_id,message_type,media_path,media_duration_seconds,moderation_status,moderation_reason,gift_transaction_id,gift_id,gift_recipient_id')
      .eq('conversation_id',conversationId)
      .order('created_at',{ascending:true})
      .limit(300),
    s.from('voice_call_sessions')
      .select('*')
      .eq('conversation_id',conversationId)
      .in('status',['ringing','accepted'])
      .order('created_at',{ascending:false})
      .limit(1)
      .maybeSingle(),
  ])

  const partner=Array.isArray(partnerRow)?partnerRow[0]:partnerRow
  const rows=messageRows||[]
  const messages=await Promise.all(
    rows.map(async(message:any)=>{
      if(!isApprovedChatMedia(message))return message
      const {data}=await s.storage
        .from('chat-media-approved')
        .createSignedUrl(message.media_path,600)
      return {...message,signedUrl:data?.signedUrl||null}
    })
  )

  return {
    authorized:true,
    other,
    gifts:(giftRows||[]) as ChatGiftItem[],
    partner:partner||null,
    messages,
    call:(call||null) as ChatCallRow|null,
  }
}
