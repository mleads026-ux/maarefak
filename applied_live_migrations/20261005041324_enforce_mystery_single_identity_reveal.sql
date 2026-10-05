-- Applied live on 2026-10-05.
-- Mystery Discovery must reveal exactly one identity element per card:
-- either the display name with a hidden/blurred photo, or the photo with the name hidden.
-- City, mood, shared interests, and a profile/daily prompt remain visible.

drop function if exists public.mystery_discovery_cards(integer);

create function public.mystery_discovery_cards(p_limit integer default 20)
returns table(
  user_id uuid,
  reveal_mode text,
  display_name text,
  avatar_url text,
  mood text,
  city_name text,
  shared_interests integer,
  prompt_text text,
  available_now boolean
)
language sql
security definer
set search_path to 'public','private'
as $function$
  with shared as (
    select pi2.profile_id,count(*)::integer n
    from public.profile_interests pi1
    join public.profile_interests pi2
      on pi2.interest_id=pi1.interest_id
     and pi2.profile_id<>pi1.profile_id
    where pi1.profile_id=auth.uid()
    group by pi2.profile_id
  ),
  today_answer as (
    select da.user_id,da.answer,(da.highlighted_until>now()) as highlighted
    from public.daily_answers da
    join public.daily_questions dq on dq.id=da.question_id
    where dq.active=true and dq.active_date=current_date
  ),
  prompt_pick as (
    select distinct on(pp.user_id)
      pp.user_id,pp.answer
    from public.profile_prompts pp
    order by pp.user_id,pp.sort_order,pp.updated_at desc
  ),
  candidates as (
    select
      p.id,p.display_name,p.avatar_url,p.mood,c.name_ar as city_name,
      coalesce(s.n,0)::integer as shared_interests,
      coalesce(pp.answer,ta.answer) as prompt_text,
      coalesce(ta.highlighted,false) as highlighted,
      coalesce(p.available_to_chat_until>now(),false) as available_now,
      case
        when p.avatar_url is not null
         and substr(md5(p.id::text||':'||auth.uid()::text),1,1)
             in ('0','2','4','6','8','a','c','e')
          then 'photo'
        else 'name'
      end as reveal_mode,
      p.created_at
    from public.profiles p
    left join public.cities c on c.id=p.city_id
    left join shared s on s.profile_id=p.id
    left join today_answer ta on ta.user_id=p.id
    left join prompt_pick pp on pp.user_id=p.id
    where auth.uid() is not null
      and p.id<>auth.uid()
      and p.profile_complete=true
      and p.discoverable=true
      and p.mystery_discovery_enabled=true
      and not private.is_blocked_pair(auth.uid(),p.id)
  )
  select
    c.id,
    c.reveal_mode,
    case when c.reveal_mode='name' then c.display_name else null end,
    case when c.reveal_mode='photo' then c.avatar_url else null end,
    c.mood,c.city_name,c.shared_interests,c.prompt_text,c.available_now
  from candidates c
  order by c.highlighted desc,c.available_now desc,c.shared_interests desc,c.created_at desc
  limit greatest(1,least(coalesce(p_limit,20),50))
$function$;

revoke all on function public.mystery_discovery_cards(integer) from public,anon;
grant execute on function public.mystery_discovery_cards(integer) to authenticated;
