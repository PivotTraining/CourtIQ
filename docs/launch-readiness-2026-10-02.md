# CourtIQ launch-readiness checkpoint — October 2, 2026

Local repair and verification only. Not a public-launch approval.

## Changes

- Fixed the free-starter theme hydration mismatch discovered during the smoke test.
  Server and first client render now agree; the saved preference is restored after
  hydration, before any preference write. The button waits for initialization.
- Found the same browser-only state initializer in the main app shell. Both now
  use `useThemePreference`, preserving dark/light controls and browser theme color.
- Added four regression tests for identical SSR output, preserved saved light
  mode, dark/default preferences, and blocked storage with working in-memory controls.
- Reviewed the shared hook and controls against the Next.js hydration and React
  hook guidance. No warning suppression, disabled server rendering, account changes
  or broad UI redesign was used.
- Patched only the transitive DOMPurify dependency from 3.4.13 to 3.4.16 through
  the lockfile. The low-severity advisory is
  [GHSA-p98j-92pf-mc4p](https://github.com/advisories/GHSA-p98j-92pf-mc4p).
  No evidence of exploitation in CourtIQ was established.

## Fresh verification

| Check | Result |
| --- | --- |
| Full automated suite after dependency patch | 114 passed, 0 failed, 0 skipped |
| Lint | Passed |
| Full npm dependency audit | 0 reported vulnerabilities |
| Optimized production build | Passed in a temporary source copy, with clearly fake backend configuration |
| Saved light-mode reload | Correct preference and enabled toggle; no captured errors/warnings or framework overlay |
| Saved dark-mode reload | Correct preference and enabled toggle; no captured errors/warnings |
| Free-starter counter after repair | Made input increments makes and attempts |
| Production-mode public homepage | Rendered meaningful content; captured error/warning log empty |
| Production-mode sample-route rejection | /dev/starter, /dev/analytics, /dev/tracker, /dev/coach and /dev/billing returned 404 even with local-preview flag set |
| Inactive data/billing API safeguards | Starter/analytics 503, unsigned billing status 401, Checkout/trial/Portal/reconcile 503, unsigned webhook 400; all private/no-store |

The temporary build/server was separate from the user's port-4312 preview.
Screenshot: /Users/chris/Downloads/courtiq-smoke-test-2026-10-02/starter-light-theme-fixed.jpg.
The earlier smoke-test report remains historical; its rendering defect is repaired
in this local working tree, not yet released remotely.

## Live inspection permission and access

The user explicitly authorized read-only inspection of CourtIQ project
`tkjvkvrzlvbukxbsilvw`, with no migrations, deletions or setting changes, and chose
to keep payment testing local.

- Supabase connector `get_project` for that exact project returned permission denied.
- Opening the exact CourtIQ dashboard was blocked by the browser's saved Supabase
  permission setting. No alternate browser, credential search, CLI workaround or
  indirect access was attempted.
- Therefore no current live schema, migration history, RLS rules, security advisors,
  Auth settings, backups or customer rows were inspected in this checkpoint.
- Restore the Supabase browser permission and/or connect an account that actually
  has CourtIQ project access before retrying the authorized read-only inspection.
  A successful inspection still does not authorize migrations or production activation.

## Remaining launch gates

1. Read-only live CourtIQ inventory: schema, ownership/RLS, migration history,
   legacy tables, function deployment, Auth callback settings and backup evidence.
2. Separate approval for any proposed backend changes, with a reviewed backup/
   restore plan and isolated test environment. Then two-account ownership, saved
   record reload, free allowance, trial expiry and history preservation tests.
3. Real Google/email signup, verification, recovery and logout testing. Do not
   equate prior-preview login evidence with the latest deployed feature behavior.
4. Payment testing stays local by user choice. No real hosted Checkout, renewal,
   cancellation, failed-payment recovery or provider webhook delivery is certified.
   Live-key rejection remains intact. Approved pricing/terms and isolated provider
   testing are still required before public paid enrollment.
5. Actual phone/browser video playback and device-storage tests for release.
   Device clips are not cloud backup or cross-device footage. No cloud-video or
   app-wide community benchmarking feature was added by this repair.
6. Final CI/preview and selected production-origin verification, followed by
   explicit release approval. No push, merge, deployment or activation was performed.

Recommended current status: local demo/private-beta candidate; not a verified
public paid release.
