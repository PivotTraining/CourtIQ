# CourtIQ authentication sweep — October 8, 2026

## Scope and release boundary

Reviewed email/password login, confirmation-required signup, Google initiation,
PKCE callback, password recovery, cached-session bootstrap/token refresh,
profile loading, and logout. Repairs are on `codex/actionable-skills` / PR #17.
No production merge, deployment promotion, migrations, auth-provider changes,
real account creation, outbound email, password changes, or live payment tests
were performed in this sweep.

## Repairs

- Login/reset/Google actions share a synchronous in-flight guard. Credentials
  and sign-in/signup switching stay disabled during a request; unmounted forms
  ignore late feedback. Email addresses are trimmed, and reset feedback stays
  tied to the submitted address, not later edits.
- Initial session and profile reads have 15-second UI deadlines. Errors are not
  silently treated as an empty account or a reason to create a duplicate profile.
  Old account/profile results cannot overwrite a newer identity or retry.
- Cached sessions restore their selected player; token refresh updates user
  metadata without duplicating the player read or replacing another account.
- Slow callbacks expose a return link without retrying a single-use PKCE code.
  Password recovery validates matching passwords and locks duplicate saves.
- Profile setup and unavailable-profile screens now offer sign-out.
- Ordinary logout uses `scope: 'local'`, shares one pending provider request,
  and retains the unsynced-stat guard. Cleanup rechecks for entries queued during
  logout so it cannot erase those entries. Storage cleanup failure does not
  misreport a successful provider logout as a failure.
- Replaced the broken literal `forward` icon label on login/signup buttons with
  a decorative SVG arrow and improved success/error text contrast.

## Verification evidence

- Full local test suite: **192 passed, 0 failed**. Includes executing the actual
  auth components and provider functions with controlled SDK results; not only
  source-pattern assertions. Existing local SQL/RLS tests remain local evidence.
- Lint: **0 errors, 6 existing warnings** (four image warnings, two unrelated
  hook warnings). Removed the auth-provider hook warning without suppressing it.
- Dependency audit: **0 vulnerabilities**. Optimized production build: passed.
- Local browser fixture `/dev/auth`: email success, return-to-login logout,
  required-email reset validation, requested-email reset feedback, signup
  confirmation messaging, keyboard submission, recoverable failure, and Google-
  shaped success/logout verified. Phone viewport 390 × 844: no horizontal
  overflow. Fixture uses the real form components but no real identity service,
  emails or persistent sessions, and is gated to explicitly enabled development.
- Local production-mode runtime: `/dev/auth` returns **404** even with the local
  preview flag set; `/auth/callback` and `/dashboard` return **200**. The cancelled
  callback's Return to CourtIQ link was verified in the development browser to
  land on the real login screen without exchanging a code.
- Live `app.getcourtiq.com/api/auth-status`: healthy/reachable at
  `2026-10-08T15:18:05.399Z`.
- Live Google initiation reaches Google's account chooser. Its Supabase callback
  uses project `tkjvkvrzlvbukxbsilvw`; its app return points to
  `https://app.getcourtiq.com/auth/callback?next=%2Fdashboard`.

## Required live-account checkpoint — not yet verified

An existing, user-selected account is required to finish real email and Google
login → dashboard/player read → reload/persistence → logout → browser back/refresh
→ no authenticated player view. Also verify real confirmation/reset email
delivery, a recovery link in the same browser (PKCE), expired-link behavior, and
logout followed by a different account with no prior-account view.

The user must enter/submit any new real password themselves. No real account was
selected at Google's chooser in this sweep. The consent screen currently shows
the Supabase project hostname, not a polished CourtIQ application name; provider
branding/settings were not changed. Build/CI/preview readiness must not be treated
as proof of these live identity, email-delivery, or production database paths.
