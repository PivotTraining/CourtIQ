# CourtIQ core repair — September 30, 2026

## Status

Application changes and the proposed migration are tested locally. Live Supabase access and the local browser verification were declined in this turn. No live database changes, function deployment, public-domain change, merge, or production promotion were performed. These checks are not a certification of live behavior.

## Repairs

- Failed journal saves preserve the draft and display an error. Session completion and undo no longer pretend a failed database write succeeded.
- Read errors propagate to visible unavailable/retry states instead of producing zero statistics or an empty history.
- Complete shot, journal, streak, and player-list reads use stable ordering, range pagination, and empty-page termination, including when the server caps pages below the requested size.
- Selected managed player persists across reloads in a user-scoped session preference. Account changes clear stale profile state; switching profiles remounts the data provider.
- Managed-player deletion is one checked database deletion, relying on verified cascades. Primary profiles cannot be deleted through that path.
- The proposed migration aligns permissions with manager ownership, blocks reassignment of ownership/identity, requires shots to match the exact owned session/player, and prevents team-policy recursion without enabling team collaboration.
- Player ownership is linked to Auth by a generated owner UUID foreign key. Auth deletion then cascades all managed players and their records atomically; a stale token cannot recreate profiles for a deleted Auth account.
- The account-deletion function verifies the caller, requires explicit confirmation, ignores client-supplied user IDs, revokes refresh sessions, and performs only the Auth deletion. No service key is shipped to the browser.
- Signup uses an eight-character minimum; existing shorter passwords still work for sign-in. Reset requests are bounded by a loading state and do not claim mailbox delivery was verified.
- Dependencies were patched within the existing Next.js 15 line. Next's PostCSS is overridden to 8.5.28; Supabase dependencies are pinned. CI now rejects moderate-or-higher dependency audit findings.

## Mandatory live application sequence

1. Restore access to project `tkjvkvrzlvbukxbsilvw` (`courtiq-dev`, CourtIQ organization). Do not use another application's database.
2. Inspect current schema, policies, foreign keys, migrations, function versions, storage, and record counts. In particular, audit the extra `profiles`, `games`, and `shots` tables observed in this project; they are not defined in this repository's current schema. Verify those records either cascade from Auth/players or add a reviewed migration before enabling account deletion. Check for owned storage objects too: they can prevent Auth deletion and require a separate verified cleanup policy.
3. Export a scoped encrypted backup, record counts and restore procedure, and prove a restore in an isolated database. A local fixture snapshot test is not a production backup. Do not initiate a paid plan/backup change without the owner's approval.
4. Apply **only** `supabase/migrations/20260930171602_web_player_ownership_safeguards.sql` after reviewing preflight results. Do not apply the superseded August managed-player migration first or blindly push every old SQL file. The transaction refuses unknown policies, unverified owners, or missing cascades rather than guessing or deleting data. Existing legacy ownership is backfilled only when the matching Auth user exists.
5. Query all affected policies, owner links and cascading constraints after application, compare counts, and run Supabase security advisors. Prove allow/deny behavior with two dedicated test accounts, including managed-player CRUD and cross-account attempts. Do not delete real accounts or players for tests.
6. Only after cascade/storage checks pass, deploy `supabase/functions/delete-account/index.ts`. The function implements custom authentication with `auth.getUser(token)`; if gateway JWT checking is incompatible with current signing keys, `verify_jwt=false` is safe only with that custom authentication intact. Never disable caller validation. Keep the built-in service-role environment server-only. Test unauthenticated, foreign-origin, invalid-confirmation and disposable-account deletion paths.
7. Test live profile creation/update, additional managed player, shot/session/journal save, reload, logout/login, selected-player restoration, and ownership separation. Save proof screenshots. Account deletion needs explicit confirmation at the final browser control.
8. Test actual email confirmation and recovery delivery. Password changes are completed by the human user; never enter a new password for them. Inspect SMTP sending configuration/rate limits if delivery fails.
9. Resolve which Vercel project controls `app.getcourtiq.com`. Fix production public backend variables there only once confirmed. Review PR #11, require CI/preview approval, then obtain explicit production-release authorization before merge/promotion.

## Verification record

- PostgreSQL fixture tests execute the actual schema and migration, not regex-only checks: owned/foreign access, cross-account insert/update/delete denial, identity immutability, exact shot/session consistency, primary-profile deletion protection, cascade cleanup, and stale-token recreation denial.
- Handler tests exercise confirmation/auth/origin checks, revocation failure, correct verified deletion target, journal draft preservation, pagination failure behavior, and atomic deletion request shape.
- Local fixture backup/restore and unsafe-schema rollback tests are part of the test suite.
- Final local results: all **34 tests pass**, lint passes, the dependency audit reports **zero known vulnerabilities**, and the production build succeeds with clearly fake CI environment values. Browser and live persistence gates remain pending. An earlier build had a disk-cache warning; the final build completed without that warning. Cache cleanup was blocked by the command safety policy, so no cache or user files were deleted.

## Separate product work, not silently claimed complete

Team collaboration, subscriptions/payment processing, saved video, offline write/sync, centralized usage reporting, and a verified parental-consent workflow are not implemented by this repair. Keep unfinished features disabled and do not publicly launch under-13 enrollment until the actual consent and data-handling workflow is decided and verified. Do not treat a privacy paragraph or a checkbox alone as proof of compliance.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Auth deletion](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), [Sign-out scopes and access-token lifetime](https://supabase.com/docs/guides/auth/signout).
