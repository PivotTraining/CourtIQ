# CourtIQ launch hardening — October 14, 2026

## Scope and authorization

The user requested finishing launch work and explicitly approved the live
ownership-only repair after backup/rollback and isolated verification. No new
pricing, live billing, real signup email, new password, SMTP settings, or broader
security configuration was approved. Those remain separate gates.

## Correction to the earlier diagnosis

The first read-only audit queried `column_default` but not `is_generated`.
`players.owner_id` is generated ALWAYS as `(manager_uid)::uuid`; an empty default
does not mean a newly inserted row lacks an owner. The earlier claim that fresh
profiles necessarily fail stat saves was incorrect. The follow-up live query and
rollback-only verification corrected that conclusion.

The approved function change aligns its predicate directly with `manager_uid`,
the field used by row policies, while preserving all other installed function
behavior, owner, and EXECUTE privileges. It does not alter or backfill player rows.
The null/stale-owner isolated test covers compatibility drift, not the actual
current live generated-column schema.

## Database evidence

- Original function MD5: `f5b8383a618e6aee0b7986eae1ba2aa4`.
- Updated function MD5: `797ea510691c3a10fba26d94e9317543`.
- Owner remains postgres; authenticated/service_role grants unchanged; anon
  EXECUTE remains false. The function retains its explicit Auth ownership check.
- Applied live migration: `20261014160509_tracker_ownership_alignment`.
- Snapshot and atomic function-only rollback are saved beside this note.
- Two isolated PGlite regressions reproduce nullable/stale legacy ownership,
  duplicate retries, stale edits, foreign-account denial, and rollback.
- The initial rollback-only live fixture incorrectly assumed a nullable legacy
  owner and failed. It rolled back completely; no fixture players remained.
- The corrected live fixture used the actual generated-column schema and passed:
  authenticated profile/session creation, stat save, retry deduplication,
  foreign-account read/write denial, completion, and ledger counts. ALL synthetic
  Auth/player/session/command rows were rolled back. No emails or credentials.
- This is SQL/RLS proof, not a real browser signup or delivered confirmation email.

## Public website

`getcourtiq.com` belongs to the separate static `courtiq-site` Vercel project
`prj_HN2crIdEPLuUG9xnWTOl6meGepI4`, not the web application's project.
Previous production deployment: `dpl_FSuR2vEXyrWxM4s1p8YgPpFmdm8V`.
The corrected source is under `marketing-site/` and retains the existing visual
layout/styles. It removes App Store-first CTAs, obsolete $4.99 prices, unverified
counts/testimonials, automatic game-film/cloud storage and account-link claims.
It identifies the current release as a supervised web pilot with no paid checkout.
Legacy legal URLs redirect to current app policies; no policy acceptance or legal
clearance is implied. The existing publicly listed privacy contact is retained;
mailbox delivery is not verified. Broad cache-deletion/unregistration code was
removed. Existing device video and unsynced work are not cleared.

## Still required before claiming a broad paid launch

1. Approved signup test email and user-entered password to verify native email,
   Google, confirmation/reset delivery, browser reload/logout and saved-game flows.
2. Physical iPhone/Android tests, separate from browser viewport emulation.
3. Actual restorable full-data backup and monitoring verification. Supabase CLI
   backup listing was blocked because no CLI access token was available; no token
   was retrieved or printed. The function-only snapshot/rollback is verified.
4. Final pricing/no-card terms, isolated Stripe test environment and live-mode
   implementation, signed provider lifecycle, backend entitlements and reviewed
   activation. Existing code still rejects live keys; all payments remain off.
5. Leaked-password protection remains disabled per the advisor; project settings
   were not altered. The intentional SECURITY DEFINER ledger warning remains,
   with explicit ownership and privilege checks tested.
