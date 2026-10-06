-- Applied live on 2026-10-05.
-- Explicitly prevent blocked users from liking/commenting on each other's Social Hub posts
-- and rate-limit like creation.

drop policy if exists social_comments_insert on public.social_post_comments;
create policy social_comments_insert
on public.social_post_comments
for insert
to authenticated
with check (
  user_id=(select auth.uid())
  and exists(
    select 1
    from public.social_posts p
    where p.id=social_post_comments.post_id
      and not private.is_blocked_pair((select auth.uid()),p.user_id)
  )
);

drop policy if exists social_likes_insert on public.social_post_likes;
create policy social_likes_insert
on public.social_post_likes
for insert
to authenticated
with check (
  user_id=(select auth.uid())
  and exists(
    select 1
    from public.social_posts p
    where p.id=social_post_likes.post_id
      and not private.is_blocked_pair((select auth.uid()),p.user_id)
  )
);

create or replace function private.guard_social_like_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public','private'
as $$
declare
  v_recent integer;
  v_owner uuid;
begin
  if auth.uid() is not null and new.user_id<>auth.uid() then
    raise exception 'social_like_user_mismatch';
  end if;

  select p.user_id into v_owner
  from public.social_posts p
  where p.id=new.post_id;

  if v_owner is null then raise exception 'social_post_not_found'; end if;
  if auth.uid() is not null and private.is_blocked_pair(auth.uid(),v_owner) then
    raise exception 'interaction_blocked';
  end if;

  if auth.uid() is not null then
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':social_like',0));
    select count(*)::integer into v_recent
    from public.social_post_likes
    where user_id=auth.uid()
      and created_at>now()-interval '1 minute';
    if v_recent>=120 then raise exception 'rate_limited'; end if;
  end if;

  return new;
end
$$;

drop trigger if exists guard_social_like_insert_trg on public.social_post_likes;
create trigger guard_social_like_insert_trg
before insert on public.social_post_likes
for each row execute function private.guard_social_like_insert();

create or replace function private.guard_social_comment_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public','private'
as $$
declare
  v_recent integer;
  v_owner uuid;
begin
  if auth.uid() is not null and new.user_id<>auth.uid() then
    raise exception 'social_comment_user_mismatch';
  end if;

  select p.user_id into v_owner
  from public.social_posts p
  where p.id=new.post_id;

  if v_owner is null then raise exception 'social_post_not_found'; end if;
  if auth.uid() is not null and private.is_blocked_pair(auth.uid(),v_owner) then
    raise exception 'interaction_blocked';
  end if;

  if auth.uid() is not null then
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':social_comment',0));
    select count(*)::integer into v_recent
    from public.social_post_comments
    where user_id=auth.uid()
      and created_at>now()-interval '1 minute';
    if v_recent>=30 then raise exception 'rate_limited'; end if;
  end if;

  return new;
end
$$;
