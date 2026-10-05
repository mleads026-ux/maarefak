-- Applied live on 2026-10-05.
-- WebRTC clients only INSERT and SELECT signal rows; mutation grants were residual.

revoke update,delete on table public.voice_call_signals from authenticated;
revoke update,delete on table public.space_voice_signals from authenticated;
revoke update,delete on table public.voice_call_signals from anon;
revoke update,delete on table public.space_voice_signals from anon;
