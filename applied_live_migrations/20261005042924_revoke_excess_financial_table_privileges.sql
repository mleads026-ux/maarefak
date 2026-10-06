-- Applied live on 2026-10-05.
-- Sensitive financial tables remain readable only where RLS permits.
-- All state changes stay behind trusted RPC/service flows.

revoke truncate, trigger, references
on table public.financial_risk_state
from anon, authenticated;

revoke truncate, trigger, references
on table public.iap_purchases
from anon, authenticated;

revoke truncate, trigger, references
on table public.star_transfers
from anon, authenticated;
