-- Applied live on 2026-10-05.
-- Reuses the existing MFA rule before the storage-safe delete-account Edge Function can proceed.

create or replace function public.assert_account_deletion_allowed()
returns boolean
language plpgsql
security definer
set search_path='public','private'
as $$
begin
  perform private.assert_mfa_if_enrolled();
  return true;
end
$$;

revoke all on function public.assert_account_deletion_allowed() from public,anon;
grant execute on function public.assert_account_deletion_allowed() to authenticated;
