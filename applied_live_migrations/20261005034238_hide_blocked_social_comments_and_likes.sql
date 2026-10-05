-- Applied live on 2026-10-05.
-- Hide comments and likes authored by users who are blocked in either direction.

drop policy if exists social_comments_read on public.social_post_comments;
create policy social_comments_read
on public.social_post_comments
for select
to authenticated
using (
  exists(
    select 1 from public.social_posts p
    where p.id=social_post_comments.post_id
  )
  and (
    user_id=(select auth.uid())
    or not private.is_blocked_pair((select auth.uid()),user_id)
  )
);

drop policy if exists social_likes_read on public.social_post_likes;
create policy social_likes_read
on public.social_post_likes
for select
to authenticated
using (
  exists(
    select 1 from public.social_posts p
    where p.id=social_post_likes.post_id
  )
  and (
    user_id=(select auth.uid())
    or not private.is_blocked_pair((select auth.uid()),user_id)
  )
);
