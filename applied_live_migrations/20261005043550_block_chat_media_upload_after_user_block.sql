-- Applied live on 2026-10-05.
-- Once either participant blocks the other, the sender may no longer upload
-- new approved chat media for that conversation.

drop policy if exists chat_media_approved_participant_upload on storage.objects;

create policy chat_media_approved_participant_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id='chat-media-approved'
  and array_length(storage.foldername(name),1)>=2
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and private.is_conversation_member(
    ((storage.foldername(name))[1])::uuid,
    (select auth.uid())
  )
  and not exists(
    select 1
    from public.conversation_members other
    where other.conversation_id=((storage.foldername(name))[1])::uuid
      and other.user_id<>(select auth.uid())
      and private.is_blocked_pair((select auth.uid()),other.user_id)
  )
);
