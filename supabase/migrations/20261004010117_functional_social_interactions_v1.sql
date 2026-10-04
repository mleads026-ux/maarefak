create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  media_url text,
  media_type text check (media_type in ('image','video') or media_type is null),
  topic text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce(length(trim(body)),0) > 0 or media_url is not null),
  check (body is null or char_length(body) <= 1000)
);

create table if not exists public.social_post_likes (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);

create table if not exists public.social_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_social_posts_created on public.social_posts(created_at desc);
create index if not exists idx_social_posts_user_created on public.social_posts(user_id,created_at desc);
create index if not exists idx_social_post_comments_post_created on public.social_post_comments(post_id,created_at);
create index if not exists idx_social_post_likes_post on public.social_post_likes(post_id);

alter table public.social_posts enable row level security;
alter table public.social_post_likes enable row level security;
alter table public.social_post_comments enable row level security;

drop policy if exists social_posts_read on public.social_posts;
create policy social_posts_read on public.social_posts
for select to authenticated
using (
  user_id=(select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.id=user_id
      and p.profile_complete=true
      and p.discoverable=true
      and not private.is_blocked_pair((select auth.uid()),user_id)
  )
);

drop policy if exists social_posts_insert on public.social_posts;
create policy social_posts_insert on public.social_posts
for insert to authenticated
with check (user_id=(select auth.uid()));

drop policy if exists social_posts_update on public.social_posts;
create policy social_posts_update on public.social_posts
for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));

drop policy if exists social_posts_delete on public.social_posts;
create policy social_posts_delete on public.social_posts
for delete to authenticated
using (user_id=(select auth.uid()));

drop policy if exists social_likes_read on public.social_post_likes;
create policy social_likes_read on public.social_post_likes
for select to authenticated
using (exists(select 1 from public.social_posts p where p.id=post_id));

drop policy if exists social_likes_insert on public.social_post_likes;
create policy social_likes_insert on public.social_post_likes
for insert to authenticated
with check (
  user_id=(select auth.uid())
  and exists(select 1 from public.social_posts p where p.id=post_id)
);

drop policy if exists social_likes_delete on public.social_post_likes;
create policy social_likes_delete on public.social_post_likes
for delete to authenticated
using (user_id=(select auth.uid()));

drop policy if exists social_comments_read on public.social_post_comments;
create policy social_comments_read on public.social_post_comments
for select to authenticated
using (exists(select 1 from public.social_posts p where p.id=post_id));

drop policy if exists social_comments_insert on public.social_post_comments;
create policy social_comments_insert on public.social_post_comments
for insert to authenticated
with check (
  user_id=(select auth.uid())
  and exists(select 1 from public.social_posts p where p.id=post_id)
);

drop policy if exists social_comments_delete on public.social_post_comments;
create policy social_comments_delete on public.social_post_comments
for delete to authenticated
using (user_id=(select auth.uid()));

grant select,insert,update,delete on public.social_posts to authenticated;
grant select,insert,delete on public.social_post_likes to authenticated;
grant select,insert,delete on public.social_post_comments to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('social-media','social-media',true,20971520,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'])
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists social_media_insert_own on storage.objects;
create policy social_media_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id='social-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists social_media_select_own on storage.objects;
create policy social_media_select_own on storage.objects
for select to authenticated
using (
  bucket_id='social-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists social_media_update_own on storage.objects;
create policy social_media_update_own on storage.objects
for update to authenticated
using (
  bucket_id='social-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
)
with check (
  bucket_id='social-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

drop policy if exists social_media_delete_own on storage.objects;
create policy social_media_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id='social-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
