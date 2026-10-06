-- Applied live on 2026-10-05.


revoke insert, update, delete on table public.notifications from authenticated, anon;
grant select on table public.notifications to authenticated;
grant update(read_at) on table public.notifications to authenticated;

revoke insert on table public.reports from authenticated, anon;
revoke insert on table public.profile_views from authenticated, anon;
