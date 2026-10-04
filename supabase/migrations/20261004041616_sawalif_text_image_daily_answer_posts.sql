alter table public.social_posts
  add column if not exists daily_question_id uuid references public.daily_questions(id) on delete set null;

create unique index if not exists uq_social_posts_daily_answer
  on public.social_posts(user_id, daily_question_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'social_posts_media_type_image_only'
      and conrelid = 'public.social_posts'::regclass
  ) then
    alter table public.social_posts
      add constraint social_posts_media_type_image_only
      check (media_type is null or media_type = 'image') not valid;
  end if;
end $$;

update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp']::text[]
where id = 'social-media';
