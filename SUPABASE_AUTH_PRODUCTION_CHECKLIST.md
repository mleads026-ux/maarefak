# Supabase Auth Production Checklist — Lammetna

Project: `hxinaxjcdwsngiqvdryq`

## Verified in code
- Signup password rule: minimum 8 characters.
- Requires uppercase, lowercase, number, and symbol.
- Password reset enforces the same strength rule.
- Signup UI supports a 6-digit email OTP.
- Signup OTP resend cooldown: 60 seconds.
- Login client cooldown exists for repeated failed attempts.
- Legal acceptance and 18+ are server-gated separately from Auth.

## Required Dashboard settings before store release

### 1. Require email confirmation
Supabase Dashboard:
**Authentication -> Providers -> Email**

Enable email confirmations / require email verification.

Expected behavior after enabling:
- `signUp()` should not create an immediately usable app session before verification.
- Supabase should send the confirmation message.
- Lammetna signup screen should stay on the 6-digit OTP step.
- Successful OTP verification should create the session, record legal acceptance, and route to onboarding.

### 2. Configure custom SMTP
Do not rely on Supabase's built-in demonstration mail service for Production.

Configure a Production SMTP provider in Supabase Authentication email/SMTP settings.

Then send real tests to at least:
- Gmail
- Outlook/Hotmail
- one additional provider/domain if available

Verify:
- signup OTP arrives
- resend OTP arrives
- password-reset email arrives
- From name/address are branded for Lammetna
- messages do not land consistently in spam

### 3. Email template
Use the Lammetna-branded confirmation template already tracked in:
`SUPABASE_EMAIL_TEMPLATE.txt`

The signup flow expects the numeric token:
`{{ .Token }}`

Do not switch this template to link-only confirmation without updating the client flow.

### 4. Password settings
Keep server-side Auth password policy aligned with the client:
- minimum length: 8 or higher
- lowercase required
- uppercase required
- digit required
- symbol required

### 5. Leaked-password protection
Current Supabase organization plan: **Free**.

Supabase documents leaked-password protection as a **Pro Plan and above** feature.
Therefore this warning cannot be fully closed on the current plan.

If/when upgrading to Pro:
Authentication -> Providers -> Email / Password security
Enable **Prevent use of leaked passwords**.

Until then, Lammetna's own signup/reset UI continues enforcing the strong password composition rule above.

## Evidence from current project data
At audit time:
- 3 Auth users existed.
- all 3 were email-confirmed.
- 0 had `confirmation_sent_at` populated.

This does not prove Production confirmation is enabled; treat the Dashboard confirmation toggle + SMTP test as a mandatory launch check.

## Acceptance test after Dashboard configuration
Create a brand-new test account using an inbox you control.

Pass criteria:
1. No app access before email verification.
2. Six-digit OTP is delivered.
3. Wrong OTP is rejected.
4. Correct OTP succeeds.
5. Legal acceptance is required.
6. 18+ confirmation is required.
7. Onboarding is required before Home.
8. Logout/login succeeds after verification.
9. Password reset sends an email.
10. Weak new password is rejected by the Lammetna client and by configured Auth policy.
