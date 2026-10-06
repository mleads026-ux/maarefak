-- Applied live on 2026-10-05.
-- Server-side media upload/RPC paths now obey app_media_settings.chat_media_uploads_enabled.
-- The flag was left TRUE during the legacy-client compatibility period.

drop policy if exists chat_media_approved_participant_upload on storage.objects;
create policy chat_media_approved_participant_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id='chat-media-approved'
  and coalesce((
    select ms.chat_media_uploads_enabled
    from public.app_media_settings ms
    where ms.id=1
  ),false)
  and array_length(storage.foldername(name),1)>=2
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and private.is_conversation_member(
    ((storage.foldername(name))[1])::uuid,
    (select auth.uid())
  )
  and not exists(
    select 1
    from public.conversation_members other
    where other.conversation_id=((storage.foldername(objects.name))[1])::uuid
      and other.user_id<>(select auth.uid())
      and private.is_blocked_pair((select auth.uid()),other.user_id)
  )
);

create or replace function public.create_media_message(
  p_conversation uuid,
  p_media_path text,
  p_kind text,
  p_duration_seconds numeric default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','storage'
as $$
declare
  v_user uuid:=auth.uid();
  v_id uuid;
  v_parts text[];
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  if not coalesce((
    select chat_media_uploads_enabled
    from public.app_media_settings
    where id=1
  ),false) then
    raise exception 'media_uploads_disabled';
  end if;

  if not private.is_conversation_member(p_conversation,v_user) then
    raise exception 'not_a_member';
  end if;

  if exists(
    select 1
    from public.conversation_members other
    where other.conversation_id=p_conversation
      and other.user_id<>v_user
      and private.is_blocked_pair(v_user,other.user_id)
  ) then
    raise exception 'conversation_unavailable';
  end if;

  if p_kind not in ('image','video') then raise exception 'invalid_media_kind'; end if;

  v_parts:=string_to_array(p_media_path,'/');
  if array_length(v_parts,1)<3
     or v_parts[1]<>p_conversation::text
     or v_parts[2]<>v_user::text then
    raise exception 'invalid_media_path';
  end if;

  if not exists(
    select 1 from storage.objects o
    where o.bucket_id='chat-media-approved'
      and o.name=p_media_path
      and o.owner_id=v_user::text
  ) then
    raise exception 'media_object_not_owned';
  end if;

  if p_kind='video'
     and (p_duration_seconds is null or p_duration_seconds<=0 or p_duration_seconds>10) then
    raise exception 'video_duration_exceeded';
  end if;

  insert into public.messages(
    conversation_id,sender_id,body,message_type,media_path,
    media_duration_seconds,moderation_status
  )
  values(
    p_conversation,v_user,'',p_kind,p_media_path,
    case when p_kind='video' then p_duration_seconds else null end,
    'approved'
  )
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.create_media_message(uuid,text,text,numeric) from public,anon;
grant execute on function public.create_media_message(uuid,text,text,numeric) to authenticated;
