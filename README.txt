MAAREFAK — SIGNUP EMAIL OTP PATCH

Replace:
1) app/login/page.tsx
2) lib/utils.ts

Then configure Supabase confirmation email template manually:
Supabase Dashboard -> Authentication -> Email Templates -> Confirm signup

Subject:
رمز تأكيد حسابك في معارفك

Body:
Use the content in SUPABASE_EMAIL_TEMPLATE.txt

IMPORTANT:
The template MUST contain {{ .Token }} so Supabase sends the 6-digit code instead of relying only on a confirmation link.

Flow:
Create account with email + password -> OTP screen -> verify 6-digit code -> onboarding -> home.
Normal future login remains email + password.

Suggested GitHub Summary:
Add 6-digit email OTP signup verification
