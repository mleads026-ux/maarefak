# Migration reconciliation — 2026-10-05

The live Supabase migration ledger was compared against the hardening branch.

Two historical live migrations are present in `supabase_migrations.schema_migrations` but do not have original SQL files in this repository:

- `20261005055806_explicitly_deny_direct_reports_access`
- `20261005055940_force_stateful_actions_through_secure_rpcs`

Their original SQL was not reconstructed from memory. Later tracked migrations supersede their final security effects, including:

- `20261005060309_harden_reports_and_profile_views.sql`
- `20261005060850_revoke_residual_report_profile_view_mutations.sql`
- `20261005061045_revoke_unused_webrtc_signal_mutations.sql`
- `20261005061135_revoke_all_anonymous_public_dml.sql`

Current live verification after reconciliation:

- public tables without RLS: 0
- anonymous direct DML tables: 0
- anonymous executable SECURITY DEFINER functions: 0
- authenticated table mutations lacking a corresponding authenticated/public write RLS policy: 0

Do not fabricate or backfill historical SQL for the two missing entries. Treat the live ledger as historical truth and the later tracked migrations as the reproducible final-state hardening.
