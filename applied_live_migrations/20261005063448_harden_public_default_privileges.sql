-- Applied live on 2026-10-05.
-- Future application objects in public start closed to anon/authenticated.
-- service_role defaults are intentionally preserved.

alter default privileges for role postgres in schema public
  revoke all on tables from anon,authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon,authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon,authenticated;
