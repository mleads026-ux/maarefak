create sequence if not exists public.lamma_public_id_seq start 100001;

alter table public.spaces
  add column if not exists public_lamma_id text;

update public.spaces
set public_lamma_id='LM'||lpad(nextval('public.lamma_public_id_seq')::text,6,'0')
where public_lamma_id is null;

alter table public.spaces
  alter column public_lamma_id set default ('LM'||lpad(nextval('public.lamma_public_id_seq')::text,6,'0')),
  alter column public_lamma_id set not null;

create unique index if not exists spaces_public_lamma_id_uq
  on public.spaces(public_lamma_id);

create or replace function public.delete_my_lamma(p_space uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  delete from public.spaces where id=p_space and owner_id=v_user;
  if not found then raise exception 'not_owner_or_not_found'; end if;
end
$$;

revoke all on function public.delete_my_lamma(uuid) from public;
revoke execute on function public.delete_my_lamma(uuid) from anon;
grant execute on function public.delete_my_lamma(uuid) to authenticated;
