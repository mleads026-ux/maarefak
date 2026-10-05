-- Applied live on 2026-10-05.
-- Protect direct text-message and WebRTC signaling surfaces from client flooding.

create or replace function private.guard_private_text_message_rate()
returns trigger
language plpgsql
security definer
set search_path to 'public','private'
as $$
declare
  v_user uuid:=auth.uid();
  v_recent integer;
begin
  if v_user is null or new.message_type<>'text' then return new; end if;
  if new.sender_id<>v_user then raise exception 'message_sender_mismatch'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text||':private_text',0));

  select count(*)::integer into v_recent
  from public.messages
  where sender_id=v_user
    and message_type='text'
    and created_at>now()-interval '1 minute';

  if v_recent>=60 then raise exception 'message_rate_limited'; end if;
  return new;
end
$$;

drop trigger if exists guard_private_text_message_rate_trg on public.messages;
create trigger guard_private_text_message_rate_trg
before insert on public.messages
for each row execute function private.guard_private_text_message_rate();

create or replace function private.guard_space_text_message_rate()
returns trigger
language plpgsql
security definer
set search_path to 'public','private'
as $$
declare
  v_user uuid:=auth.uid();
  v_recent integer;
begin
  if v_user is null or new.message_type<>'text' then return new; end if;
  if new.sender_id<>v_user then raise exception 'space_message_sender_mismatch'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text||':space_text',0));

  select count(*)::integer into v_recent
  from public.space_messages
  where sender_id=v_user
    and message_type='text'
    and created_at>now()-interval '1 minute';

  if v_recent>=120 then raise exception 'message_rate_limited'; end if;
  return new;
end
$$;

drop trigger if exists guard_space_text_message_rate_trg on public.space_messages;
create trigger guard_space_text_message_rate_trg
before insert on public.space_messages
for each row execute function private.guard_space_text_message_rate();

create or replace function private.guard_voice_signal_rate()
returns trigger
language plpgsql
security definer
set search_path to 'public','private'
as $$
declare
  v_user uuid:=auth.uid();
  v_recent integer;
begin
  if v_user is null then return new; end if;
  if new.sender_id<>v_user then raise exception 'signal_sender_mismatch'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user::text||':'||tg_table_name||':signal',0)
  );

  if tg_table_name='voice_call_signals' then
    select count(*)::integer into v_recent
    from public.voice_call_signals
    where sender_id=v_user and created_at>now()-interval '1 minute';
  elsif tg_table_name='space_voice_signals' then
    select count(*)::integer into v_recent
    from public.space_voice_signals
    where sender_id=v_user and created_at>now()-interval '1 minute';
  elsif tg_table_name='speed_intro_signals' then
    select count(*)::integer into v_recent
    from public.speed_intro_signals
    where sender_id=v_user and created_at>now()-interval '1 minute';
  else
    raise exception 'unsupported_signal_table';
  end if;

  if v_recent>=300 then raise exception 'signal_rate_limited'; end if;
  return new;
end
$$;

drop trigger if exists guard_voice_call_signal_rate_trg on public.voice_call_signals;
create trigger guard_voice_call_signal_rate_trg
before insert on public.voice_call_signals
for each row execute function private.guard_voice_signal_rate();

drop trigger if exists guard_space_voice_signal_rate_trg on public.space_voice_signals;
create trigger guard_space_voice_signal_rate_trg
before insert on public.space_voice_signals
for each row execute function private.guard_voice_signal_rate();

drop trigger if exists guard_speed_intro_signal_rate_trg on public.speed_intro_signals;
create trigger guard_speed_intro_signal_rate_trg
before insert on public.speed_intro_signals
for each row execute function private.guard_voice_signal_rate();
