-- Applied live on 2026-10-05.
-- Leave only true pre-auth reference data readable by anon.

alter policy connection_requests_participants_read on public.connection_requests to authenticated;
alter policy messages_member_read on public.messages to authenticated;
alter policy notifications_self_read on public.notifications to authenticated;
alter policy sessions_participants_read on public.random_chat_sessions to authenticated;
alter policy space_members_read on public.space_members to authenticated;
alter policy space_messages_member_read on public.space_messages to authenticated;
alter policy transactions_self_read on public.star_transactions to authenticated;
alter policy wallets_self_read on public.star_wallets to authenticated;
