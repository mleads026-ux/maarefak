# Lammetna security snapshot — 2026-10-05

## Verified database posture

- Public tables without RLS: **0**
- Anonymous public DML tables: **0**
- Anonymous executable SECURITY DEFINER functions: **0**
- Authenticated table mutation grants without a corresponding write RLS policy: **0**
- Future public/private functions do not inherit PostgreSQL `PUBLIC EXECUTE`
- Future public tables/sequences do not inherit anon/authenticated privileges
- `app_media_settings` and `app_auth_launch_settings` are client read-only
- Financial, identity, IAP, payout, legal acceptance and wallet state is not directly client-writable

## Realtime publication audit

The `supabase_realtime` publication contains only application interaction/realtime tables such as chat messages, room state, calls and signaling.

It does **not** include financial wallets, payouts, IAP purchases, KYC/identity settings, legal acceptances, or provider configuration tables.

Realtime visibility remains subject to the tables' RLS policies.

## Storage/media posture

- avatars: public read, owner-controlled writes
- chat media: private
- private profile photos: private
- space images: private
- voice intros: private
- social-media remains temporarily public only for old-production compatibility
- centralized media upload flags are backend-controlled
- pending cutover disables image/video uploads when moderation is still unconfigured

## External launch dependencies

Still external/manual:
- current Vercel HEAD deployment (Hobby build-rate limit)
- Supabase custom SMTP + required email confirmation
- leaked-password protection requires Supabase Pro
- TURN relay
- production media moderation provider
- Apple/Google IAP verification
- KYC provider
- payout provider credentials

Unconfigured IAP, KYC and payouts remain fail-closed.
