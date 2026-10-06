-- Applied live on 2026-10-05.
-- Central media safety settings are readable by authenticated clients but writable only by backend/service paths.

revoke insert,update,delete,truncate,references,trigger
on table public.app_media_settings
from authenticated,anon;

grant select on table public.app_media_settings to authenticated;
