import type {ChatCallRow} from '@/lib/chat-room'

export function subscribeChatMessages(
  s:any,
  conversationId:string,
  onRefresh:()=>void|Promise<void>
){
  return s
    .channel(`chat-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event:'INSERT',
        schema:'public',
        table:'messages',
        filter:`conversation_id=eq.${conversationId}`,
      },
      ()=>onRefresh()
    )
    .on(
      'postgres_changes',
      {
        event:'UPDATE',
        schema:'public',
        table:'messages',
        filter:`conversation_id=eq.${conversationId}`,
      },
      ()=>onRefresh()
    )
    .subscribe()
}

export function subscribeChatCalls(
  s:any,
  conversationId:string,
  userId:string,
  onCallRow:(row:ChatCallRow)=>void
){
  return s
    .channel(`voice-call-${conversationId}-${userId}`)
    .on(
      'postgres_changes',
      {
        event:'INSERT',
        schema:'public',
        table:'voice_call_sessions',
        filter:`conversation_id=eq.${conversationId}`,
      },
      (payload:any)=>onCallRow(payload.new as ChatCallRow)
    )
    .on(
      'postgres_changes',
      {
        event:'UPDATE',
        schema:'public',
        table:'voice_call_sessions',
        filter:`conversation_id=eq.${conversationId}`,
      },
      (payload:any)=>onCallRow(payload.new as ChatCallRow)
    )
    .subscribe()
}
