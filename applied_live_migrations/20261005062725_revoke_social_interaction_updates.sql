-- Applied live on 2026-10-05.
-- Social comments/likes are create/delete interactions; clients do not edit existing rows.

revoke update on table public.social_post_comments from authenticated;
revoke update on table public.social_post_likes from authenticated;
revoke update on table public.social_post_comments from anon;
revoke update on table public.social_post_likes from anon;
