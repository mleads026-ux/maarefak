-- Applied live on 2026-10-05.
-- Future functions in application schemas must not inherit PUBLIC EXECUTE.

alter default privileges for role postgres in schema public
  revoke execute on functions from public;

alter default privileges for role postgres in schema private
  revoke execute on functions from public;

alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

alter default privileges for role postgres in schema private
  grant execute on functions to service_role;
