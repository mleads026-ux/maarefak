# Lammetna Production Cutover Runbook

## Current state
- Hardening branch: `chatgpt/lammetna-production-hardeni`
- Draft PR: #2 into `main`
- Current hardening Preview: green
- GitHub CI: green
- Vercel runtime errors during smoke window: 0
- Production is still the old `main` client

## Do not start cutover until
1. Supabase Auth leaked-password protection is enabled in Dashboard:
   Authentication -> Providers -> Email / Password security.
2. Decide whether the release will intentionally ship with these integrations disabled:
   - TURN relay
   - real media content moderation
   - Apple/Google IAP
   - KYC
   - payouts
3. Confirm payout/KYC/IAP switches remain disabled until their provider backends are configured.

## Production cutover order

### 1. Promote the new client
Merge PR #2 into `main` only when ready to cut over.

Wait for the Vercel Production deployment to reach READY.

### 2. Production smoke test before DB cutover
Verify:
- /login loads
- /signup loads
- /manifest.webmanifest returns application/manifest+json
- unauthenticated /home redirects to login
- authenticated user without current legal acceptance is sent to /legal
- accepted user without completed profile is sent to /onboarding
- completed user reaches /home
- create/join lamma uses v3/v2 flows
- payments page loads
- account settings loads
- no new Vercel runtime errors

If any of these fail, stop. Do not apply pending migrations.

### 3. Apply the pending migrations in this order
1. `20261005_disable_legacy_complete_profile.sql`
2. `20261005_disable_legacy_create_lamma.sql`
3. `20261005_disable_legacy_join_lamma.sql`
4. `20261005_disable_legacy_sql_account_delete.sql`
5. `20261005_finalize_private_social_media.sql`

These changes intentionally make the new client authoritative and remove compatibility surfaces required only by the old client.

### 4. Production smoke test after DB cutover
Verify again:
- onboarding can complete a profile
- lamma create works after explicit host-terms acceptance
- private lamma wrong passwords are rate-limited
- account deletion invokes the Edge Function path
- Social Hub images load via signed URLs
- blocks prevent access to social media
- chat text still sends
- gifts/media use secure RPC flows
- no runtime errors

### 5. Final Supabase checks
- Security Advisor: no anon execution on sensitive RPCs
- Public tables without RLS: 0
- Performance Advisor: no unindexed foreign keys
- `social-media` bucket: private
- only intentionally public bucket should remain `avatars`

## Rollback rule
If the Production client must be rolled back to the old `main` version after the pending migrations were applied, run the rollback SQL in:
`pending_release_migrations/20261005_rollback_cutover_compatibility.sql`
before serving the old client again.

## External integrations
Do not enable these UI/backend switches merely because the hardening cutover is complete:
- TURN
- content moderation
- IAP
- KYC
- payouts

Each requires its own provider credentials, webhook verification, and end-to-end test.
