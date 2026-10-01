MAAREFAK — PERSISTENT LOGIN PATCH

Replace/add:
1) lib/supabase/client.ts
2) app/manifest.ts   (new)
3) app/layout.tsx

Behavior:
- Supabase session is persisted.
- Access token refreshes automatically.
- Installed app/PWA opens at /home.
- If a valid session exists, the user goes straight to Home.
- If there is no valid session, existing middleware redirects to /login.
- Session stays active until logout or auth invalidation/expiry.

Then Commit to main -> Push origin.
Suggested summary:
Keep users signed in and open app on Home
