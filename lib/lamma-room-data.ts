import type {LammaGiftItem,LammaMember,LammaVoiceParticipant} from '@/lib/lamma-room'

export type LammaRoomSnapshot={
  space:any
  messages:any[]
  members:LammaMember[]
  voiceMembers:LammaVoiceParticipant[]
  gifts:LammaGiftItem[]
  privateContactPrice:number|null
  seats:any[]
  starRequests:any[]
  spotlight:any
  voiceRequestStatus:'none'|'pending'|'accepted'|'rejected'|'host'
  voiceRequests:any[]
  isHost:boolean
}

export async function fetchLammaRoomSnapshot(
  s:any,
  id:string,
  userId:string
):Promise<LammaRoomSnapshot>{
  const [
    {data:sp},
    {data:ms},
    {data:memberRows},
    {data:voiceRows},
    {data:giftRows},
    {data:priceRow},
    {data:seatRows},
    {data:reqRows},
    {data:spotRow},
  ]=await Promise.all([
    s.from('spaces').select('id,name,emoji,is_public,owner_id,seat_count,description,public_lamma_id').eq('id',id).single(),
    s.from('space_messages')
      .select('id,body,created_at,sender_id,message_type,gift_transaction_id,gift_id,gift_recipient_id,profiles!space_messages_sender_id_fkey(display_name,avatar_url)')
      .eq('space_id',id).order('created_at',{ascending:true}).limit(200),
    s.from('space_members').select('user_id,role,profiles(display_name,avatar_url,mood)').eq('space_id',id),
    s.from('space_voice_participants').select('user_id,mic_enabled,profiles(display_name,avatar_url)').eq('space_id',id),
    s.from('gift_catalog').select('id,name_ar,emoji,price_stars,animation_tier').eq('active',true).order('price_stars'),
    s.from('feature_prices').select('price_stars').eq('key','private_contact_from_lamma').maybeSingle(),
    s.from('space_seats').select('space_id,seat_no,user_id,seat_type,profiles(display_name,avatar_url)').eq('space_id',id).order('seat_no'),
    s.from('space_star_seat_requests')
      .select('id,requester_id,cost_stars,status,profiles!space_star_seat_requests_requester_id_fkey(display_name,avatar_url)')
      .eq('space_id',id).eq('status','pending').order('created_at'),
    s.from('space_pair_spotlights').select('*').eq('space_id',id).eq('status','active').order('started_at',{ascending:false}).limit(1).maybeSingle(),
  ])

  const isHost=sp?.owner_id===userId
  const {data:voiceStatus}=await s.rpc('my_lamma_voice_request_status',{p_space:id})
  let voiceRequests:any[]=[]
  if(isHost){
    const {data:pendingVoice}=await s.rpc('host_lamma_voice_requests',{p_space:id})
    voiceRequests=(pendingVoice||[]) as any[]
  }

  return {
    space:sp,
    messages:ms||[],
    members:(memberRows||[]) as LammaMember[],
    voiceMembers:(voiceRows||[]) as LammaVoiceParticipant[],
    gifts:(giftRows||[]) as LammaGiftItem[],
    privateContactPrice:priceRow?.price_stars==null?null:Number(priceRow.price_stars),
    seats:seatRows||[],
    starRequests:reqRows||[],
    spotlight:spotRow||null,
    voiceRequestStatus:((voiceStatus as any)||'none') as LammaRoomSnapshot['voiceRequestStatus'],
    voiceRequests,
    isHost,
  }
}
