-- APPLY ONLY after the client using complete_profile_v2 is deployed and smoke-tested.
-- The v2 RPC is the canonical profile-completion surface.

revoke execute on function public.complete_profile(text,date,uuid,uuid,text,text,uuid[],text) from authenticated;
