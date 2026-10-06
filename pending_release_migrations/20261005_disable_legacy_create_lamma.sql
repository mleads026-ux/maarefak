-- APPLY ONLY after the client using create_lamma_v3 is deployed and smoke-tested.
-- The legacy create_lamma RPC does not enforce the current host-terms and host-eligibility flow.

revoke execute on function public.create_lamma(text,text,text,text,boolean,text) from authenticated;
