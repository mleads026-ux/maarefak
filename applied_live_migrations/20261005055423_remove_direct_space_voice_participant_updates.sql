-- Applied live on 2026-10-05.


drop policy if exists space_voice_participants_self_update on public.space_voice_participants;
revoke update on table public.space_voice_participants from authenticated,anon;
