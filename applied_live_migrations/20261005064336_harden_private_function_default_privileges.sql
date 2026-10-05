-- Applied live on 2026-10-05.
-- Future private helper functions are not executable by PUBLIC by default.
-- service_role keeps backend default access.

alter default privileges for role postgres in schema private
  revoke execute on functions from public;

alter default privileges for role postgres in schema private
  grant execute on functions to service_role;
