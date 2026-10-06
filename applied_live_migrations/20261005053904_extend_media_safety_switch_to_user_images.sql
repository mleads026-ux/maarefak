-- Applied live on 2026-10-05.
-- Extend the central moderation safety switch to every user-visible image-upload bucket.
-- All flags remain TRUE during the legacy-client compatibility period.

alter table public.app_media_settings
  add column if not exists avatar_uploads_enabled boolean not null default true,
  add column if not exists social_image_uploads_enabled boolean not null default true,
  add column if not exists private_photo_uploads_enabled boolean not null default true,
  add column if not exists space_image_uploads_enabled boolean not null default true;

drop policy if exists avatar_owner_insert on storage.objects;
create policy avatar_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='avatars'
  and coalesce((select ms.avatar_uploads_enabled from public.app_media_settings ms where ms.id=1),false)
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists social_media_insert_own on storage.objects;
create policy social_media_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id='social-media'
  and coalesce((select ms.social_image_uploads_enabled from public.app_media_settings ms where ms.id=1),false)
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists private_profile_photo_owner_upload on storage.objects;
create policy private_profile_photo_owner_upload
on storage.objects
for insert
to authenticated
with check (
  bucket_id='private-profile-photos'
  and coalesce((select ms.private_photo_uploads_enabled from public.app_media_settings ms where ms.id=1),false)
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists space_image_owner_insert on storage.objects;
create policy space_image_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id='space-images'
  and coalesce((select ms.space_image_uploads_enabled from public.app_media_settings ms where ms.id=1),false)
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
