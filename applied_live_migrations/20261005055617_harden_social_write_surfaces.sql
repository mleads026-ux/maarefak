-- Applied live on 2026-10-05.


revoke insert, update on table public.social_posts from authenticated,anon;
grant insert(
  user_id,body,media_url,media_path,media_type,topic,daily_question_id
) on table public.social_posts to authenticated;
grant update(
  user_id,body,media_url,media_path,media_type,topic,daily_question_id
) on table public.social_posts to authenticated;

create or replace function private.guard_social_post_media()
returns trigger
language plpgsql
security definer
set search_path='public','storage','private'
as $$
declare
  v_path text;
  v_url_path text;
  v_recent integer;
begin
  if auth.uid() is not null and new.user_id<>auth.uid() then
    raise exception 'social_post_user_mismatch';
  end if;

  if char_length(coalesce(new.topic,''))>80 then
    raise exception 'social_post_topic_too_long';
  end if;

  if tg_op='INSERT' and auth.uid() is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(auth.uid()::text||':social_post',0)
    );

    select count(*)::integer
    into v_recent
    from public.social_posts
    where user_id=auth.uid()
      and created_at>now()-interval '1 hour';

    if v_recent>=30 then
      raise exception 'rate_limited';
    end if;
  end if;

  new.updated_at:=now();

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

    v_url_path:=split_part(
      new.media_url,
      '/storage/v1/object/public/social-media/',
      2
    );

    if v_path is null then
      v_path:=v_url_path;
    elsif v_url_path<>v_path then
      raise exception 'social_media_path_mismatch';
    end if;
  end if;

  if v_path is null then
    raise exception 'social_media_path_required';
  end if;

  if split_part(v_path,'/',1)<>new.user_id::text
     or position('..' in v_path)>0 then
    raise exception 'invalid_social_media_path';
  end if;

  if not exists(
    select 1
    from storage.objects o
    where o.bucket_id='social-media'
      and o.name=v_path
      and o.owner_id=new.user_id::text
  ) then
    raise exception 'social_media_object_not_owned';
  end if;

  new.media_path:=v_path;
  return new;
end
$$;

revoke all on function private.guard_social_post_media() from public,anon,authenticated;

revoke insert on table public.social_post_comments from authenticated,anon;
grant insert(post_id,user_id,body)
on table public.social_post_comments to authenticated;

create or replace function private.guard_social_comment_insert()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_recent integer;
begin
  if auth.uid() is not null and new.user_id<>auth.uid() then
    raise exception 'social_comment_user_mismatch';
  end if;

  if auth.uid() is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(auth.uid()::text||':social_comment',0)
    );

    select count(*)::integer
    into v_recent
    from public.social_post_comments
    where user_id=auth.uid()
      and created_at>now()-interval '1 minute';

    if v_recent>=30 then
      raise exception 'rate_limited';
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists guard_social_comment_insert_trg
on public.social_post_comments;

create trigger guard_social_comment_insert_trg
before insert on public.social_post_comments
for each row execute function private.guard_social_comment_insert();

revoke all on function private.guard_social_comment_insert()
from public,anon,authenticated;

revoke insert on table public.social_post_likes from authenticated,anon;
grant insert(post_id,user_id)
on table public.social_post_likes to authenticated;
