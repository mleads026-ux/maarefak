import type {ChatCallRow} from '@/lib/chat-room'

export type CallFeedMessage={
  id:string
  body:string|null
  created_at?:string|null
  sender_id:string
  message_type:string
  gift_id?:string|null
  gift_recipient_id?:string|null
  star_transfer_id?:string|null
}

export type CallPartner={
  user_id:string
  public_user_id?:string|null
  display_name?:string|null
  avatar_url?:string|null
  is_online?:boolean
  last_seen_at?:string|null
}

export const CALL_FEED_SELECT='id,body,created_at,sender_id,message_type,gift_id,gift_recipient_id,star_transfer_id'

export function upsertCallFeedMessage(
  current:CallFeedMessage[],
  row:CallFeedMessage,
  limit=40,
){
  if(current.some(item=>item.id===row.id))return current
  return [...current,row].slice(-limit)
}

export function isCallValueEvent(row:CallFeedMessage,userId:string){
  return row.sender_id!==userId
    && (row.message_type==='gift'||row.message_type==='star_transfer')
}

export function isTerminalCallStatus(status:ChatCallRow['status']){
  return status==='rejected'||status==='ended'||status==='missed'
}

export function terminalCallNotice(status:ChatCallRow['status']){
  if(status==='rejected')return 'تم رفض المكالمة.'
  if(status==='missed')return 'لم يتم الرد على المكالمة.'
  return 'انتهت المكالمة.'
}

export function getCallLabel(
  activeCall:ChatCallRow|null,
  incomingCall:ChatCallRow|null,
){
  if(activeCall){
    if(activeCall.status==='ringing'){
      return activeCall.call_kind==='video'
        ?'جارٍ الاتصال بالفيديو...'
        :'جارٍ الاتصال...'
    }
    return activeCall.call_kind==='video'
      ?'مكالمة فيديو متصلة'
      :'مكالمة صوتية متصلة'
  }

  if(incomingCall){
    return incomingCall.call_kind==='video'
      ?'مكالمة فيديو واردة'
      :'مكالمة صوتية واردة'
  }

  return ''
}

export function callRequestError(
  kind:'voice'|'video',
  message:string|undefined,
){
  if(message?.includes('user_already_in_call')){
    return 'أنت أو الطرف الآخر موجود بالفعل في مكالمة أخرى.'
  }
  if(message?.includes('blocked'))return 'لا يمكن بدء مكالمة مع هذا المستخدم.'
  return kind==='video'
    ?'تعذر بدء مكالمة الفيديو الآن.'
    :'تعذر بدء المكالمة الصوتية الآن.'
}

export function callResponseError(message:string|undefined){
  if(message?.includes('user_already_in_call')){
    return 'تعذر قبول المكالمة لأن أحد الطرفين دخل في مكالمة أخرى.'
  }
  if(message?.includes('call_not_available')){
    return 'المكالمة لم تعد متاحة.'
  }
  return 'تعذر تحديث حالة المكالمة.'
}

export function callGiftError(message:string|undefined){
  if(message?.includes('promotional_stars_not_transferable')){
    return 'النجوم الترويجية لا يمكن تحويلها إلى أرباح عن طريق الهدايا.'
  }
  if(message?.includes('insufficient_stars')){
    return 'رصيد النجوم غير كافٍ لإرسال الهدية.'
  }
  return 'تعذر إرسال الهدية.'
}
