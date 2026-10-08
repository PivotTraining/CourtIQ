# CourtIQ production release — October 8, 2026

The user explicitly authorized merging and deploying the pending CourtIQ work.
This release is application source, not paid enrollment or automatic activation
of unapplied database changes. Earlier local-only checkpoints remain historical.

## Exact scope

- Update PR #14 with the four pending local commits and reconcile with current
  main, `f18782ea70839ce2abc78f94ea7f947863547a49`.
- Preserve current Film Lab, player profile, family, settings, prescriptions and
  the existing coach screen. The new roster coach workspace is selected only
  when both existing recovery and new coach flags are true. Navigation has a
  single coach item rather than two competing entries.
- Include tracker reports, stat-based social cards, device video, entry/profile
  safeguards, request timeouts, and inactive free/trial/premium/billing foundations.
- Keep signed-in data and permission verification separate from a healthy public
  page or a successful hosting build.

Production app: `app.getcourtiq.com`, Vercel project
`prj_ndOB9SEe0VllRQVKDdetZzMsrRYm` (`court-iq`). Prior verified READY production
deployment: `dpl_3HVpBRNCN6rEbqWTwcgxf2AZdo6r`, at main `f18782e`.

## Security-check repair

The full audit rejected the Next lint plugin's development-only `fast-glob →
micromatch → braces` chain. No patched braces version was available. Rather than
disable auditing or downgrade the application framework/configuration, this release
uses a reviewed **lint-only** replacement:

- Next and `eslint-config-next` stay at **15.5.27**.
- The official `@next/eslint-plugin-next` is pinned to **14.2.35**, whose directory
  matcher does not depend on braces. Its glob dependency is pinned to **13.0.6**.
- Official `@eslint/compat` **2.1.1** adapts deprecated rule APIs to ESLint 9.
- Tests retain all **21** configured Next rules and their exact error/warning
  severity; exercise async-client, synchronous-script and ancestor-dependent
  duplicate-Head failures; and verify exact/globbed root-directory discovery.
- JSX files are now explicitly included in linting. Previously the default file
  discovery skipped them. The newly exposed text-escaping errors are repaired
  without changing displayed wording. Seven pre-existing non-blocking image/hook
  warnings remain; do not describe lint as warning-free.
- The CI audit command and threshold are unchanged. Full audit reports zero
  vulnerabilities at this checkpoint. This is not a guarantee of no vulnerabilities.
- The October 8 rescan also required `source-map-js` **1.2.2** and removal of
  the vulnerable `sprintf-js` chain. A narrowly scoped TensorFlow argparse
  override uses **2.0.1**, without changing TensorFlow **4.22.0**. Inspection of
  the published TensorFlow JavaScript found no argparse imports; its CLI uses
  yargs. Regression checks exercise the browser bundle's CPU calculations,
  MoveNet exports, CLI help, resolved argparse version and lockfile containment.
  This is not a real-camera or downloaded-model inference test.

This is a temporary tooling containment, not a framework upgrade. Revisit the
plugin pin when an equivalent patched modern dependency chain is available.
ESLint 9 maintenance is a separate follow-up, not addressed by this release.

## Feature and backend boundaries

Vercel metadata confirmed the existing production tracker-recovery flag is true.
No new flags are enabled by this release. The new coach, free-starter, billing and
premium flags are absent from the inspected production configuration and therefore
remain false. The background reconciliation secret/switch are absent; no schedule
is registered. All payment testing stays local; live keys remain rejected.

No Supabase connector is available. Prior browser access restrictions have not
been bypassed. No migration, backup, database query, customer data write, Edge
Function deployment or backend setting change is performed by this release.
Migrations are committed source only. Restore permitted backend inspection before
approving their application and activation. Tax configuration and recurring prices
still require review before paid enrollment.

Older open PRs #2 and #3 describe superseded native/web conversion work; do not
blind-merge them and reintroduce App Store packaging. PR #10 contains an older
prescription implementation that differs from the newer main version. Do not
overwrite the current prescription engine as part of releasing PR #14.

## Verification checkpoints

- Combined local automated suite, lint, full dependency audit and optimized build
  are required before pushing the updated PR.
- October 8 optimized build passed with the existing tracker flag and placeholder
  Supabase configuration, without production credentials. Lint has zero errors
  and seven warnings; the dependency audit reports zero known vulnerabilities.
- The combined automated suite passed **154/154** tests. Database scenarios use
  isolated local PostgreSQL; payment scenarios use fixtures, not live providers.
- Require fresh CI and both connected Vercel preview builds for the exact PR head.
- Merge only the expected verified head. Confirm the new main commit, successful
  production deployment and production alias before claiming the release is live.
- Public routes, inactive API guards and sample-route exclusion can be checked
  without customer writes. Authenticated signup, saved-game reload, two-owner
  isolation and trial/paid lifecycle remain unverified until permitted backend
  access and appropriate isolated test accounts are available.

References: [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[official ESLint compatibility utilities](https://eslint.org/blog/2024/05/eslint-compatibility-utilities/),
[source-map-js advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q),
[sprintf-js advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).
