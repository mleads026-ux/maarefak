create or replace function public.royal_control_lamma_member(
  p_space uuid,
  p_target uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_royal uuid := auth.uid();
  v_owner uuid;
begin
  if v_royal is null then raise exception 'not_authenticated'; end if;

  select owner_id into v_owner from public.spaces where id=p_space;
  if v_owner is null then raise exception 'space_not_found'; end if;

  if not exists(
    select 1 from public.space_seats
    where space_id=p_space and user_id=v_royal and seat_type='star'
  ) then raise exception 'royal_only'; end if;

  if p_target=v_royal then raise exception 'cannot_moderate_self'; end if;
  if p_target=v_owner then raise exception 'cannot_moderate_owner'; end if;

  if not exists(
    select 1 from public.space_members where space_id=p_space and user_id=p_target
  ) then raise exception 'target_not_in_lamma'; end if;

  insert into public.space_member_moderation(space_id,user_id,reason,updated_by)
  values(p_space,p_target,'إجراء من الضيف الملكي',v_royal)
  on conflict(space_id,user_id) do nothing;

  if p_action='mute_voice' then
    update public.space_member_moderation
       set voice_muted_until=now()+interval '24 hours',
           reason='كتم الميكروفون بواسطة الضيف الملكي',
           updated_by=v_royal,updated_at=now()
     where space_id=p_space and user_id=p_target;
    update public.space_voice_participants
       set mic_enabled=false,last_seen_at=now()
     where space_id=p_space and user_id=p_target;

  elsif p_action='unmute_voice' then
    update public.space_member_moderation
       set voice_muted_until=null,
           reason='فتح الميكروفون بواسطة الضيف الملكي',
           updated_by=v_royal,updated_at=now()
     where space_id=p_space and user_id=p_target;
    update public.space_voice_participants
       set mic_enabled=true,last_seen_at=now()
     where space_id=p_space and user_id=p_target;

  elsif p_action='mute_text' then
    update public.space_member_moderation
       set text_muted_until=now()+interval '24 hours',
           reason='إيقاف الشات بواسطة الضيف الملكي',
           updated_by=v_royal,updated_at=now()
     where space_id=p_space and user_id=p_target;

  elsif p_action='unmute_text' then
    update public.space_member_moderation
       set text_muted_until=null,
           reason='فتح الشات بواسطة الضيف الملكي',
           updated_by=v_royal,updated_at=now()
     where space_id=p_space and user_id=p_target;

  elsif p_action='kick' then
    update public.space_pair_spotlights
       set status='ended',ended_at=now()
     where space_id=p_space and status='active'
       and (user_a=p_target or user_b=p_target);

    delete from public.space_voice_signals
     where space_id=p_space and (sender_id=p_target or target_id=p_target);
    delete from public.space_voice_participants
     where space_id=p_space and user_id=p_target;
    delete from public.space_mic_queue
     where space_id=p_space and user_id=p_target;

    update public.space_seats
       set user_id=null,seated_at=null,
           seat_type=case when seat_no in (2,3) then 'challenge' else seat_type end
     where space_id=p_space and user_id=p_target;

    delete from public.space_members
     where space_id=p_space and user_id=p_target;
  else
    raise exception 'invalid_action';
  end if;
end
$$;

revoke all on function public.royal_control_lamma_member(uuid,uuid,text) from public;
revoke execute on function public.royal_control_lamma_member(uuid,uuid,text) from anon;
grant execute on function public.royal_control_lamma_member(uuid,uuid,text) to authenticated;

create or replace function public.royal_set_lamma_pair_spotlight(
  p_space uuid,
  p_user_a uuid,
  p_user_b uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_royal uuid := auth.uid();
  v_id uuid;
begin
  if v_royal is null then raise exception 'not_authenticated'; end if;
  if p_user_a=p_user_b then raise exception 'need_two_people'; end if;
  if p_user_a=v_royal or p_user_b=v_royal then raise exception 'royal_not_challenge_target'; end if;

  if not exists(
    select 1 from public.space_seats
    where space_id=p_space and user_id=v_royal and seat_type='star'
  ) then raise exception 'royal_only'; end if;

  if not exists(select 1 from public.space_members where space_id=p_space and user_id=p_user_a)
     or not exists(select 1 from public.space_members where space_id=p_space and user_id=p_user_b)
  then raise exception 'users_must_be_in_lamma'; end if;

  if not exists(select 1 from public.space_voice_participants where space_id=p_space and user_id=p_user_a)
     or not exists(select 1 from public.space_voice_participants where space_id=p_space and user_id=p_user_b)
  then raise exception 'users_must_join_voice'; end if;

  update public.space_pair_spotlights
     set status='ended',ended_at=now()
   where space_id=p_space and status='active';

  perform private.clear_lamma_stage_seats(p_space);

  update public.space_member_moderation
     set voice_muted_until=null,updated_at=now(),updated_by=v_royal
   where space_id=p_space and user_id in (p_user_a,p_user_b);

  update public.space_seats
     set user_id=p_user_a,seated_at=now(),seat_type='spotlight'
   where space_id=p_space and seat_no=2;
  update public.space_seats
     set user_id=p_user_b,seated_at=now(),seat_type='spotlight'
   where space_id=p_space and seat_no=3;

  update public.space_voice_participants
     set mic_enabled=true,last_seen_at=now()
   where space_id=p_space and user_id in (p_user_a,p_user_b);

  insert into public.space_pair_spotlights(space_id,user_a,user_b,status,started_at,ends_at)
  values(p_space,p_user_a,p_user_b,'active',now(),now()+interval '5 minutes')
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.royal_set_lamma_pair_spotlight(uuid,uuid,uuid) from public;
revoke execute on function public.royal_set_lamma_pair_spotlight(uuid,uuid,uuid) from anon;
grant execute on function public.royal_set_lamma_pair_spotlight(uuid,uuid,uuid) to authenticated;
