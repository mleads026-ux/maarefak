-- Lammetna V8 backend mirror
-- Presence, Lamma mic/Royal/gift events, chat media (video <=10s), voice/video calls.

create or replace function public.set_my_presence(p_online boolean)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  update public.profiles
  set is_online=coalesce(p_online,false),last_seen_at=now(),updated_at=now()
  where id=v_user;
end
$$;
revoke all on function public.set_my_presence(boolean) from public;
revoke execute on function public.set_my_presence(boolean) from anon;
grant execute on function public.set_my_presence(boolean) to authenticated;

create or replace function public.public_profile_presence(p_target uuid)
returns boolean
language plpgsql
security definer
set search_path=public,private
as $$
declare v_user uuid:=auth.uid(); v_online boolean;
begin
  if v_user is null then return false; end if;
  select (p.is_online and coalesce(p.last_seen_at,'-infinity'::timestamptz)>now()-interval '90 seconds')
  into v_online
  from public.profiles p
  where p.id=p_target
    and (p.id=v_user or (p.profile_complete=true and p.discoverable=true and not private.is_blocked_pair(v_user,p.id)));
  return coalesce(v_online,false);
end
$$;
revoke all on function public.public_profile_presence(uuid) from public;
revoke execute on function public.public_profile_presence(uuid) from anon;
grant execute on function public.public_profile_presence(uuid) to authenticated;

create or replace function public.conversation_partner_identity(p_conversation uuid)
returns table(user_id uuid,public_user_id text,display_name text,avatar_url text,is_online boolean,last_seen_at timestamptz)
language plpgsql
security definer
set search_path=public,private
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not private.is_conversation_member(p_conversation,v_user) then raise exception 'not_a_member'; end if;
  return query
  select p.id,p.public_user_id,p.display_name,p.avatar_url,
         (p.is_online and coalesce(p.last_seen_at,'-infinity'::timestamptz)>now()-interval '90 seconds'),
         p.last_seen_at
  from public.conversation_members cm join public.profiles p on p.id=cm.user_id
  where cm.conversation_id=p_conversation and cm.user_id<>v_user limit 1;
end
$$;
revoke all on function public.conversation_partner_identity(uuid) from public;
revoke execute on function public.conversation_partner_identity(uuid) from anon;
grant execute on function public.conversation_partner_identity(uuid) to authenticated;

alter table public.messages add column if not exists media_duration_seconds numeric(5,2);
alter table public.messages add column if not exists gift_transaction_id uuid references public.gifts(id) on delete set null;
alter table public.messages add column if not exists gift_id uuid references public.gift_catalog(id) on delete set null;
alter table public.messages add column if not exists gift_recipient_id uuid references public.profiles(id) on delete set null;
alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check check(message_type in ('text','image','video','gift'));
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_body_check check(
  (message_type='text' and char_length(body) between 1 and 4000)
  or (message_type in ('image','video','gift') and char_length(body)<=4000)
);
alter table public.messages drop constraint if exists messages_media_duration_check;
alter table public.messages add constraint messages_media_duration_check
check(media_duration_seconds is null or (media_duration_seconds>=0 and media_duration_seconds<=10));

alter table public.space_messages add column if not exists message_type text not null default 'text';
alter table public.space_messages add column if not exists gift_transaction_id uuid references public.gifts(id) on delete set null;
alter table public.space_messages add column if not exists gift_id uuid references public.gift_catalog(id) on delete set null;
alter table public.space_messages add column if not exists gift_recipient_id uuid references public.profiles(id) on delete set null;
alter table public.space_messages drop constraint if exists space_messages_message_type_check;
alter table public.space_messages add constraint space_messages_message_type_check check(message_type in ('text','gift'));

update storage.buckets
set file_size_limit=26214400,
    allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']::text[]
where id='chat-media-approved';

create or replace function public.create_media_message(
  p_conversation uuid,p_media_path text,p_kind text,p_duration_seconds numeric default null
)
returns uuid
language plpgsql
security definer
set search_path=public,private
as $$
declare v_user uuid:=auth.uid(); v_id uuid; v_parts text[];
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not private.is_conversation_member(p_conversation,v_user) then raise exception 'not_a_member'; end if;
  if p_kind not in ('image','video') then raise exception 'invalid_media_kind'; end if;
  v_parts:=string_to_array(p_media_path,'/');
  if array_length(v_parts,1)<3 or v_parts[1]<>p_conversation::text or v_parts[2]<>v_user::text
  then raise exception 'invalid_media_path'; end if;
  if p_kind='video' and (p_duration_seconds is null or p_duration_seconds<=0 or p_duration_seconds>10)
  then raise exception 'video_duration_exceeded'; end if;
  insert into public.messages(conversation_id,sender_id,body,message_type,media_path,media_duration_seconds,moderation_status)
  values(p_conversation,v_user,'',p_kind,p_media_path,case when p_kind='video' then p_duration_seconds else null end,'approved')
  returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.create_media_message(uuid,text,text,numeric) from public;
revoke execute on function public.create_media_message(uuid,text,text,numeric) from anon;
grant execute on function public.create_media_message(uuid,text,text,numeric) to authenticated;

create or replace function public.create_image_message(p_conversation uuid,p_pending_path text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
begin
  return public.create_media_message(p_conversation,p_pending_path,'image',null);
end
$$;
revoke all on function public.create_image_message(uuid,text) from public;
revoke execute on function public.create_image_message(uuid,text) from anon;
grant execute on function public.create_image_message(uuid,text) to authenticated;

alter table public.voice_call_sessions add column if not exists call_kind text not null default 'voice';
alter table public.voice_call_sessions drop constraint if exists voice_call_sessions_call_kind_check;
alter table public.voice_call_sessions add constraint voice_call_sessions_call_kind_check check(call_kind in ('voice','video'));

create or replace function public.request_chat_call(p_conversation uuid,p_kind text)
returns uuid
language plpgsql
security definer
set search_path=public,private
as $$
declare v_user uuid:=auth.uid(); v_other uuid; v_call uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_kind not in ('voice','video') then raise exception 'invalid_call_kind'; end if;
  if not private.is_conversation_member(p_conversation,v_user) then raise exception 'not_a_member'; end if;
  select cm.user_id into v_other from public.conversation_members cm
  where cm.conversation_id=p_conversation and cm.user_id<>v_user limit 1;
  if v_other is null then raise exception 'callee_not_found'; end if;
  if private.is_blocked_pair(v_user,v_other) then raise exception 'blocked'; end if;
  update public.voice_call_sessions set status='missed',ended_at=now()
  where conversation_id=p_conversation and status='ringing' and created_at<now()-interval '60 seconds';
  if exists(select 1 from public.voice_call_sessions where conversation_id=p_conversation and status in ('ringing','accepted'))
  then raise exception 'call_already_active'; end if;
  insert into public.voice_call_sessions(conversation_id,caller_id,callee_id,call_kind)
  values(p_conversation,v_user,v_other,p_kind) returning id into v_call;
  return v_call;
end
$$;
revoke all on function public.request_chat_call(uuid,text) from public;
revoke execute on function public.request_chat_call(uuid,text) from anon;
grant execute on function public.request_chat_call(uuid,text) to authenticated;

create or replace function public.request_voice_call(p_conversation uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
begin
  return public.request_chat_call(p_conversation,'voice');
end
$$;
revoke all on function public.request_voice_call(uuid) from public;
revoke execute on function public.request_voice_call(uuid) from anon;
grant execute on function public.request_voice_call(uuid) to authenticated;

create or replace function public.host_assign_royal(p_space uuid,p_target uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_host uuid:=auth.uid(); v_cost bigint:=150; v_balance bigint; v_ref uuid:=gen_random_uuid();
begin
  if v_host is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from public.spaces where id=p_space and owner_id=v_host) then raise exception 'host_only'; end if;
  if not exists(select 1 from public.space_members where space_id=p_space and user_id=p_target) then raise exception 'target_not_in_lamma'; end if;
  insert into public.star_wallets(user_id,balance) values(v_host,0) on conflict(user_id) do nothing;
  select balance into v_balance from public.star_wallets where user_id=v_host for update;
  if coalesce(v_balance,0)<v_cost then raise exception 'insufficient_stars'; end if;
  update public.star_wallets set balance=balance-v_cost,updated_at=now() where user_id=v_host;
  update public.space_seats set user_id=null,seated_at=null where space_id=p_space and seat_no=1;
  update public.space_seats set user_id=p_target,seated_at=now(),seat_type='star' where space_id=p_space and seat_no=1;
  if not found then insert into public.space_seats(space_id,seat_no,user_id,seat_type,seated_at) values(p_space,1,p_target,'star',now()); end if;
  insert into public.star_transactions(user_id,kind,amount,balance_after,reference_type,reference_id)
  values(v_host,'spend',-v_cost,v_balance-v_cost,'royal_assignment',v_ref);
  insert into public.platform_star_revenue(source_type,source_id,amount_stars,settlement_provider)
  select 'royal_assignment',v_ref,v_cost,coalesce((select platform_revenue_provider from public.app_financial_settings where id=1),'paymob');
  insert into public.notifications(user_id,type,title,body,data)
  values(p_target,'royal_assigned','أنت الضيف الملكي 👑',
    case when p_target=v_host then 'عيّنت نفسك كضيف ملكي.' else 'اختارك صاحب اللَمّة كضيف ملكي.' end,
    jsonb_build_object('space_id',p_space,'cost_paid_by_host',v_cost));
end
$$;
revoke all on function public.host_assign_royal(uuid,uuid) from public;
revoke execute on function public.host_assign_royal(uuid,uuid) from anon;
grant execute on function public.host_assign_royal(uuid,uuid) to authenticated;

create or replace function private.log_gift_to_chat()
returns trigger
language plpgsql
security definer
set search_path=public,private
as $$
declare v_sender_name text; v_recipient_name text; v_gift_name text; v_emoji text; v_body text;
begin
  select display_name into v_sender_name from public.profiles where id=new.sender_id;
  select display_name into v_recipient_name from public.profiles where id=new.recipient_id;
  select name_ar,emoji into v_gift_name,v_emoji from public.gift_catalog where id=new.gift_id;
  v_body:=coalesce(v_emoji,'🎁')||' '||coalesce(v_sender_name,'مستخدم')||' أرسل '||coalesce(v_gift_name,'هدية')||' إلى '||coalesce(v_recipient_name,'المستلم');
  if new.space_id is not null then
    insert into public.space_messages(space_id,sender_id,body,message_type,gift_transaction_id,gift_id,gift_recipient_id)
    values(new.space_id,new.sender_id,v_body,'gift',new.id,new.gift_id,new.recipient_id);
  end if;
  if new.conversation_id is not null then
    insert into public.messages(conversation_id,sender_id,body,message_type,moderation_status,gift_transaction_id,gift_id,gift_recipient_id)
    values(new.conversation_id,new.sender_id,v_body,'gift','approved',new.id,new.gift_id,new.recipient_id);
  end if;
  return new;
end
$$;
drop trigger if exists gifts_log_to_chat_trg on public.gifts;
create trigger gifts_log_to_chat_trg after insert on public.gifts
for each row execute function private.log_gift_to_chat();
