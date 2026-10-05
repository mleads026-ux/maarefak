-- Applied live on 2026-10-05.
-- Remove residual client mutation grants from RPC-owned audit/event tables.

revoke insert,update,delete on table public.reports from authenticated;
revoke insert,update,delete on table public.profile_views from authenticated;
revoke insert,update,delete on table public.reports from anon;
revoke insert,update,delete on table public.profile_views from anon;
