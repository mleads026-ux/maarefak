-- Applied live on 2026-10-05.
-- Cap untrusted WebRTC signaling JSON to prevent oversized client payload abuse.

alter table public.voice_call_signals
  drop constraint if exists voice_call_signals_payload_size_ck,
  add constraint voice_call_signals_payload_size_ck
    check (octet_length(payload::text) <= 65536);

alter table public.space_voice_signals
  drop constraint if exists space_voice_signals_payload_size_ck,
  add constraint space_voice_signals_payload_size_ck
    check (octet_length(payload::text) <= 65536);

alter table public.speed_intro_signals
  drop constraint if exists speed_intro_signals_payload_size_ck,
  add constraint speed_intro_signals_payload_size_ck
    check (octet_length(payload::text) <= 65536);
