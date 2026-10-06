-- Applied live on 2026-10-05.
-- Launch/auth gating settings are client-readable but not client-writable.

revoke insert,update,delete,truncate,references,trigger
on table public.app_auth_launch_settings
from authenticated,anon;

grant select on table public.app_auth_launch_settings to authenticated;
