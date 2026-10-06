-- Applied live on 2026-10-05.
-- Cover the user_id foreign key used by private lamma password-attempt cleanup/lookups.

create index if not exists lamma_access_attempts_user_id_idx
  on private.lamma_access_attempts(user_id);
