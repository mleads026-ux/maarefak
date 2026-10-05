-- Applied live on 2026-10-05.
-- Signed-out clients only need the active legal documents used by Signup.

do $$
declare
  r record;
begin
  for r in
    select quote_ident(n.nspname)||'.'||quote_ident(c.relname) as fq
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind in ('r','p')
  loop
    execute 'revoke select on table '||r.fq||' from anon';
  end loop;
end
$$;

grant select on table public.legal_documents to anon;
