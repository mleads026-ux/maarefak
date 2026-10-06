-- Lammetna V14 security hardening
-- MFA backend guard for sensitive user actions.

create or replace function private.assert_mfa_if_enrolled()
returns void
language plpgsql
security definer
set search_path=auth,public,private
as $$
declare
  v_user uuid:=auth.uid();
  v_aal text:=coalesce(auth.jwt()->>'aal','aal1');
begin
  if v_user is null then raise exception 'authentication_required'; end if;

  if exists(
    select 1 from auth.mfa_factors
    where user_id=v_user and status='verified'
  ) and v_aal<>'aal2' then
    raise exception 'mfa_required';
  end if;
end
$$;

revoke all on function private.assert_mfa_if_enrolled() from public;
revoke execute on function private.assert_mfa_if_enrolled() from anon;
revoke execute on function private.assert_mfa_if_enrolled() from authenticated;

-- Live project migration renamed the original sensitive RPCs to *_core_v14
-- and recreated the original public signatures as MFA-guarded wrappers.
-- The live migration is authoritative for those wrapper bodies.
