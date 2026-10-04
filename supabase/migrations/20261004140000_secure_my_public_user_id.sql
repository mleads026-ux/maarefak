create or replace function public.my_public_user_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.public_user_id
  from public.profiles p
  where p.id = auth.uid()
$$;

revoke all on function public.my_public_user_id() from public;
grant execute on function public.my_public_user_id() to authenticated;