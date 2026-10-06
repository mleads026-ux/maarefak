-- Applied live on 2026-10-05.


create or replace function private.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','storage'
as $$
declare
  v_avatar_path text;
begin
  -- Legacy managed-field guard retained for compatibility; direct client writes
  -- are additionally restricted by column-level grants.
  if current_user='authenticated' then
    if new.id is distinct from old.id
       or new.profile_complete is distinct from old.profile_complete
       or new.boost_until is distinct from old.boost_until
       or new.status_text is distinct from old.status_text
       or new.status_expires_at is distinct from old.status_expires_at
       or new.available_to_chat_until is distinct from old.available_to_chat_until
       or new.created_at is distinct from old.created_at
       or new.gender is distinct from old.gender
       or new.voice_intro_path is distinct from old.voice_intro_path
       or new.verification_status is distinct from old.verification_status
       or new.verified_at is distinct from old.verified_at
       or new.mystery_discovery_enabled is distinct from old.mystery_discovery_enabled
       or new.social_night_mode is distinct from old.social_night_mode
       or new.profile_theme is distinct from old.profile_theme then
      raise exception 'managed_profile_field';
    end if;
  end if;

  -- A user may only point their own avatar_url at an avatar object they own.
  -- Service/staff operations acting on another profile are not affected.
  if new.avatar_url is distinct from old.avatar_url
     and auth.uid() is not null
     and auth.uid()=old.id then

    if new.avatar_url is not null then
      if position('/storage/v1/object/public/avatars/' in new.avatar_url)=0 then
        raise exception 'invalid_avatar_url';
      end if;

      v_avatar_path:=split_part(
        new.avatar_url,
        '/storage/v1/object/public/avatars/',
        2
      );

      if nullif(v_avatar_path,'') is null
         or split_part(v_avatar_path,'/',1)<>old.id::text
         or position('..' in v_avatar_path)>0 then
        raise exception 'invalid_avatar_path';
      end if;

      if not exists(
        select 1
        from storage.objects o
        where o.bucket_id='avatars'
          and o.name=v_avatar_path
          and o.owner_id=old.id::text
      ) then
        raise exception 'avatar_object_not_owned';
      end if;
    end if;
  end if;

  if new.birth_date is not null
     and new.birth_date>current_date-interval '18 years' then
    raise exception 'must_be_18_or_older';
  end if;

  if new.city_id is not null and new.country_id is not null
     and not exists(
       select 1 from public.cities
       where id=new.city_id and country_id=new.country_id
     ) then
    raise exception 'city_country_mismatch';
  end if;

  if char_length(trim(coalesce(new.display_name,'')))>80 then
    raise exception 'display_name_too_long';
  end if;

  if char_length(coalesce(new.bio,''))>1000 then
    raise exception 'bio_too_long';
  end if;

  new.updated_at:=now();
  return new;
end
$$;

revoke all on function private.guard_profile_update() from public,anon,authenticated;
