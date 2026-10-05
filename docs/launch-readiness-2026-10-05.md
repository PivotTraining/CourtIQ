# CourtIQ repair and readiness checkpoint — October 5, 2026

Local implementation and verification. Not a public-launch certification.
Supersedes the current-status portions of the [October 2 checkpoint](launch-readiness-2026-10-02.md), which remains historical evidence.

## Repairs completed

- Included the prior shared-theme hydration repair and patched DOMPurify lockfile.
- Optional onboarding no longer throws when browser storage is blocked. Skipping
  guidance still reaches sign-in without requiring storage access.
- Delayed cached-session bootstrap cannot resurrect a signed-out account or replace
  a newer signed-in identity. Superseded profile reads cannot end a newer retry's
  loading state.
- Device-video UI remounts per account/session. Pending callbacks from a departed
  session cannot update another session's view. Leaving during playback validation
  does not start a late write. Already-started storage writes may still finish for
  their original owner/session; this is not cancellation or cloud storage.
- Profile setup's external button now submits its associated form, respecting
  native validity. Added linked labels, integer/range guards, a duplicate-submit
  lock, disabled pending controls, retained input on failure, and a lifecycle guard
  so a late completion cannot update auth context after leaving that account.
- Jersey 0 is preserved for primary and coach-managed players. Creating either
  profile requires an actual returned row, not merely absence of an error.
- Optional self-profile age range is now 13–100, consistent with the existing
  self-operated-account policy and supporting adults over 30. This does **not**
  implement verified age gating, parental consent or a legal compliance claim.
  Managed youth profiles were not given this self-operated age restriction.
- Onboarding correctly describes 162 drills and the free introductory allowance;
  it no longer promises AI analysis after every session.

## Fresh verification

| Check | Evidence |
| --- | --- |
| Full automated suite | 127 passed, 0 failed, 0 skipped; includes 13 additional entry/profile/video regression tests since the October 2 total |
| Lint | Passed |
| Diff whitespace check | Passed |
| Optimized production build | Passed in isolated source copy with fake backend values; no live backend accessed |
| Production runtime safeguards | Homepage/dashboard HTTP 200; all five sample routes 404 even with sample flag true; inactive starter/analytics 503, billing status 401, Checkout/trial/Portal/reconcile 503, unsigned webhook 400; all API responses no-store |
| Starter browser control | Made input changed counter from 0/0 to 1/1 in sample UI |
| Coach report | Synthetic roster totals, shooting splits, estimated eFG/TS and per-player reports rendered |
| Social card | Caption changed to Work Gone Show, preview regenerated, Download PNG became available; no external sharing performed |
| Phone viewport | At 390 × 844, document and dialog width both 390; no horizontal overflow or framework overlay. Light and neon-dark screenshots captured |
| Captured browser warnings/errors | None in exercised starter, coach/report/card and tracker sample paths |
| Production dependencies audit | 0 reported vulnerabilities |
| All-dependency audit | **Open:** 5 high entries for one underlying unpatched braces advisory in development-only ESLint dependency chain |

React hook/component tests execute the source with deterministic injected effects
and fake services. PostgreSQL/payment tests use local fixtures. Neither is proof
of authenticated live Supabase or real hosted Stripe behavior.

Screenshots:

- `/Users/chris/Downloads/courtiq-launch-repair-2026-10-05/tracker-phone-dark.jpg`
- `/Users/chris/Downloads/courtiq-launch-repair-2026-10-05/tracker-phone-light.jpg`
- `/Users/chris/Downloads/courtiq-launch-repair-2026-10-05/player-card.jpg`

## Security item remaining

`npm ls` shows `eslint-config-next → @next/eslint-plugin-next → fast-glob →
micromatch → braces@3.0.3`, exclusively through development dependencies. The
[GitHub advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
lists no patched version; the registry also reports 3.0.3 as latest. The affected
operation is recursive processing of deeply nested brace patterns. No evidence
of exploitation or customer-data access was established.

Do not run automated force-fix: it proposes downgrading eslint-config-next to
14.2.35 while the application remains Next 15.5.27. Keep lint/build patterns
controlled and do not expose this tooling to arbitrary untrusted inputs. Resolve
with a compatible patched upstream dependency or a separately reviewed replacement
before treating the full dependency audit as clean. Production-only scan is clean;
the full audit is **not** clean.

## Actual remaining launch boundaries

1. **Backend access:** read-only CourtIQ inspection was authorized previously, but
   the Supabase connector is absent this session and the latest browser attempts
   were blocked by saved access settings. No browser/CLI/credential workaround was
   used. Restore the permitted access method to project `tkjvkvrzlvbukxbsilvw`.
2. **Live schema and data protection:** inspect migration history, ownership rules,
   Auth callbacks, deployed functions, backups and compatibility before proposing
   changes. Applying migrations or altering production settings requires separate
   approval; a reviewed backup/restore plan must precede activation.
3. **Real accounts:** verify Google/email signup, verification, recovery, logout,
   two-account isolation, saved-game reload, allowance/trial expiry and retained
   history against the intended deployed backend.
4. **Payments:** user selected local testing only. No Stripe provider calls,
   customers, subscriptions, charges or real webhooks were created. Current code
   deliberately rejects live billing keys. Pricing is still proposed, not approved.
   Public recurring billing needs approved pricing/terms, isolated provider testing,
   and a separately authorized live-billing release.
5. **Unbuilt scope:** app-wide community comparisons, shared coach/player/parent
   invitations, coach assignments, cloud/cross-device video, and automatic full-game
   video analysis are not shipped. Private managed-player comparison and transparent
   NBA-style statistical references are present; they are not population rankings
   or validated NBA-player predictions.
6. **Release:** no push, merge, deployment, migration or production activation was
   performed. CI/preview and authenticated production checks remain outstanding.

Current assessment: substantially hardened local/private-beta candidate, not a
verified public paid release. Existing customer records were not read or changed.
