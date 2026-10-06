-- Applied live on 2026-10-05.
-- These policies already required auth.uid(), but scoping them explicitly to
-- authenticated removes anonymous policy evaluation from the write surface.

alter policy blocks_self_manage on public.blocks to authenticated;
alter policy messages_member_insert on public.messages to authenticated;
alter policy notifications_self_update on public.notifications to authenticated;
alter policy interest_signals_self_manage on public.profile_interests_signals to authenticated;
alter policy profile_views_insert_self on public.profile_views to authenticated;
alter policy profiles_insert_self on public.profiles to authenticated;
alter policy profiles_update_self on public.profiles to authenticated;
alter policy push_self_manage on public.push_subscriptions to authenticated;
alter policy queue_self_manage on public.random_chat_queue to authenticated;
alter policy reports_insert_self on public.reports to authenticated;
alter policy space_members_self_delete on public.space_members to authenticated;
alter policy space_messages_member_insert on public.space_messages to authenticated;
