-- Applied live on 2026-10-05.
-- Phase 1: prepare social post media for private-bucket signed URL access
-- without changing the bucket's public flag yet.

alter table public.social_posts
  add column if not exists media_path text;

update public.social_posts
set media_path=split_part(media_url,'/storage/v1/object/public/social-media/',2)
where media_path is null
  and media_url is not null
  and position('/storage/v1/object/public/social-media/' in media_url)>0;

create or replace function private.guard_social_post_media()
returns trigger
language plpgsql
security definer
set search_path=public,storage,private
as $$
declare
  v_path text;
  v_url_path text;
begin
  if auth.uid() is not null and new.user_id<>auth.uid() then
    raise exception 'social_post_user_mismatch';
  end if;

  if new.media_type is null then
    if new.media_url is not null or new.media_path is not null then
      raise exception 'social_post_media_type_required';
    end if;
    return new;
  end if;

  if new.media_type<>'image' then
    raise exception 'unsupported_social_media_type';
  end if;

  v_path:=nullif(btrim(new.media_path),'');
  if new.media_url is not null then
    if position('/storage/v1/object/public/social-media/' in new.media_url)=0 then
      raise exception 'invalid_social_media_url';
    end if;
    v_url_path:=split_part(new.media_url,'/storage/v1/object/public/social-media/',2);
    if v_path is null then
      v_path:=v_url_path;
    elsif v_url_path<>v_path then
      raise exception 'social_media_path_mismatch';
    end if;
  end if;

  if v_path is null then
    raise exception 'social_media_path_required';
  end if;

  if split_part(v_path,'/',1)<>new.user_id::text or position('..' in v_path)>0 then
    raise exception 'invalid_social_media_path';
  end if;

  if not exists(
    select 1 from storage.objects o
    where o.bucket_id='social-media' and o.name=v_path
  ) then
    raise exception 'social_media_object_not_found';
  end if;

  new.media_path:=v_path;
  return new;
end
$$;

drop trigger if exists guard_social_post_media_trg on public.social_posts;
create trigger guard_social_post_media_trg
before insert or update on public.social_posts
for each row execute function private.guard_social_post_media();

revoke all on function private.guard_social_post_media() from public,anon,authenticated;

drop policy if exists social_media_visible_read on storage.objects;
create policy social_media_visible_read
on storage.objects
for select
to authenticated
using (
  bucket_id='social-media'
  and exists(
    select 1
    from public.social_posts sp
    join public.profiles p on p.id=sp.user_id
    where sp.media_path=objects.name
      and (
        sp.user_id=(select auth.uid())
        or (
          p.profile_complete=true
          and p.discoverable=true
          and not private.is_blocked_pair((select auth.uid()),sp.user_id)
        )
      )
  )
);
