-- APPLY ONLY after the client using join_lamma_v2 is deployed and smoke-tested.
-- join_lamma_v2 adds persistent brute-force protection for private lamma passwords.

revoke execute on function public.join_lamma(uuid,text) from authenticated;
