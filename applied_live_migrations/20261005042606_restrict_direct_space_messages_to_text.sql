-- Applied live on 2026-10-05.
-- Authenticated clients may insert plain text room messages only.
-- Gift/non-text message types must use secure server-authoritative flows.

drop policy if exists space_messages_member_insert on public.space_messages;
create policy space_messages_member_insert
on public.space_messages
for insert
to authenticated
with check (
  sender_id=(select auth.uid())
  and message_type='text'
  and gift_transaction_id is null
  and gift_id is null
  and gift_recipient_id is null
  and exists(
    select 1 from public.space_members sm
    where sm.space_id=space_messages.space_id
      and sm.user_id=(select auth.uid())
  )
);
