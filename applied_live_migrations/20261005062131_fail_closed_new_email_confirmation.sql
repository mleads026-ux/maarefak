-- Applied live on 2026-10-05.
-- New email/password accounts created after enforcement must show evidence that
-- a confirmation message was sent and the email was confirmed before app access.
-- Existing test/legacy accounts are grandfathered by enforce_from.

create table if not exists public.app_auth_launch_settings(
  id smallint primary key default 1 check(id=1),
  require_email_confirmation_evidence boolean not null default true,
  enforce_from timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_auth_launch_settings(id,require_email_confirmation_evidence,enforce_from)
values(1,true,now())
on conflict(id) do nothing;

alter table public.app_auth_launch_settings enable row level security;

drop policy if exists app_auth_launch_settings_authenticated_read on public.app_auth_launch_settings;
create policy app_auth_launch_settings_authenticated_read
on public.app_auth_launch_settings
for select
to authenticated
using(id=1);

revoke all on table public.app_auth_launch_settings from public,anon;
grant select on table public.app_auth_launch_settings to authenticated;

create or replace function public.current_user_email_verified_for_launch()
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user uuid:=auth.uid();
  v_created timestamptz;
  v_confirmed timestamptz;
  v_confirmation_sent timestamptz;
  v_enforce_from timestamptz;
  v_required boolean;
  v_has_email_identity boolean;
begin
  if v_user is null then return false; end if;

  select s.require_email_confirmation_evidence,s.enforce_from
    into v_required,v_enforce_from
  from public.app_auth_launch_settings s
  where s.id=1;

  if not coalesce(v_required,true) then return true; end if;

  select u.created_at,u.email_confirmed_at,u.confirmation_sent_at
    into v_created,v_confirmed,v_confirmation_sent
  from auth.users u
  where u.id=v_user;

  if v_created is null then return false; end if;
  if v_created < v_enforce_from then return true; end if;

  select exists(
    select 1
    from auth.identities i
    where i.user_id=v_user and i.provider='email'
  ) into v_has_email_identity;

  if not v_has_email_identity then
    return v_confirmed is not null;
  end if;

  return v_confirmation_sent is not null and v_confirmed is not null;
end
$$;

revoke all on function public.current_user_email_verified_for_launch() from public,anon;
grant execute on function public.current_user_email_verified_for_launch() to authenticated;
