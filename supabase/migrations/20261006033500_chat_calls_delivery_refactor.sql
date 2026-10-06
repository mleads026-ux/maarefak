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

-- Enforce on the server that promotional stars can be spent inside Lammetna,
-- but can never be converted into another user's transferable balance or earnings.
create or replace function public.transfer_stars_by_user_id(
  p_public_user_id text,
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
  v_balance bigint;
  v_promotional bigint;
  v_existing uuid;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_amount is null or p_amount<1 then raise exception 'invalid_amount'; end if;

  perform private.assert_mfa_if_enrolled();

  select id into v_existing
  from public.star_transfers
  where sender_id=v_user and client_reference_id=p_client_reference_id;

  if v_existing is not null then return v_existing; end if;

  insert into public.star_wallets(user_id,balance,promotional_balance)
  values(v_user,0,0)
  on conflict(user_id) do nothing;

  select balance,promotional_balance
  into v_balance,v_promotional
  from public.star_wallets
  where user_id=v_user
  for update;

  if coalesce(v_balance,0)<p_amount then
    raise exception 'insufficient_stars';
  end if;

  if coalesce(v_balance,0)-coalesce(v_promotional,0)<p_amount then
    raise exception 'promotional_stars_not_transferable';
  end if;

  return public.transfer_stars_by_user_id_core_v14(
    p_public_user_id,p_amount,p_client_reference_id
  );
end
$$;

revoke all on function public.transfer_stars_by_user_id(text,bigint,uuid) from public;
revoke execute on function public.transfer_stars_by_user_id(text,bigint,uuid) from anon;
grant execute on function public.transfer_stars_by_user_id(text,bigint,uuid) to authenticated;

create or replace function public.send_gift(
  p_target uuid,
  p_gift uuid,
  p_space uuid default null,
  p_conversation uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=public,private
as $$
declare
  v_user uuid:=auth.uid();
  v_price bigint;
  v_balance bigint;
  v_promotional bigint;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  perform private.assert_mfa_if_enrolled();

  select price_stars into v_price
  from public.gift_catalog
  where id=p_gift and active=true;

  if v_price is null then raise exception 'gift_not_available'; end if;

  insert into public.star_wallets(user_id,balance,promotional_balance)
  values(v_user,0,0)
  on conflict(user_id) do nothing;

  select balance,promotional_balance
  into v_balance,v_promotional
  from public.star_wallets
  where user_id=v_user
  for update;

  if coalesce(v_balance,0)<v_price then
    raise exception 'insufficient_stars';
  end if;

  if coalesce(v_balance,0)-coalesce(v_promotional,0)<v_price then
    raise exception 'promotional_stars_not_transferable';
  end if;

  return public.send_gift_core_v14(p_target,p_gift,p_space,p_conversation);
end
$$;

revoke all on function public.send_gift(uuid,uuid,uuid,uuid) from public;
revoke execute on function public.send_gift(uuid,uuid,uuid,uuid) from anon;
grant execute on function public.send_gift(uuid,uuid,uuid,uuid) to authenticated;

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
