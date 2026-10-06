create index if not exists idx_social_post_comments_user on public.social_post_comments(user_id);
create index if not exists idx_social_post_likes_user on public.social_post_likes(user_id);
