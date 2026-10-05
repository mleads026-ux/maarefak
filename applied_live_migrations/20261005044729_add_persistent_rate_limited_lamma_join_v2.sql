-- Applied live on 2026-10-05.
-- Correct persistent brute-force protection: join_lamma_v2 returns status strings
-- so failed-attempt state commits instead of being rolled back by exceptions.


create or replace function public.join_lamma(p_space uuid, p_password text default null)
returns void
language plpgsql
security definer
set search_path to 'public','private','extensions'
as $$
declare
  v_user uuid:=auth.uid();
  v_is_public boolean;
  v_hash text;
  v_limit integer;
  v_expiry timestamptz;
  v_count integer;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select is_public,member_limit,expires_at
  into v_is_public,v_limit,v_expiry
  from public.spaces
  where id=p_space
  for update;

  if v_is_public is null then raise exception 'lamma_not_found'; end if;
  if v_expiry is not null and v_expiry<=now() then raise exception 'lamma_ended'; end if;

  if exists(
    select 1 from public.space_member_moderation
    where space_id=p_space and user_id=v_user
      and (
        permanently_banned=true
        or coalesce(banned_until,'-infinity'::timestamptz)>now()
      )
  ) then raise exception 'banned_from_lamma'; end if;

  if exists(
    select 1 from public.space_members
    where space_id=p_space and user_id=v_user
  ) then return; end if;

  if v_limit is not null then
    select count(*) into v_count
    from public.space_members
    where space_id=p_space;
    if v_count>=v_limit then raise exception 'lamma_full'; end if;
  end if;

  if not v_is_public then
    select password_hash into v_hash
    from private.space_access_secrets
    where space_id=p_space;

    if v_hash is null
       or p_password is null
       or crypt(trim(p_password),v_hash)<>v_hash then
      raise exception 'wrong_password';
    end if;
  end if;

  insert into public.space_members(space_id,user_id,role)
  values(p_space,v_user,'member')
  on conflict(space_id,user_id) do nothing;
end
$$;

revoke all on function public.join_lamma(uuid,text) from public,anon;
grant execute on function public.join_lamma(uuid,text) to authenticated;

create table if not exists private.lamma_access_attempts(
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  failed_count integer not null default 0 check(failed_count>=0),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key(space_id,user_id)
);

create or replace function public.join_lamma_v2(p_space uuid, p_password text default null)
returns text
language plpgsql
security definer
set search_path='public','private','extensions'
as $$
declare
  v_user uuid:=auth.uid();
  v_is_public boolean;
  v_hash text;
  v_limit integer;
  v_expiry timestamptz;
  v_count integer;
  v_failed integer;
  v_window timestamptz;
  v_locked timestamptz;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select is_public,member_limit,expires_at
  into v_is_public,v_limit,v_expiry
  from public.spaces
  where id=p_space
  for update;

  if v_is_public is null then return 'lamma_not_found'; end if;
  if v_expiry is not null and v_expiry<=now() then return 'lamma_ended'; end if;

  if exists(
    select 1 from public.space_member_moderation
    where space_id=p_space and user_id=v_user
      and (
        permanently_banned=true
        or coalesce(banned_until,'-infinity'::timestamptz)>now()
      )
  ) then return 'banned_from_lamma'; end if;

  if exists(
    select 1 from public.space_members
    where space_id=p_space and user_id=v_user
  ) then return 'joined'; end if;

  if v_limit is not null then
    select count(*) into v_count
    from public.space_members
    where space_id=p_space;
    if v_count>=v_limit then return 'lamma_full'; end if;
  end if;

  if not v_is_public then
    insert into private.lamma_access_attempts(space_id,user_id)
    values(p_space,v_user)
    on conflict(space_id,user_id) do nothing;

    select failed_count,window_started_at,locked_until
    into v_failed,v_window,v_locked
    from private.lamma_access_attempts
    where space_id=p_space and user_id=v_user
    for update;

    if v_locked is not null and v_locked>now() then
      return 'too_many_password_attempts';
    end if;

    select password_hash into v_hash
    from private.space_access_secrets
    where space_id=p_space;

    if v_hash is null
       or p_password is null
       or crypt(trim(p_password),v_hash)<>v_hash then

      if v_window<now()-interval '10 minutes' then
        v_failed:=1;
        v_window:=now();
      else
        v_failed:=coalesce(v_failed,0)+1;
      end if;

      update private.lamma_access_attempts
      set failed_count=v_failed,
          window_started_at=v_window,
          locked_until=case when v_failed>=5 then now()+interval '15 minutes' else null end,
          updated_at=now()
      where space_id=p_space and user_id=v_user;

      if v_failed>=5 then return 'too_many_password_attempts'; end if;
      return 'wrong_password';
    end if;

    delete from private.lamma_access_attempts
    where space_id=p_space and user_id=v_user;
  end if;

  insert into public.space_members(space_id,user_id,role)
  values(p_space,v_user,'member')
  on conflict(space_id,user_id) do nothing;

  return 'joined';
end
$$;

revoke all on function public.join_lamma_v2(uuid,text) from public,anon;
grant execute on function public.join_lamma_v2(uuid,text) to authenticated;
