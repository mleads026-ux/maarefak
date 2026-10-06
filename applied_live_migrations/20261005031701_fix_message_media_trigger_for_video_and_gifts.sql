-- Applied live on 2026-10-05.
-- Fix legacy message media normalization so V8 video and gift messages are preserved.

create or replace function private.enforce_message_media_state()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.message_type='image' then
    if nullif(trim(coalesce(new.media_path,'')),'') is null then
      raise exception 'image_path_required';
    end if;
    new.body := coalesce(new.body,'');
    new.media_duration_seconds := null;
    new.moderation_status := 'approved';
    new.moderation_reason := null;

  elsif new.message_type='video' then
    if nullif(trim(coalesce(new.media_path,'')),'') is null then
      raise exception 'video_path_required';
    end if;
    if new.media_duration_seconds is null
       or new.media_duration_seconds <= 0
       or new.media_duration_seconds > 10 then
      raise exception 'video_duration_exceeded';
    end if;
    new.body := coalesce(new.body,'');
    new.moderation_status := 'approved';
    new.moderation_reason := null;

  elsif new.message_type='gift' then
    new.media_path := null;
    new.media_duration_seconds := null;
    new.moderation_status := 'approved';
    new.moderation_reason := null;

  else
    new.message_type := 'text';
    new.media_path := null;
    new.media_duration_seconds := null;
    new.moderation_status := 'approved';
    new.moderation_reason := null;
  end if;

  return new;
end
$$;

revoke all on function private.enforce_message_media_state() from public, anon, authenticated;
