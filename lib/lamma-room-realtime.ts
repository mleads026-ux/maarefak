export function subscribeLammaRoomRealtime(
  s:any,
  id:string,
  onRefresh:()=>void|Promise<void>
){
  return s.channel(`lamma-room-ui-${id}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'space_messages',filter:`space_id=eq.${id}`},()=>onRefresh())
    .on('postgres_changes',{event:'*',schema:'public',table:'space_members',filter:`space_id=eq.${id}`},()=>onRefresh())
    .on('postgres_changes',{event:'*',schema:'public',table:'space_seats',filter:`space_id=eq.${id}`},()=>onRefresh())
    .on('postgres_changes',{event:'*',schema:'public',table:'space_pair_spotlights',filter:`space_id=eq.${id}`},()=>onRefresh())
    .on('postgres_changes',{event:'*',schema:'public',table:'space_star_seat_requests',filter:`space_id=eq.${id}`},()=>onRefresh())
    .on('postgres_changes',{event:'*',schema:'public',table:'space_mic_queue',filter:`space_id=eq.${id}`},()=>onRefresh())
    .subscribe()
}
