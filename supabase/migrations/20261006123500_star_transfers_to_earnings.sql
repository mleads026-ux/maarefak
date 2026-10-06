-- Direct user-to-user star transfers become recipient earnings.
-- The sender pays stars from star_wallets; the recipient receives the net amount
-- in earning_wallets after the configured platform fee (currently 15%).

alter table public.earning_transactions
  drop constraint if exists earning_transactions_kind_check;

alter table public.earning_transactions
  add constraint earning_transactions_kind_check
  check(kind in (
    'gift_received',
    'star_transfer_received',
    'converted_to_stars',
    'host_commission',
    'withdrawal_hold',
    'withdrawal_release',
    'withdrawal_paid',
    'adjustment'
  ));

create or replace function public.transfer_stars_by_user_id_core_v14(
  p_public_user_id text,
  p_amount bigint,
  p_client_reference_id uuid
)
returns uuid
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  s uuid:=auth.uid();
  r uuid;
  sb bigint;
  v_recipient_available bigint;
  v_recipient_held bigint;
  tid uuid;
  v_platform_bps integer;
  v_platform_fee bigint;
  v_recipient_amount bigint;
  v_provider text;
begin
  if s is null then raise exception 'authentication_required'; end if;
  if p_amount is null or p_amount<1 then raise exception 'invalid_amount'; end if;

  perform private.assert_financial_account_clear(s);

  select id into r
  from public.profiles
  where public_user_id=upper(btrim(p_public_user_id));

  if r is null then raise exception 'recipient_not_found'; end if;
  if r=s then raise exception 'cannot_transfer_to_self'; end if;
  if private.is_blocked_pair(s,r) then raise exception 'transfer_not_allowed'; end if;

  select id into tid
  from public.star_transfers
  where sender_id=s and client_reference_id=p_client_reference_id;

  if tid is not null then return tid; end if;

  select platform_gift_fee_bps,platform_revenue_provider
  into v_platform_bps,v_provider
  from public.app_financial_settings
  where id=1;

  v_platform_bps:=coalesce(v_platform_bps,1500);
  v_provider:=coalesce(nullif(v_provider,''),'paymob');

  v_platform_fee:=ceil(p_amount*v_platform_bps/10000.0)::bigint;
  v_recipient_amount:=p_amount-v_platform_fee;

  if v_recipient_amount<0 then raise exception 'invalid_fee_configuration'; end if;

  insert into public.star_wallets(user_id,balance)
  values(s,0)
  on conflict(user_id) do nothing;

  select balance into sb
  from public.star_wallets
  where user_id=s
  for update;

  if coalesce(sb,0)<p_amount then raise exception 'insufficient_stars'; end if;

  insert into public.earning_wallets(user_id)
  values(r)
  on conflict(user_id) do nothing;

  select available_stars,held_stars
  into v_recipient_available,v_recipient_held
  from public.earning_wallets
  where user_id=r
  for update;

  update public.star_wallets
  set balance=balance-p_amount,updated_at=now()
  where user_id=s
  returning balance into sb;

  update public.earning_wallets
  set available_stars=available_stars+v_recipient_amount,
      updated_at=now()
  where user_id=r;

  insert into public.star_transfers(
    sender_id,recipient_id,amount,platform_fee_stars,recipient_stars,client_reference_id
  )
  values(
    s,r,p_amount,v_platform_fee,v_recipient_amount,p_client_reference_id
  )
  returning id into tid;

  -- This row is intentionally inserted after the wallet debit. The existing
  -- promotional-star guard validates that transferable paid stars remain
  -- sufficient; any rejection rolls back this entire transaction atomically.
  insert into public.star_transactions(
    user_id,kind,amount,balance_after,reference_type,reference_id
  )
  values(
    s,'user_transfer_out',-p_amount,sb,'star_transfer',tid
  );

  insert into public.earning_transactions(
    user_id,kind,amount_stars,available_after,held_after,
    reference_type,reference_id,metadata
  )
  values(
    r,'star_transfer_received',v_recipient_amount,
    v_recipient_available+v_recipient_amount,v_recipient_held,
    'star_transfer',tid,
    jsonb_build_object(
      'gross_stars',p_amount,
      'platform_fee_stars',v_platform_fee,
      'platform_fee_bps',v_platform_bps,
      'sender_id',s,
      'settlement_provider',v_provider
    )
  );

  insert into public.platform_star_revenue(
    source_type,source_id,amount_stars,settlement_provider
  )
  values(
    'star_transfer',tid,v_platform_fee,v_provider
  );

  return tid;
end
$$;

create or replace function private.notify_star_transfer()
returns trigger
language plpgsql
security definer
set search_path=''
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
    'وصلك رصيد أرباح ⭐',
    'أرسل لك '||coalesce(v_sender_name,'مستخدم لمتنا')||' '||new.amount||
      ' نجمة، وأضيف صافي '||new.recipient_stars||' نجمة إلى رصيد أرباحك بعد عمولة التطبيق.',
    jsonb_build_object(
      'star_transfer_id',new.id,
      'sender_id',new.sender_id,
      'gross_stars',new.amount,
      'platform_fee_stars',new.platform_fee_stars,
      'earned_stars',new.recipient_stars,
      'wallet_type','earnings'
    )
  );

  return new;
end
$$;

create or replace function private.transfer_stars_in_conversation_impl(
  p_conversation uuid,
  p_amount bigint,
  p_client_reference_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
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
          ' — أضيف '||coalesce(v_received,0)||' ⭐ إلى رصيد الأرباح بعد عمولة التطبيق.';

  insert into public.messages(
    conversation_id,sender_id,body,message_type,moderation_status,star_transfer_id
  )
  values(
    p_conversation,v_user,v_body,'star_transfer','approved',v_transfer
  )
  on conflict(star_transfer_id) where star_transfer_id is not null do nothing;

  update public.notifications
  set data=coalesce(data,'{}'::jsonb)||jsonb_build_object('conversation_id',p_conversation)
  where user_id=v_target
    and type='star_transfer_received'
    and data->>'star_transfer_id'=v_transfer::text;

  return v_transfer;
end
$$;

revoke all on function private.transfer_stars_in_conversation_impl(uuid,bigint,uuid) from public;
grant execute on function private.transfer_stars_in_conversation_impl(uuid,bigint,uuid) to authenticated;

-- Let a recipient voluntarily convert any whole number of available earnings
-- into spendable stars. This direction is one-way; stars cannot be converted
-- back into withdrawable earnings.
create or replace function public.convert_earnings_to_stars(p_stars bigint)
returns bigint
language plpgsql
security definer
set search_path='public','private'
as $$
declare
  v_user uuid:=auth.uid();
  v_available bigint;
  v_held bigint;
  v_star_balance bigint;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_stars is null or p_stars<1 then raise exception 'invalid_amount'; end if;

  perform private.assert_financial_account_clear(v_user);
  perform pg_advisory_xact_lock(hashtextextended(v_user::text||':earnings_to_stars',0));

  insert into public.earning_wallets(user_id)
  values(v_user)
  on conflict(user_id) do nothing;

  insert into public.star_wallets(user_id,balance)
  values(v_user,0)
  on conflict(user_id) do nothing;

  select available_stars,held_stars
  into v_available,v_held
  from public.earning_wallets
  where user_id=v_user
  for update;

  if coalesce(v_available,0)<p_stars then
    raise exception 'insufficient_earnings';
  end if;

  select balance into v_star_balance
  from public.star_wallets
  where user_id=v_user
  for update;

  update public.earning_wallets
  set available_stars=available_stars-p_stars,
      updated_at=now()
  where user_id=v_user;

  update public.star_wallets
  set balance=balance+p_stars,
      updated_at=now()
  where user_id=v_user
  returning balance into v_star_balance;

  insert into public.earning_transactions(
    user_id,kind,amount_stars,available_after,held_after,
    reference_type,metadata
  )
  values(
    v_user,'converted_to_stars',-p_stars,
    v_available-p_stars,v_held,
    'earnings_to_stars',
    jsonb_build_object('converted_stars',p_stars,'direction','earnings_to_star_wallet')
  );

  insert into public.star_transactions(
    user_id,kind,amount,balance_after,reference_type
  )
  values(
    v_user,'grant',p_stars,v_star_balance,'earnings_to_stars'
  );

  return p_stars;
end
$$;

revoke all on function public.convert_earnings_to_stars(bigint) from public;
revoke execute on function public.convert_earnings_to_stars(bigint) from anon;
grant execute on function public.convert_earnings_to_stars(bigint) to authenticated;
