-- Applied live on 2026-10-05.
-- Promotional stars remain usable for approved in-app utility features only.
-- They cannot fund gifts/value transfers that create withdrawable value for another user,
-- and paid-store refunds preserve promotional balance.


create or replace function private.guard_promotional_star_value_transfer()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_promo bigint:=0;
  v_internal_promo_allowed boolean:=false;
begin
  if new.amount>=0 then
    return new;
  end if;

  if new.kind='spend' and new.reference_type = any(array[
    'paid_message',
    'private_contact',
    'super_interest',
    'profile_boost',
    'profile_theme',
    'daily_answer_highlight',
    'profile_visitors',
    'space_pin',
    'lamma_entry_effect',
    'royal_assignment',
    'voice_gift_addon'
  ]::text[]) then
    v_internal_promo_allowed:=true;
  end if;

  if v_internal_promo_allowed then
    return new;
  end if;

  if new.kind in ('spend','user_transfer_out','refund') then
    select coalesce(promotional_balance,0)
    into v_promo
    from public.star_wallets
    where user_id=new.user_id;

    if coalesce(new.balance_after,0)<coalesce(v_promo,0) then
      raise exception 'promotional_stars_not_transferable';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists guard_promotional_star_value_transfer_trg on public.star_transactions;
create trigger guard_promotional_star_value_transfer_trg
before insert on public.star_transactions
for each row execute function private.guard_promotional_star_value_transfer();

create or replace function private.consume_promotional_stars_on_internal_spend()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
begin
  if new.kind='spend'
     and new.amount<0
     and new.reference_type = any(array[
       'paid_message',
       'private_contact',
       'super_interest',
       'profile_boost',
       'profile_theme',
       'daily_answer_highlight',
       'profile_visitors',
       'space_pin',
       'lamma_entry_effect',
       'royal_assignment',
       'voice_gift_addon'
     ]::text[]) then
    update public.star_wallets
    set promotional_balance=greatest(
      promotional_balance-least(promotional_balance,abs(new.amount)),
      0
    ),
    updated_at=now()
    where user_id=new.user_id;
  end if;

  return new;
end
$$;

drop trigger if exists consume_promotional_stars_internal_spend_trg on public.star_transactions;
create trigger consume_promotional_stars_internal_spend_trg
after insert on public.star_transactions
for each row execute function private.consume_promotional_stars_on_internal_spend();

create or replace function private.revoke_iap_purchase(
  p_provider text,
  p_transaction_id text,
  p_reason text default 'provider_refund'
)
returns void
language plpgsql
security definer
set search_path to 'public','private'
as $$
declare
  v_purchase public.iap_purchases%rowtype;
  v_balance bigint;
  v_promotional bigint:=0;
  v_regular_balance bigint:=0;
  v_recovered bigint:=0;
  v_missing_wallet_grant bigint:=0;
  v_debt_restore bigint:=0;
  v_total_debt_added bigint:=0;
begin
  select * into v_purchase
  from public.iap_purchases
  where provider=p_provider
    and provider_transaction_id=trim(p_transaction_id)
  for update;

  if v_purchase.id is null then raise exception 'purchase_not_found'; end if;
  if v_purchase.status in ('refunded','revoked') then return; end if;
  if v_purchase.status <> 'verified' then raise exception 'purchase_not_refundable'; end if;

  insert into public.financial_risk_state(user_id)
  values(v_purchase.user_id)
  on conflict(user_id) do nothing;

  insert into public.star_wallets(user_id,balance)
  values(v_purchase.user_id,0)
  on conflict(user_id) do nothing;

  select balance,coalesce(promotional_balance,0)
  into v_balance,v_promotional
  from public.star_wallets
  where user_id=v_purchase.user_id
  for update;

  perform 1
  from public.financial_risk_state
  where user_id=v_purchase.user_id
  for update;

  -- Promotional stars are never used to settle a paid-store refund.
  v_regular_balance:=greatest(coalesce(v_balance,0)-coalesce(v_promotional,0),0);
  v_recovered:=least(v_regular_balance,coalesce(v_purchase.stars_added_to_wallet,0));
  v_missing_wallet_grant:=greatest(coalesce(v_purchase.stars_added_to_wallet,0)-v_recovered,0);

  v_debt_restore:=greatest(coalesce(v_purchase.stars_applied_to_debt,0),0);
  v_total_debt_added:=v_debt_restore+v_missing_wallet_grant;

  if v_recovered>0 then
    update public.star_wallets
    set balance=balance-v_recovered,updated_at=now()
    where user_id=v_purchase.user_id;

    insert into public.star_transactions(
      user_id,kind,amount,balance_after,reference_type,reference_id
    )
    values(
      v_purchase.user_id,'refund',-v_recovered,
      v_balance-v_recovered,'iap_refund',v_purchase.id
    );
  end if;

  if v_total_debt_added>0 then
    update public.financial_risk_state
    set iap_debt_stars=iap_debt_stars+v_total_debt_added,
        updated_at=now()
    where user_id=v_purchase.user_id;

    insert into private.financial_risk_events(
      user_id,event_type,amount_stars,reference_type,reference_id,metadata
    )
    values(
      v_purchase.user_id,'iap_refund_debt_created',v_total_debt_added,
      'iap_purchase',v_purchase.id,
      jsonb_build_object(
        'provider',p_provider,
        'reason',p_reason,
        'debt_repayment_reversed',v_debt_restore,
        'wallet_grant_recovered',v_recovered,
        'spent_wallet_grant_to_debt',v_missing_wallet_grant
      )
    );
  end if;

  update public.iap_purchases
  set status='refunded',refunded_at=now()
  where id=v_purchase.id;

  perform private.write_admin_audit(
    null,'provider','iap_purchase_refunded',
    'iap_purchase',v_purchase.id::text,p_reason,
    jsonb_build_object(
      'user_id',v_purchase.user_id,
      'stars_originally_granted',v_purchase.stars_granted,
      'debt_repayment_reversed',v_debt_restore,
      'wallet_grant_recovered',v_recovered,
      'iap_debt_added',v_total_debt_added,
      'promotional_balance_preserved',v_promotional
    )
  );

  if v_total_debt_added>0 then
    insert into public.notifications(user_id,type,title,body,data)
    values(
      v_purchase.user_id,
      'financial_hold',
      'مراجعة مالية على الحساب',
      'تم رد عملية شراء نجوم. أعيد احتساب الرصيد المستحق، وسيتم تسويته من أي شراء لاحق، والسحب متوقف مؤقتًا حتى تسوية المديونية.',
      jsonb_build_object('iap_debt_added',v_total_debt_added,'purchase_id',v_purchase.id)
    );
  end if;
end
$$;
