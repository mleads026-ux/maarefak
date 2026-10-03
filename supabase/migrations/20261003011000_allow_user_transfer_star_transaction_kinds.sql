alter table public.star_transactions drop constraint if exists star_transactions_kind_check;
alter table public.star_transactions add constraint star_transactions_kind_check check (kind = any (array['purchase'::text,'spend'::text,'grant'::text,'refund'::text,'user_transfer_out'::text,'user_transfer_in'::text]));
