-- Applied live on 2026-10-05.
-- Remove anonymous/PUBLIC execution from sensitive user and financial RPC wrappers.
-- Authenticated users and service_role retain explicit EXECUTE.

revoke execute on function public.cancel_my_withdrawal(uuid) from public, anon;
grant execute on function public.cancel_my_withdrawal(uuid) to authenticated, service_role;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated, service_role;

revoke execute on function public.delete_payout_method(uuid) from public, anon;
grant execute on function public.delete_payout_method(uuid) to authenticated, service_role;

revoke execute on function public.request_bank_withdrawal(bigint,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.request_bank_withdrawal(bigint,text,text,text,text,text,text,text,text) to authenticated, service_role;

revoke execute on function public.request_mobile_wallet_withdrawal(bigint,text,text) from public, anon;
grant execute on function public.request_mobile_wallet_withdrawal(bigint,text,text) to authenticated, service_role;

revoke execute on function public.request_withdrawal(bigint,text,text) from public, anon;
grant execute on function public.request_withdrawal(bigint,text,text) to authenticated, service_role;

revoke execute on function public.request_withdrawal_to_saved_method(bigint,uuid) from public, anon;
grant execute on function public.request_withdrawal_to_saved_method(bigint,uuid) to authenticated, service_role;

revoke execute on function public.save_bank_payout_method(text,text,text,text,text,text,text,text,text,boolean) from public, anon;
grant execute on function public.save_bank_payout_method(text,text,text,text,text,text,text,text,text,boolean) to authenticated, service_role;

revoke execute on function public.save_mobile_wallet_payout_method(text,text,text,boolean) from public, anon;
grant execute on function public.save_mobile_wallet_payout_method(text,text,text,boolean) to authenticated, service_role;

revoke execute on function public.send_gift(uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.send_gift(uuid,uuid,uuid,uuid) to authenticated, service_role;

revoke execute on function public.send_lamma_chat_gift(uuid,uuid) from public, anon;
grant execute on function public.send_lamma_chat_gift(uuid,uuid) to authenticated, service_role;

revoke execute on function public.set_default_payout_method(uuid) from public, anon;
grant execute on function public.set_default_payout_method(uuid) to authenticated, service_role;

revoke execute on function public.transfer_stars_by_user_id(text,bigint,uuid) from public, anon;
grant execute on function public.transfer_stars_by_user_id(text,bigint,uuid) to authenticated, service_role;
