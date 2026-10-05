-- Applied live on 2026-10-05.
-- Add covering indexes for remaining foreign keys reported by Supabase Performance Advisor.

create index if not exists gifts_challenger_a_id_idx
  on public.gifts(challenger_a_id);
create index if not exists gifts_challenger_b_id_idx
  on public.gifts(challenger_b_id);

create index if not exists messages_gift_id_idx
  on public.messages(gift_id);
create index if not exists messages_gift_recipient_id_idx
  on public.messages(gift_recipient_id);
create index if not exists messages_gift_transaction_id_idx
  on public.messages(gift_transaction_id);

create index if not exists social_posts_daily_question_id_idx
  on public.social_posts(daily_question_id);

create index if not exists space_messages_gift_id_idx
  on public.space_messages(gift_id);
create index if not exists space_messages_gift_recipient_id_idx
  on public.space_messages(gift_recipient_id);
create index if not exists space_messages_gift_transaction_id_idx
  on public.space_messages(gift_transaction_id);
