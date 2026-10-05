-- Applied live on 2026-10-05.
-- Public-room membership remains readable to signed-in users.
-- Private-room membership is readable only to its owner or an existing member.

create or replace function private.can_read_space_members(p_space uuid,p_user uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.spaces s
    where s.id=p_space
      and (
        s.is_public=true
        or s.owner_id=p_user
        or exists(
          select 1
          from public.space_members sm
          where sm.space_id=p_space
            and sm.user_id=p_user
        )
      )
  );
$$;

revoke all on function private.can_read_space_members(uuid,uuid) from public,anon;
grant execute on function private.can_read_space_members(uuid,uuid) to authenticated;

drop policy if exists space_members_read on public.space_members;
create policy space_members_read
on public.space_members
for select
to authenticated
using (
  private.can_read_space_members(space_id,(select auth.uid()))
);
