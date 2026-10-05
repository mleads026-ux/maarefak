-- Applied live on 2026-10-05.
-- Prevent authenticated clients from forging room gift messages.
-- Legitimate gift messages are inserted by the SECURITY DEFINER gift logging trigger.

create or replace function private.guard_space_message_insert()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_count integer;
begin
  if v_uid is not null and new.sender_id<>v_uid then
    raise exception 'sender_mismatch';
  end if;

  if current_user='authenticated' and new.message_type<>'text' then
    raise exception 'non_text_space_messages_must_use_secure_flow';
  end if;

  if exists(
    select 1
    from public.space_member_moderation
    where space_id=new.space_id
      and user_id=new.sender_id
      and (
        permanently_banned=true
        or coalesce(banned_until,'-infinity'::timestamptz)>now()
        or coalesce(text_muted_until,'-infinity'::timestamptz)>now()
      )
  ) then
    raise exception 'text_not_allowed';
  end if;

  if char_length(trim(coalesce(new.body,'')))<1 or char_length(new.body)>4000 then
    raise exception 'invalid_message_length';
  end if;

  if v_uid is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':space_message',0));
    select count(*) into v_count
    from public.space_messages
    where sender_id=v_uid
      and created_at>now()-interval '1 minute';
    if v_count>=90 then
      raise exception 'rate_limited';
    end if;
  end if;

  return new;
end
$$;

revoke all on function private.guard_space_message_insert() from public, anon, authenticated;
