-- Applied live on 2026-10-05.
-- Disable the legacy no-argument acceptance path that implicitly recorded adult_confirmed=true.
-- The supported user-facing path is accept_current_legal(boolean), which requires an explicit true.

revoke execute on function public.accept_signup_legal() from authenticated;
revoke execute on function public.accept_signup_legal() from anon;
