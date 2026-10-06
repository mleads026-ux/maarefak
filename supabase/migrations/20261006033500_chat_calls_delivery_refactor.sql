-- Lammetna: reliable chat delivery events + realtime wallet refresh support.
-- Prepared as part of the call/chat refactor. Apply before deploying the matching frontend.

alter table public.messages
  add column if not exists star_transfer_id uuid references public.star_transfers(id) on delete set null;

alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check
  check(message_type in ('text','image','video','gift','star_transfer'));

alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_body_check check(
  (message_type='text' and char_length(body) between 1 and 4000)
  or (message_type in ('image','video','gift','star_transfer') and char_length(body)<=4000)
);

create unique index if not exists uq_messages_star_transfer
  on public.messages(star_transfer_id)
  where star_transfer_id is not null;

-- Promotional-star value-transfer protection is already enforced centrally by
-- private.guard_promotional_star_value_transfer() on public.star_transactions.
-- Do not duplicate wallet locking here; the central trigger remains the single source of truth.

create or replace function private.notify_star_transfer()
returns trigger
language plpgsql
security definer
set search_path=public,private
as $$
declare
  v_sender_name text;
begin
  select display_name into v_sender_name
  from public.profiles
  where id=new.sender_id;

  insert into public.notifications(user_id,type,title,body,data)
  values(
    new.recipient_id,
    'star_transfer_received',
    'وصلك نجوم ⭐',
    'استلمت '||new.recipient_stars||' ⭐ من '||coalesce(v_sender_name,'مستخدم لمتنا')||'.',
    jsonb_build_object(
      'star_transfer_id',new.id,
      'sender_id',new.sender_id,
      'gross_stars',new.amount,
      'platform_fee_stars',new.platform_fee_stars,
      'received_stars',new.recipient_stars
    )
  );

  return new;
end
$$;

drop trigger if exists star_transfers_notify_recipient_trg on public.star_transfers;
create trigger star_transfers_notify_recipient_trg
after insert on public.star_transfers
for each row execute function private.notify_star_transfer();

create or replace function public.transfer_stars_in_conversation(
  p_conversation uuid,
  p_amount bigint,
  p_client_reference_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=public,private
as $$
declare
  v_user uuid:=auth.uid();
  v_target uuid;
  v_target_public_id text;
  v_sender_name text;
  v_target_name text;
  v_transfer uuid;
  v_gross bigint;
  v_received bigint;
  v_body text;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_amount is null or p_amount<1 then raise exception 'invalid_amount'; end if;
  if not private.is_conversation_member(p_conversation,v_user) then
    raise exception 'not_a_member';
  end if;

  select cm.user_id,p.public_user_id,p.display_name
  into v_target,v_target_public_id,v_target_name
  from public.conversation_members cm
  join public.profiles p on p.id=cm.user_id
  where cm.conversation_id=p_conversation
    and cm.user_id<>v_user
  limit 1;

  if v_target is null or v_target_public_id is null then
    raise exception 'recipient_not_found';
  end if;

  v_transfer:=public.transfer_stars_by_user_id(
    v_target_public_id,
    p_amount,
    p_client_reference_id
  );

  select amount,recipient_stars
  into v_gross,v_received
  from public.star_transfers
  where id=v_transfer;

  select display_name into v_sender_name
  from public.profiles
  where id=v_user;

  v_body:='⭐ '||coalesce(v_sender_name,'مستخدم لمتنا')||
          ' أرسل '||coalesce(v_gross,p_amount)||' نجمة إلى '||
          coalesce(v_target_name,'الطرف الآخر')||
          ' — وصل '||coalesce(v_received,0)||' ⭐ بعد عمولة التطبيق.';

  insert into public.messages(
    conversation_id,sender_id,body,message_type,moderation_status,star_transfer_id
  )
  select
    p_conversation,v_user,v_body,'star_transfer','approved',v_transfer
  where not exists(
    select 1 from public.messages where star_transfer_id=v_transfer
  );

  -- Make the recipient notification return directly to this conversation.
  update public.notifications
  set data=coalesce(data,'{}'::jsonb)||jsonb_build_object('conversation_id',p_conversation)
  where user_id=v_target
    and type='star_transfer_received'
    and data->>'star_transfer_id'=v_transfer::text;

  return v_transfer;
end
$$;

revoke all on function public.transfer_stars_in_conversation(uuid,bigint,uuid) from public;
revoke execute on function public.transfer_stars_in_conversation(uuid,bigint,uuid) from anon;
grant execute on function public.transfer_stars_in_conversation(uuid,bigint,uuid) to authenticated;

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='star_wallets'
  ) then
    alter publication supabase_realtime add table public.star_wallets;
  end if;

  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='earning_wallets'
  ) then
    alter publication supabase_realtime add table public.earning_wallets;
  end if;
end
$$;


-- A user can participate in only one active call at a time.
-- Advisory locks make the busy check safe when call requests race.
create or replace function public.request_chat_call(
  p_conversation uuid,
  p_kind text
)
returns uuid
language plpgsql
security definer
set search_path=public,private
as $$
declare
  v_user uuid:=auth.uid();
  v_other uuid;
  v_call uuid;
  v_first text;
  v_second text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_kind not in ('voice','video') then raise exception 'invalid_call_kind'; end if;
  if not private.is_conversation_member(p_conversation,v_user) then
    raise exception 'not_a_member';
  end if;

  select cm.user_id into v_other
  from public.conversation_members cm
  where cm.conversation_id=p_conversation
    and cm.user_id<>v_user
  limit 1;

  if v_other is null then raise exception 'callee_not_found'; end if;
  if private.is_blocked_pair(v_user,v_other) then raise exception 'blocked'; end if;

  v_first:=least(v_user::text,v_other::text);
  v_second:=greatest(v_user::text,v_other::text);

  perform pg_advisory_xact_lock(hashtextextended('voice-call:'||v_first,0));
  perform pg_advisory_xact_lock(hashtextextended('voice-call:'||v_second,0));

  update public.voice_call_sessions
  set status='missed',ended_at=now()
  where status='ringing'
    and created_at<now()-interval '60 seconds'
    and (
      caller_id in (v_user,v_other)
      or callee_id in (v_user,v_other)
    );

  if exists(
    select 1
    from public.voice_call_sessions
    where status in ('ringing','accepted')
      and (
        caller_id in (v_user,v_other)
        or callee_id in (v_user,v_other)
      )
  ) then
    raise exception 'user_already_in_call';
  end if;

  insert into public.voice_call_sessions(
    conversation_id,caller_id,callee_id,call_kind
  )
  values(p_conversation,v_user,v_other,p_kind)
  returning id into v_call;

  return v_call;
end
$$;

revoke all on function public.request_chat_call(uuid,text) from public;
revoke execute on function public.request_chat_call(uuid,text) from anon;
grant execute on function public.request_chat_call(uuid,text) to authenticated;

create or replace function public.expire_my_stale_voice_calls()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_count integer:=0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  with expired as (
    update public.voice_call_sessions
    set status='missed',ended_at=now()
    where status='ringing'
      and created_at<now()-interval '60 seconds'
      and v_user in (caller_id,callee_id)
    returning 1
  )
  select count(*) into v_count from expired;

  return v_count;
end
$$;

revoke all on function public.expire_my_stale_voice_calls() from public;
revoke execute on function public.expire_my_stale_voice_calls() from anon;
grant execute on function public.expire_my_stale_voice_calls() to authenticated;
