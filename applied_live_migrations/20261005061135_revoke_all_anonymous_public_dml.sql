-- Applied live on 2026-10-05.
-- Anonymous visitors may retain required SELECT access, but receive no direct DML privileges.

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
    execute 'revoke insert,update,delete,truncate,references,trigger on table '||r.fq||' from anon';
  end loop;
end
$$;
