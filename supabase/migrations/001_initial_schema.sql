create extension if not exists pgcrypto;
create schema if not exists private;

-- ---------- enums ----------
do $$ begin
  create type public.connection_request_status as enum ('pending','accepted','ignored');
exception when duplicate_object then null; end $$;

-- ---------- lookup data ----------
create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_ar text not null,
  name_en text,
  created_at timestamptz not null default now()
);

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete cascade,
  name_ar text not null,
  name_en text,
  created_at timestamptz not null default now(),
  unique(country_id, name_ar)
);

create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_ar text not null,
  created_at timestamptz not null default now()
);

-- ---------- users ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  birth_date date,
  gender text,
  country_id uuid references public.countries(id),
  city_id uuid references public.cities(id),
  bio text,
  mood text,
  avatar_url text,
  is_online boolean not null default false,
  last_seen_at timestamptz,
  discoverable boolean not null default true,
  allow_invitations boolean not null default true,
  show_age boolean not null default true,
  profile_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_interests (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(profile_id, interest_id)
);

create table if not exists public.profile_interests_signals (
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(from_user_id, to_user_id),
  check(from_user_id <> to_user_id)
);

create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check(viewer_id <> viewed_id)
);

-- ---------- connections & private chat ----------
create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  message text check(message is null or char_length(message) <= 280),
  status public.connection_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(sender_id <> receiver_id)
);

create unique index if not exists uq_pending_connection_pair
  on public.connection_requests (least(sender_id,receiver_id), greatest(sender_id,receiver_id))
  where status='pending';

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- ---------- spaces ----------
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check(char_length(name) between 2 and 80),
  description text check(description is null or char_length(description) <= 400),
  emoji text,
  category text,
  image_url text,
  is_public boolean not null default true,
  pinned_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check(role in ('owner','moderator','member')),
  joined_at timestamptz not null default now(),
  primary key(space_id,user_id)
);

create table if not exists public.space_messages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

-- ---------- safety ----------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check(reason in ('harassment','inappropriate','impersonation','spam','fraud','other')),
  description text check(description is null or char_length(description) <= 1000),
  status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  check(reporter_id <> reported_user_id)
);

-- ---------- stars ----------
create table if not exists public.star_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance bigint not null default 0 check(balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.star_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check(kind in ('purchase','spend','grant','refund')),
  amount bigint not null,
  balance_after bigint not null check(balance_after >= 0),
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now()
);

-- ---------- random chat ----------
create table if not exists public.random_chat_queue (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now()
);

create table if not exists public.random_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check(status in ('active','ended','converted')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  conversation_id uuid references public.conversations(id) on delete set null,
  check(user_a <> user_b)
);

-- ---------- notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text,
  auth text,
  created_at timestamptz not null default now(),
  unique(user_id,endpoint)
);

-- ---------- indexes ----------
create index if not exists idx_cities_country on public.cities(country_id,name_ar);
create index if not exists idx_profiles_country_city on public.profiles(country_id,city_id) where profile_complete;
create index if not exists idx_profiles_discoverable on public.profiles(discoverable,profile_complete,created_at desc);
create index if not exists idx_profile_interests_interest on public.profile_interests(interest_id,profile_id);
create index if not exists idx_messages_conversation_created on public.messages(conversation_id,created_at desc);
create index if not exists idx_space_messages_space_created on public.space_messages(space_id,created_at desc);
create index if not exists idx_spaces_pinned_created on public.spaces(pinned_until desc nulls last,created_at desc);
create index if not exists idx_profile_views_viewed_created on public.profile_views(viewed_id,created_at desc);
create index if not exists idx_connection_requests_receiver_status on public.connection_requests(receiver_id,status,created_at desc);
create index if not exists idx_notifications_user_created on public.notifications(user_id,created_at desc);
create index if not exists idx_blocks_blocked on public.blocks(blocked_id,blocker_id);
create index if not exists idx_random_sessions_users on public.random_chat_sessions(user_a,user_b,started_at desc);

-- ---------- helpers ----------
create or replace function private.is_blocked_pair(a uuid, b uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.blocks
    where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a)
  );
$$;

create or replace function private.is_conversation_member(p_conversation uuid, p_user uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.conversation_members where conversation_id=p_conversation and user_id=p_user);
$$;

create or replace function private.is_space_member(p_space uuid, p_user uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.space_members where space_id=p_space and user_id=p_user);
$$;

revoke all on function private.is_blocked_pair(uuid,uuid) from public;
revoke all on function private.is_conversation_member(uuid,uuid) from public;
revoke all on function private.is_space_member(uuid,uuid) from public;

-- age/location validation happens in DB too, not only in UI
create or replace function private.validate_profile()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.birth_date is not null and new.birth_date > current_date - interval '18 years' then
    raise exception 'must_be_18_or_older';
  end if;
  if new.city_id is not null and new.country_id is not null and not exists(
    select 1 from public.cities c where c.id=new.city_id and c.country_id=new.country_id
  ) then
    raise exception 'city_country_mismatch';
  end if;
  if new.profile_complete and (
    nullif(trim(new.display_name),'') is null or new.birth_date is null or new.country_id is null or new.city_id is null
  ) then
    raise exception 'profile_incomplete';
  end if;
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists trg_validate_profile on public.profiles;
create trigger trg_validate_profile before insert or update on public.profiles
for each row execute function private.validate_profile();

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,display_name) values(new.id, coalesce(new.raw_user_meta_data->>'display_name','')) on conflict do nothing;
  insert into public.star_wallets(user_id,balance) values(new.id,0) on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.space_owner_membership()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.space_members(space_id,user_id,role) values(new.id,new.owner_id,'owner') on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_space_created on public.spaces;
create trigger on_space_created after insert on public.spaces
for each row execute function private.space_owner_membership();

-- ---------- RLS ----------
alter table public.countries enable row level security;
alter table public.cities enable row level security;
alter table public.interests enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_interests enable row level security;
alter table public.profile_interests_signals enable row level security;
alter table public.profile_views enable row level security;
alter table public.connection_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.star_wallets enable row level security;
alter table public.star_transactions enable row level security;
alter table public.random_chat_queue enable row level security;
alter table public.random_chat_sessions enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

-- public lookup data
create policy countries_read on public.countries for select to anon, authenticated using (true);
create policy cities_read on public.cities for select to anon, authenticated using (true);
create policy interests_read on public.interests for select to anon, authenticated using (true);

-- profiles and tags
create policy profiles_read on public.profiles for select to authenticated using (
  id=(select auth.uid()) or (profile_complete and discoverable and not private.is_blocked_pair((select auth.uid()),id))
);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id=(select auth.uid()));
create policy profile_interests_read on public.profile_interests for select to authenticated using (
  profile_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=profile_id and p.profile_complete and p.discoverable)
);
create policy profile_interests_self_insert on public.profile_interests for insert to authenticated with check (profile_id=(select auth.uid()));
create policy profile_interests_self_delete on public.profile_interests for delete to authenticated using (profile_id=(select auth.uid()));

-- interest signals / views
create policy interest_signals_read_participants on public.profile_interests_signals for select to authenticated using ((select auth.uid()) in (from_user_id,to_user_id));
create policy interest_signals_self_insert on public.profile_interests_signals for insert to authenticated with check (from_user_id=(select auth.uid()) and not private.is_blocked_pair(from_user_id,to_user_id));
create policy interest_signals_self_delete on public.profile_interests_signals for delete to authenticated using (from_user_id=(select auth.uid()));
create policy profile_views_viewed_read on public.profile_views for select to authenticated using (viewed_id=(select auth.uid()));
create policy profile_views_self_insert on public.profile_views for insert to authenticated with check (viewer_id=(select auth.uid()) and not private.is_blocked_pair(viewer_id,viewed_id));

-- connection requests
create policy connection_requests_participants_read on public.connection_requests for select to authenticated using ((select auth.uid()) in (sender_id,receiver_id));
create policy connection_requests_sender_insert on public.connection_requests for insert to authenticated with check (sender_id=(select auth.uid()) and not private.is_blocked_pair(sender_id,receiver_id));
create policy connection_requests_receiver_update on public.connection_requests for update to authenticated using (receiver_id=(select auth.uid())) with check (receiver_id=(select auth.uid()));

-- conversations
create policy conversations_member_read on public.conversations for select to authenticated using (private.is_conversation_member(id,(select auth.uid())));
create policy conversation_members_conversation_read on public.conversation_members for select to authenticated using (private.is_conversation_member(conversation_id,(select auth.uid())));
create policy messages_member_read on public.messages for select to authenticated using (private.is_conversation_member(conversation_id,(select auth.uid())));
create policy messages_member_insert on public.messages for insert to authenticated with check (
  sender_id=(select auth.uid()) and private.is_conversation_member(conversation_id,(select auth.uid())) and
  not exists(
    select 1 from public.conversation_members other
    where other.conversation_id=messages.conversation_id and other.user_id<>(select auth.uid())
      and private.is_blocked_pair((select auth.uid()),other.user_id)
  )
);
create policy messages_sender_update_read on public.messages for update to authenticated using (private.is_conversation_member(conversation_id,(select auth.uid()))) with check (private.is_conversation_member(conversation_id,(select auth.uid())));

-- spaces
create policy spaces_public_read on public.spaces for select to authenticated using (is_public or owner_id=(select auth.uid()));
create policy spaces_owner_insert on public.spaces for insert to authenticated with check (owner_id=(select auth.uid()));
create policy spaces_owner_update on public.spaces for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy spaces_owner_delete on public.spaces for delete to authenticated using (owner_id=(select auth.uid()));
create policy space_members_read on public.space_members for select to authenticated using (
  exists(select 1 from public.spaces s where s.id=space_id and s.is_public) or private.is_space_member(space_id,(select auth.uid()))
);
create policy space_members_self_insert on public.space_members for insert to authenticated with check (user_id=(select auth.uid()));
create policy space_members_self_delete on public.space_members for delete to authenticated using (user_id=(select auth.uid()) and role<>'owner');
create policy space_messages_member_read on public.space_messages for select to authenticated using (private.is_space_member(space_id,(select auth.uid())));
create policy space_messages_member_insert on public.space_messages for insert to authenticated with check (sender_id=(select auth.uid()) and private.is_space_member(space_id,(select auth.uid())));

-- safety
create policy blocks_self_read on public.blocks for select to authenticated using (blocker_id=(select auth.uid()));
create policy blocks_self_insert on public.blocks for insert to authenticated with check (blocker_id=(select auth.uid()));
create policy blocks_self_delete on public.blocks for delete to authenticated using (blocker_id=(select auth.uid()));
create policy reports_self_insert on public.reports for insert to authenticated with check (reporter_id=(select auth.uid()));

-- stars
create policy wallets_self_read on public.star_wallets for select to authenticated using (user_id=(select auth.uid()));
create policy transactions_self_read on public.star_transactions for select to authenticated using (user_id=(select auth.uid()));

-- random chat
create policy queue_self_read on public.random_chat_queue for select to authenticated using (user_id=(select auth.uid()));
create policy sessions_participants_read on public.random_chat_sessions for select to authenticated using ((select auth.uid()) in (user_a,user_b));

-- notifications / push
create policy notifications_self_read on public.notifications for select to authenticated using (user_id=(select auth.uid()));
create policy notifications_self_update on public.notifications for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy push_self_manage on public.push_subscriptions for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

-- ---------- RPCs ----------
create or replace function public.complete_profile(
  p_display_name text,
  p_birth_date date,
  p_country_id uuid,
  p_city_id uuid,
  p_bio text default null,
  p_mood text default null,
  p_interest_ids uuid[] default '{}'
) returns void
language plpgsql security definer set search_path=public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_birth_date is null or p_birth_date > current_date - interval '18 years' then raise exception 'must_be_18_or_older'; end if;
  if not exists(select 1 from public.cities where id=p_city_id and country_id=p_country_id) then raise exception 'city_country_mismatch'; end if;
  update public.profiles set
    display_name=trim(p_display_name), birth_date=p_birth_date, country_id=p_country_id, city_id=p_city_id,
    bio=nullif(trim(coalesce(p_bio,'')),''), mood=p_mood, profile_complete=true, updated_at=now()
  where id=v_user;
  delete from public.profile_interests where profile_id=v_user;
  insert into public.profile_interests(profile_id,interest_id)
    select v_user, i.id from public.interests i where i.id=any(coalesce(p_interest_ids,'{}'::uuid[]));
end; $$;
revoke all on function public.complete_profile(text,date,uuid,uuid,text,text,uuid[]) from public;
grant execute on function public.complete_profile(text,date,uuid,uuid,text,text,uuid[]) to authenticated;

create or replace function public.toggle_interest(p_target uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_on boolean;
begin
  if v_user is null or p_target=v_user or private.is_blocked_pair(v_user,p_target) then raise exception 'not_allowed'; end if;
  if exists(select 1 from public.profile_interests_signals where from_user_id=v_user and to_user_id=p_target) then
    delete from public.profile_interests_signals where from_user_id=v_user and to_user_id=p_target; v_on:=false;
  else
    insert into public.profile_interests_signals(from_user_id,to_user_id) values(v_user,p_target); v_on:=true;
    insert into public.notifications(user_id,type,title,body,data)
      values(p_target,'interest','اهتمام جديد','أحد المستخدمين أبدى اهتمامًا بملفك',jsonb_build_object('from_user_id',v_user));
  end if;
  return v_on;
end; $$;
revoke all on function public.toggle_interest(uuid) from public; grant execute on function public.toggle_interest(uuid) to authenticated;

create or replace function public.send_connection_request(p_target uuid,p_message text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_id uuid;
begin
  if v_user is null or p_target=v_user or private.is_blocked_pair(v_user,p_target) then raise exception 'not_allowed'; end if;
  if not exists(select 1 from public.profiles where id=p_target and profile_complete and allow_invitations) then raise exception 'invitations_disabled'; end if;
  insert into public.connection_requests(sender_id,receiver_id,message) values(v_user,p_target,nullif(left(coalesce(p_message,''),280),'')) returning id into v_id;
  insert into public.notifications(user_id,type,title,body,data) values(p_target,'connection_request','دعوة تعارف جديدة','لديك دعوة تعارف جديدة',jsonb_build_object('request_id',v_id,'from_user_id',v_user));
  return v_id;
end; $$;
revoke all on function public.send_connection_request(uuid,text) from public; grant execute on function public.send_connection_request(uuid,text) to authenticated;

create or replace function public.respond_connection_request(p_request uuid,p_action text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_req public.connection_requests%rowtype; v_conv uuid;
begin
  select * into v_req from public.connection_requests where id=p_request for update;
  if v_req.id is null or v_req.receiver_id<>v_user or v_req.status<>'pending' then raise exception 'request_not_available'; end if;
  if p_action='ignore' then
    update public.connection_requests set status='ignored',updated_at=now() where id=p_request; return null;
  elsif p_action<>'accept' then raise exception 'invalid_action'; end if;
  if private.is_blocked_pair(v_req.sender_id,v_req.receiver_id) then raise exception 'blocked'; end if;
  insert into public.conversations default values returning id into v_conv;
  insert into public.conversation_members(conversation_id,user_id) values(v_conv,v_req.sender_id),(v_conv,v_req.receiver_id);
  update public.connection_requests set status='accepted',updated_at=now() where id=p_request;
  insert into public.notifications(user_id,type,title,body,data) values(v_req.sender_id,'connection_accepted','تم قبول دعوتك','تم قبول دعوة التعارف',jsonb_build_object('conversation_id',v_conv,'user_id',v_user));
  return v_conv;
end; $$;
revoke all on function public.respond_connection_request(uuid,text) from public; grant execute on function public.respond_connection_request(uuid,text) to authenticated;

create or replace function public.block_user(p_target uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null or p_target=v_user then raise exception 'not_allowed'; end if;
  insert into public.blocks(blocker_id,blocked_id) values(v_user,p_target) on conflict do nothing;
  delete from public.connection_requests where status='pending' and ((sender_id=v_user and receiver_id=p_target) or (sender_id=p_target and receiver_id=v_user));
  delete from public.random_chat_queue where user_id in (v_user,p_target);
  update public.random_chat_sessions set status='ended',ended_at=now() where status='active' and ((user_a=v_user and user_b=p_target) or (user_a=p_target and user_b=v_user));
end; $$;
revoke all on function public.block_user(uuid) from public; grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_target uuid)
returns void language plpgsql security definer set search_path=public as $$
begin delete from public.blocks where blocker_id=auth.uid() and blocked_id=p_target; end; $$;
revoke all on function public.unblock_user(uuid) from public; grant execute on function public.unblock_user(uuid) to authenticated;

create or replace function public.report_user(p_target uuid,p_reason text,p_description text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_id uuid;
begin
  if v_user is null or p_target=v_user then raise exception 'not_allowed'; end if;
  insert into public.reports(reporter_id,reported_user_id,reason,description)
    values(v_user,p_target,p_reason,nullif(left(coalesce(p_description,''),1000),'')) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.report_user(uuid,text,text) from public; grant execute on function public.report_user(uuid,text,text) to authenticated;

create or replace function public.record_profile_view(p_target uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null or p_target=v_user or private.is_blocked_pair(v_user,p_target) then return; end if;
  insert into public.profile_views(viewer_id,viewed_id) values(v_user,p_target);
end; $$;
revoke all on function public.record_profile_view(uuid) from public; grant execute on function public.record_profile_view(uuid) to authenticated;

create or replace function public.pin_space_for_24h(p_space_id uuid,p_cost bigint default 100)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_balance bigint; v_until timestamptz;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_cost<=0 then raise exception 'invalid_cost'; end if;
  if not exists(select 1 from public.spaces where id=p_space_id and owner_id=v_user) then raise exception 'not_space_owner'; end if;
  select balance into v_balance from public.star_wallets where user_id=v_user for update;
  if coalesce(v_balance,0)<p_cost then raise exception 'insufficient_stars'; end if;
  update public.star_wallets set balance=balance-p_cost,updated_at=now() where user_id=v_user returning balance into v_balance;
  update public.spaces set pinned_until=greatest(coalesce(pinned_until,now()),now())+interval '24 hours',updated_at=now() where id=p_space_id returning pinned_until into v_until;
  insert into public.star_transactions(user_id,kind,amount,balance_after,reference_type,reference_id) values(v_user,'spend',-p_cost,v_balance,'space_pin',p_space_id);
  return v_until;
end; $$;
revoke all on function public.pin_space_for_24h(uuid,bigint) from public; grant execute on function public.pin_space_for_24h(uuid,bigint) to authenticated;

create or replace function public.random_chat_match()
returns table(session_id uuid, waiting boolean, matched_user_id uuid, display_name text, avatar_url text, city_name text, country_name text, mood text, age integer)
language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_candidate uuid; v_session uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from public.profiles where id=v_user and profile_complete and discoverable) then raise exception 'profile_not_ready'; end if;
  perform pg_advisory_xact_lock(hashtextextended('maarefak_random_chat',0));
  delete from public.random_chat_queue q where q.user_id=v_user;
  select q.user_id into v_candidate
  from public.random_chat_queue q
  join public.profiles p on p.id=q.user_id
  where q.user_id<>v_user and p.profile_complete and p.discoverable and not private.is_blocked_pair(v_user,q.user_id)
  order by q.joined_at asc limit 1 for update skip locked;
  if v_candidate is null then
    insert into public.random_chat_queue(user_id,joined_at) values(v_user,now()) on conflict(user_id) do update set joined_at=excluded.joined_at;
    return query select null::uuid,true,null::uuid,null::text,null::text,null::text,null::text,null::text,null::integer;
    return;
  end if;
  delete from public.random_chat_queue where user_id in (v_user,v_candidate);
  insert into public.random_chat_sessions(user_a,user_b) values(v_user,v_candidate) returning id into v_session;
  return query
    select v_session,false,p.id,p.display_name,p.avatar_url,c.name_ar,co.name_ar,p.mood,
      case when p.show_age and p.birth_date is not null then date_part('year',age(p.birth_date))::int else null end
    from public.profiles p left join public.cities c on c.id=p.city_id left join public.countries co on co.id=p.country_id where p.id=v_candidate;
end; $$;
revoke all on function public.random_chat_match() from public; grant execute on function public.random_chat_match() to authenticated;

create or replace function public.cancel_random_chat()
returns void language plpgsql security definer set search_path=public as $$
begin delete from public.random_chat_queue where user_id=auth.uid(); end; $$;
revoke all on function public.cancel_random_chat() from public; grant execute on function public.cancel_random_chat() to authenticated;


create or replace function public.end_random_chat(p_session uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();
begin
  update public.random_chat_sessions set status='ended',ended_at=now()
  where id=p_session and status='active' and v_user in (user_a,user_b);
end; $$;
revoke all on function public.end_random_chat(uuid) from public;
grant execute on function public.end_random_chat(uuid) to authenticated;

create or replace function public.start_random_chat_conversation(p_session uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_s public.random_chat_sessions%rowtype; v_conv uuid;
begin
  select * into v_s from public.random_chat_sessions where id=p_session for update;
  if v_s.id is null or v_s.status<>'active' or v_user not in (v_s.user_a,v_s.user_b) then raise exception 'session_not_available'; end if;
  if private.is_blocked_pair(v_s.user_a,v_s.user_b) then raise exception 'blocked'; end if;
  if v_s.conversation_id is not null then return v_s.conversation_id; end if;
  insert into public.conversations default values returning id into v_conv;
  insert into public.conversation_members(conversation_id,user_id) values(v_conv,v_s.user_a),(v_conv,v_s.user_b);
  update public.random_chat_sessions set status='converted',conversation_id=v_conv,ended_at=now() where id=p_session;
  return v_conv;
end; $$;
revoke all on function public.start_random_chat_conversation(uuid) from public; grant execute on function public.start_random_chat_conversation(uuid) to authenticated;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path=public,auth as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id=v_user;
end; $$;
revoke all on function public.delete_my_account() from public; grant execute on function public.delete_my_account() to authenticated;

-- ---------- seed lookup data ----------
insert into public.countries(code,name_ar,name_en) values
('EG','مصر','Egypt'),('SA','السعودية','Saudi Arabia'),('AE','الإمارات','United Arab Emirates'),('JO','الأردن','Jordan')
on conflict(code) do update set name_ar=excluded.name_ar,name_en=excluded.name_en;

with c as (select id,code from public.countries where code in ('EG','SA','AE','JO'))
insert into public.cities(country_id,name_ar,name_en)
select c.id,x.name_ar,x.name_en from c join (values
('EG','القاهرة','Cairo'),('EG','الجيزة','Giza'),('EG','الإسكندرية','Alexandria'),('EG','المنصورة','Mansoura'),('EG','طنطا','Tanta'),('EG','الزقازيق','Zagazig'),('EG','الإسماعيلية','Ismailia'),('EG','بورسعيد','Port Said'),('EG','السويس','Suez'),('EG','أسيوط','Assiut'),('EG','سوهاج','Sohag'),('EG','الأقصر','Luxor'),('EG','أسوان','Aswan'),
('SA','الرياض','Riyadh'),('SA','جدة','Jeddah'),('SA','مكة','Makkah'),('SA','المدينة','Madinah'),('SA','الدمام','Dammam'),('SA','الخبر','Khobar'),
('AE','دبي','Dubai'),('AE','أبوظبي','Abu Dhabi'),('AE','الشارقة','Sharjah'),('AE','العين','Al Ain'),
('JO','عمّان','Amman'),('JO','إربد','Irbid'),('JO','الزرقاء','Zarqa'),('JO','العقبة','Aqaba')
) as x(code,name_ar,name_en) on x.code=c.code
on conflict(country_id,name_ar) do update set name_en=excluded.name_en;

insert into public.interests(slug,name_ar) values
('travel','السفر'),('sports','الرياضة'),('football','كرة القدم'),('movies','الأفلام'),('music','الموسيقى'),('reading','القراءة'),('books','الكتب'),('technology','التكنولوجيا'),('ai','الذكاء الاصطناعي'),('gaming','الألعاب'),('photography','التصوير'),('cars','السيارات'),('medicine','الطب'),('entrepreneurship','ريادة الأعمال'),('investing','الاستثمار'),('self-development','التطوير الذاتي'),('cooking','الطبخ'),('coffee','القهوة'),('art','الفن'),('history','التاريخ'),('languages','اللغات'),('fitness','اللياقة'),('walking','المشي'),('volunteering','التطوع')
on conflict(slug) do update set name_ar=excluded.name_ar;

-- ---------- storage ----------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,8388608,array['image/jpeg','image/png','image/webp']),
       ('space-images','space-images',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy avatar_public_read on storage.objects for select to public using (bucket_id='avatars');
create policy avatar_owner_insert on storage.objects for insert to authenticated with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_owner_update on storage.objects for update to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatar_owner_delete on storage.objects for delete to authenticated using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy space_image_public_read on storage.objects for select to public using (bucket_id='space-images');
create policy space_image_owner_insert on storage.objects for insert to authenticated with check (bucket_id='space-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy space_image_owner_update on storage.objects for update to authenticated using (bucket_id='space-images' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='space-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy space_image_owner_delete on storage.objects for delete to authenticated using (bucket_id='space-images' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- ---------- realtime ----------
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then alter publication supabase_realtime add table public.messages; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='space_messages') then alter publication supabase_realtime add table public.space_messages; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then alter publication supabase_realtime add table public.notifications; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='connection_requests') then alter publication supabase_realtime add table public.connection_requests; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='random_chat_sessions') then alter publication supabase_realtime add table public.random_chat_sessions; end if;
end $$;
