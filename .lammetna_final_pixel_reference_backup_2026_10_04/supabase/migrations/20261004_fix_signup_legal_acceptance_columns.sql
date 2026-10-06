create or replace function public.accept_signup_legal()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_terms text;
  v_privacy text;
  v_community text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select version into v_terms
  from public.legal_documents
  where kind='terms' and active=true
  order by effective_at desc
  limit 1;

  select version into v_privacy
  from public.legal_documents
  where kind='privacy' and active=true
  order by effective_at desc
  limit 1;

  select version into v_community
  from public.legal_documents
  where kind='community' and active=true
  order by effective_at desc
  limit 1;

  if v_terms is null or v_privacy is null or v_community is null then
    raise exception 'LEGAL_DOCUMENTS_NOT_CONFIGURED';
  end if;

  insert into public.user_legal_acceptances(user_id, kind, version, adult_confirmed)
  values
    (v_uid, 'terms', v_terms, true),
    (v_uid, 'privacy', v_privacy, true),
    (v_uid, 'community', v_community, true)
  on conflict do nothing;
end
$function$;

revoke execute on function public.accept_signup_legal() from public, anon;
grant execute on function public.accept_signup_legal() to authenticated;
