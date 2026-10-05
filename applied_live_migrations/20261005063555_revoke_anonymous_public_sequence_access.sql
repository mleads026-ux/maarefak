-- Applied live on 2026-10-05.
-- Anonymous clients do not require direct sequence access.

do $$
declare
  r record;
begin
  for r in
    select quote_ident(n.nspname)||'.'||quote_ident(c.relname) as fq
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind='S'
  loop
    execute 'revoke all on sequence '||r.fq||' from anon';
  end loop;
end
$$;
