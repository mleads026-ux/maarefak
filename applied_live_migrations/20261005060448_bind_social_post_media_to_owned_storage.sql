-- Applied live on 2026-10-05.
-- Social post media must reference an owned social-media Storage object and obey the media safety switch.

drop policy if exists social_posts_insert on public.social_posts;
create policy social_posts_insert
on public.social_posts
for insert
to authenticated
with check (
  user_id=(select auth.uid())
  and (
    (media_path is null and media_url is null and media_type is null)
    or
    (
      media_type='image'
      and media_path is not null
      and coalesce((
        select ms.social_image_uploads_enabled
        from public.app_media_settings ms
        where ms.id=1
      ),false)
      and split_part(media_path,'/',1)=(select auth.uid())::text
      and exists(
        select 1
        from storage.objects o
        where o.bucket_id='social-media'
          and o.name=social_posts.media_path
          and o.owner_id=(select auth.uid())::text
      )
    )
  )
);

drop policy if exists social_posts_update on public.social_posts;
create policy social_posts_update
on public.social_posts
for update
to authenticated
using (user_id=(select auth.uid()))
with check (
  user_id=(select auth.uid())
  and (
    (media_path is null and media_url is null and media_type is null)
    or
    (
      media_type='image'
      and media_path is not null
      and coalesce((
        select ms.social_image_uploads_enabled
        from public.app_media_settings ms
        where ms.id=1
      ),false)
      and split_part(media_path,'/',1)=(select auth.uid())::text
      and exists(
        select 1
        from storage.objects o
        where o.bucket_id='social-media'
          and o.name=social_posts.media_path
          and o.owner_id=(select auth.uid())::text
      )
    )
  )
);
