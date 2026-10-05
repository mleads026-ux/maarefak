-- APPLY ONLY after the client using accept_current_legal(p_adult_confirmed) is deployed and smoke-tested.
-- The zero-argument legacy RPC can record adult_confirmed=true without receiving
-- an explicit confirmation parameter from the caller.

revoke execute on function public.accept_signup_legal() from authenticated;
