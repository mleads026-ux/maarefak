-- Applied live on 2026-10-05.
-- Legal acceptance requires explicit adult confirmation and records the currently active
-- Terms, Privacy, and Community document versions.

create or replace function public.accept_current_legal(p_adult_confirmed boolean)
returns void
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_user uuid:=auth.uid();
  v_terms text;
  v_privacy text;
  v_community text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_adult_confirmed is not true then raise exception 'adult_confirmation_required'; end if;

  select version into v_terms
  from public.legal_documents
  where kind='terms' and active=true
  order by effective_at desc,created_at desc
  limit 1;

  select version into v_privacy
  from public.legal_documents
  where kind='privacy' and active=true
  order by effective_at desc,created_at desc
  limit 1;

  select version into v_community
  from public.legal_documents
  where kind='community' and active=true
  order by effective_at desc,created_at desc
  limit 1;

  if v_terms is null or v_privacy is null or v_community is null then
    raise exception 'legal_documents_not_configured';
  end if;

  insert into public.user_legal_acceptances(user_id,kind,version,adult_confirmed)
  values
    (v_user,'terms',v_terms,true),
    (v_user,'privacy',v_privacy,true),
    (v_user,'community',v_community,true)
  on conflict(user_id,kind,version) do update
    set adult_confirmed=true;
end
$$;

revoke all on function public.accept_current_legal(boolean) from public,anon;
grant execute on function public.accept_current_legal(boolean) to authenticated;
