-- APPLY ONLY after the web/mobile client using the delete-account Edge Function is deployed and smoke-tested.
-- Forces all user-initiated account deletion through Storage API cleanup first.

revoke execute on function public.delete_my_account() from authenticated;
