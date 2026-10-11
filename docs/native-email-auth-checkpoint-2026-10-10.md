# CourtIQ native email/password account audit — October 10, 2026

## What is wired

- Browser `LoginScreen` calls `supabase.auth.signUp` for native signup, `signInWithPassword` for email/password login, `resetPasswordForEmail` for forgot password, and `resend(type: signup)` for confirmation mail.
- Google uses `signInWithOAuth(provider: google)`. Apple helper exists in `src/lib/firebase.js` but is **not presented as a login option** in `LoginScreen`; do not advertise Apple login as available.
- Callback consumes existing OAuth/PKCE `?code` links, and after this PR also validates Supabase custom-email `?token_hash&type=...` links with `verifyOtp` and handles recovery links.
- Session cookies/refresh handled by Supabase SSR; app managed profiles are loaded by `AuthProvider` and `fetchManagedPlayers`. Google identities do not automatically acquire a password; entering the same Gmail address in the email/password form is not evidence that the password flow is configured.

## **External prerequisites** (cannot be validated by source code, GitHub CI, or Vercel readiness)

1. Supabase project's **Authentication > Providers > Email** must allow email authentication. Site URL and redirect allowlist must include `https://app.getcourtiq.com/auth/callback`. The return URL must match the domain users open; email-link exchange in the same browser is recommended.
2. Configure a verified transactional SMTP provider in **Supabase Authentication > SMTP Settings**. Supabase's built-in SMTP is restricted to authorized project members and is unsuitable for public onboarding. Merely adding app-side API keys or having an existing Google OAuth provider does not configure Supabase outbound SMTP.
3. Use a verified domain and approved From address, preferably `no-reply@getcourtiq.com` **only after it is actually owned and DNS verified**. Check DNS (SPF, DKIM, DMARC), sending rate limits, and logs without exposing any private authentication secrets.
4. Ensure confirmation and reset templates point to a tested callback flow. Supported by this code: Supabase `?code` exchanges, and `?token_hash&type=signup|email|recovery|magiclink|invite|email_change` with `verifyOtp`.
5. Confirm a **new, consented test account** can sign up, receive and open email verification, sign in, create a player profile, reload, log out, and sign in again. Also test reset delivery and new password; don't use or solicit a real user's password.
6. For users who created a Google-only identity, retain Google login until an explicit password-creation path is verified; do not tell them an email/password credential exists.
7. Maintain separation of accounts and managed minors; review and test age/guardian UX and privacy before public outreach.

## What this code change addresses

- Distinguishes Google accounts from password accounts on login.
- Provides resend-confirmation button after successful signup awaiting verification or rejected unconfirmed login.
- Supports valid token-hash confirmation/recovery template links, alongside existing PKCE code exchange.
- Adds regression tests without sending any emails, creating real identities, applying schema changes or touching current passwords.

**Do not claim native email registration is live for the public until the Supabase email provider and SMTP and real confirmation delivery are independently verified.**
