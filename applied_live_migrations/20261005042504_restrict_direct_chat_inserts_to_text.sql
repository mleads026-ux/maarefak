-- Applied live on 2026-10-05.
-- Authenticated clients may insert text messages directly.
-- Media and gift message types must use their server-authoritative RPC flows.

drop policy if exists messages_member_insert on public.messages;
create policy messages_member_insert
on public.messages
for insert
to authenticated
with check (
  sender_id=(select auth.uid())
  and message_type='text'
  and media_path is null
  and media_duration_seconds is null
  and gift_transaction_id is null
  and gift_id is null
  and gift_recipient_id is null
  and exists(
    select 1 from public.conversation_members cm
    where cm.conversation_id=messages.conversation_id
      and cm.user_id=(select auth.uid())
  )
  and not exists(
    select 1
    from public.blocks b
    join public.conversation_members other
      on other.conversation_id=messages.conversation_id
     and other.user_id<>(select auth.uid())
    where (b.blocker_id=(select auth.uid()) and b.blocked_id=other.user_id)
       or (b.blocker_id=other.user_id and b.blocked_id=(select auth.uid()))
  )
);
