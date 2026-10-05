-- Applied live on 2026-10-05.
-- Central safety switch for chat images/videos.
-- Kept enabled during compatibility period so the legacy Production client continues to work.

create table if not exists public.app_media_settings(
  id integer primary key default 1 check(id=1),
  chat_media_uploads_enabled boolean not null default true,
  moderation_required boolean not null default true,
  moderation_provider text not null default 'unconfigured',
  updated_at timestamptz not null default now()
);

insert into public.app_media_settings(
  id,chat_media_uploads_enabled,moderation_required,moderation_provider
)
values(1,true,true,'unconfigured')
on conflict(id) do nothing;

alter table public.app_media_settings enable row level security;

drop policy if exists app_media_settings_authenticated_read on public.app_media_settings;
create policy app_media_settings_authenticated_read
on public.app_media_settings
for select
to authenticated
using (id=1);

revoke all on table public.app_media_settings from public,anon;
grant select on table public.app_media_settings to authenticated;
