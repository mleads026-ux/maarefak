export function subscribeLammaRoomRealtime(
  s:any,
  id:string,
  onMessagesRefresh:()=>void|Promise<void>,
  onRoomRefresh:()=>void|Promise<void>,
){
  return s.channel(`lamma-room-ui-${id}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'space_messages',filter:`space_id=eq.${id}`},()=>{void onMessagesRefresh()})
    .on('postgres_changes',{event:'*',schema:'public',table:'space_members',filter:`space_id=eq.${id}`},()=>{void onRoomRefresh()})
    .on('postgres_changes',{event:'*',schema:'public',table:'space_seats',filter:`space_id=eq.${id}`},()=>{void onRoomRefresh()})
    .on('postgres_changes',{event:'*',schema:'public',table:'space_pair_spotlights',filter:`space_id=eq.${id}`},()=>{void onRoomRefresh()})
    .on('postgres_changes',{event:'*',schema:'public',table:'space_star_seat_requests',filter:`space_id=eq.${id}`},()=>{void onRoomRefresh()})
    .on('postgres_changes',{event:'*',schema:'public',table:'space_mic_queue',filter:`space_id=eq.${id}`},()=>{void onRoomRefresh()})
    .subscribe()
}
