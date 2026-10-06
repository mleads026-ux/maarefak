-- Applied live on 2026-10-05.
-- Force report creation and profile-view recording through validated RPCs only.

drop policy if exists reports_insert_self on public.reports;
drop policy if exists profile_views_insert_self on public.profile_views;

revoke insert on table public.reports from authenticated;
revoke insert on table public.profile_views from authenticated;

create or replace function public.report_user(
  p_target uuid,
  p_reason text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid:=auth.uid();
  v_id uuid;
  v_recent integer;
begin
  if v_user is null or p_target=v_user then raise exception 'not_allowed'; end if;
  if p_reason not in ('harassment','inappropriate','impersonation','spam','fraud','other') then
    raise exception 'invalid_reason';
  end if;

  select count(*)::integer into v_recent
  from public.reports
  where reporter_id=v_user
    and created_at>now()-interval '10 minutes';

  if v_recent>=10 then raise exception 'report_rate_limited'; end if;

  insert into public.reports(reporter_id,reported_user_id,reason,description)
  values(
    v_user,p_target,p_reason,
    nullif(left(trim(coalesce(p_description,'')),1000),'')
  )
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.report_user(uuid,text,text) from public,anon;
grant execute on function public.report_user(uuid,text,text) to authenticated;

create or replace function public.record_profile_view(p_target uuid)
returns void
language plpgsql
security definer
set search_path to 'public','private'
as $$
declare
  v_user uuid:=auth.uid();
  v_count integer;
  v_last timestamptz;
  v_reveal boolean:=false;
  v_name text;
begin
  if v_user is null or p_target=v_user or private.is_blocked_pair(v_user,p_target) then return; end if;

  if not exists(
    select 1 from public.profiles
    where id=p_target and profile_complete=true and discoverable=true
  ) then return; end if;

  if exists(
    select 1 from public.profile_views
    where viewer_id=v_user
      and viewed_id=p_target
      and created_at>now()-interval '10 minutes'
  ) then return; end if;

  insert into public.profile_views(viewer_id,viewed_id)
  values(v_user,p_target);

  select count(*)::integer into v_count
  from public.profile_views
  where viewer_id=v_user
    and viewed_id=p_target
    and created_at>now()-interval '7 days';

  if v_count<3 then return; end if;

  select last_notified_at into v_last
  from private.profile_visit_hints
  where viewer_id=v_user and viewed_id=p_target;

  if v_last is not null and v_last>now()-interval '7 days' then return; end if;

  select
    coalesce(v.reveal_visit_identity,true)
    and exists(
      select 1 from public.profile_visitor_unlocks u
      where u.user_id=p_target and u.unlocked_until>now()
    ),
    v.display_name
  into v_reveal,v_name
  from public.profiles v
  where v.id=v_user;

  insert into private.profile_visit_hints(viewer_id,viewed_id,last_notified_at,last_count)
  values(v_user,p_target,now(),v_count)
  on conflict(viewer_id,viewed_id)
  do update set last_notified_at=now(),last_count=excluded.last_count;

  insert into public.notifications(user_id,type,title,body,data)
  values(
    p_target,
    'repeat_profile_visit',
    'دخل مخصوص عشانك 👀',
    case
      when v_reveal then coalesce(v_name,'شخص')||' رجع لبروفايلك أكتر من مرة.'
      else 'في شخص رجع لبروفايلك أكتر من مرة.'
    end,
    case
      when v_reveal then jsonb_build_object('viewer_id',v_user,'visit_count',v_count)
      else jsonb_build_object('visit_count',v_count)
    end
  );
end
$$;

revoke all on function public.record_profile_view(uuid) from public,anon;
grant execute on function public.record_profile_view(uuid) to authenticated;
