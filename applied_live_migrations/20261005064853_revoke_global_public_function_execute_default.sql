-- Applied live on 2026-10-05.
-- Defense in depth: remove PostgreSQL's global PUBLIC EXECUTE default
-- for future functions created by postgres. Schema-specific service_role
-- grants remain explicit.

alter default privileges for role postgres
  revoke execute on functions from public;
