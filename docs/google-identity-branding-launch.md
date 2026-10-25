# CourtIQ Google sign-in: branding and authorized origins

Goal: a legitimate Google-branded sign-in for new families, without exposing
the `tkjvkvrzlvbukxbsilvw.supabase.co` hostname in the normal Google consent
flow. **Do not conceal or impersonate Google’s actual account permissions.**

## Verified state (October 24, 2026)
- Current production uses Supabase Auth's traditional Google OAuth browser
  redirect. The Google consent screen displays the Supabase project hostname.
- The connected Google OAuth **public client ID** is
  `198608148897-bd4a2ibq97ie347vkrtu8238npqv2dhk.apps.googleusercontent.com`
  (identified from the existing Supabase auth redirect).
- App code has official Google Identity Services (GIS) token sign-in behind
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. It exchanges the Google-issued ID token
  directly via `supabase.auth.signInWithIdToken` and includes a per-request
  nonce. The existing OAuth redirect stays as a fallback.
- Vercel project **court-iq**, team **pivot-trainings-projects**, has a
  **preview branch-only** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` for
  `feat/branded-google-sign-in-no-supabase-screen-20261024`.
- **Not enabled in production**; Google Cloud changes and device tests are
  prerequisites.

## Google account owner: one-time tasks
Open https://console.cloud.google.com/auth/overview and choose the project
with the **Web application** OAuth client ending `...v2dhk.apps.googleusercontent.com`.
Only its authorized owner can change these settings.

1. **Branding** (https://console.cloud.google.com/auth/branding):
   - Application name: **CourtIQ**.
   - App homepage: `https://app.getcourtiq.com`.
   - Privacy policy: `https://app.getcourtiq.com/privacy`.
   - Terms: `https://app.getcourtiq.com/terms`.
   - Authorized domain: `getcourtiq.com` (verify domain ownership if prompted).
   - Add the official CourtIQ logo and an appropriate support/developer contact
     mailbox approved by the owner. Confirm branding review / verification and
     publication state; do not switch to test-only without understanding the
     impact on existing users.
2. **Clients** (https://console.cloud.google.com/auth/clients): open the **existing
   Web application** client listed above; do **not** create a duplicate.
   Under **Authorized JavaScript origins**, add
   `https://app.getcourtiq.com`.
   For live preview QA, add that specific preview deployment origin **without
   a slash or path**; previews change when new commits are pushed.
   Under **Authorized redirect URIs**, preserve the existing Supabase callback
   `https://tkjvkvrzlvbukxbsilvw.supabase.co/auth/v1/callback`
   for existing-account fallback. Do not replace the callback with
   `https://app.getcourtiq.com/auth/callback` unless separately verified.
3. **Audience**: confirm **External / In production** for real parent testers;
   keep applicable age limits and policies.
4. **Data access / scopes**: use `openid`, email and profile only; no Drive,
   Contacts, Gmail or other sensitive scopes.
5. Save, allow time to propagate, and perform a brand-new Google login on a real
   iPhone installed Home Screen app and in Safari/Chrome, plus returning-user
   login, session persistence, and sign-out. Verify no duplicate accounts and
   that any fallback identifies itself truthfully as the existing Google login.

## Production rollout gate
Do not add the public client ID to production until the authorized origin and
branding are complete and real-device acceptance tests pass. The preview-only
environment change does not affect live families.

When ready, add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the **production** target
on Vercel project `court-iq` and rebuild that production deployment. The ID
is public; **never** place Google client secrets or Supabase service-role keys
in `NEXT_PUBLIC_` variables.

## Sources
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://developers.google.com/identity/gsi/web/guides/overview
- https://nextjs.org/docs/app/guides/environment-variables
