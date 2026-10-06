-- Applied live on 2026-10-05.
-- Complete server-side media kill-switch coverage for legacy pending uploads
-- and overwrite/update paths.

drop policy if exists chat_media_owner_upload on storage.objects;
create policy chat_media_owner_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id='chat-media-pending'
  and coalesce((
    select ms.chat_media_uploads_enabled
    from public.app_media_settings ms
    where ms.id=1
  ),false)
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists avatar_owner_update on storage.objects;
create policy avatar_owner_update
on storage.objects
for update
to authenticated
using (
  bucket_id='avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
)
with check (
  bucket_id='avatars'
  and coalesce((
    select ms.avatar_uploads_enabled
    from public.app_media_settings ms
    where ms.id=1
  ),false)
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists social_media_update_own on storage.objects;
create policy social_media_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id='social-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
)
with check (
  bucket_id='social-media'
  and coalesce((
    select ms.social_image_uploads_enabled
    from public.app_media_settings ms
    where ms.id=1
  ),false)
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists space_image_owner_update on storage.objects;
create policy space_image_owner_update
on storage.objects
for update
to authenticated
using (
  bucket_id='space-images'
  and (storage.foldername(name))[1]=(select auth.uid())::text
)
with check (
  bucket_id='space-images'
  and coalesce((
    select ms.space_image_uploads_enabled
    from public.app_media_settings ms
    where ms.id=1
  ),false)
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
