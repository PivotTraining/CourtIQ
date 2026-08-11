# Court IQ production-readiness audit

Audited August 11, 2026 from `PivotTraining/CourtIQ` at `9bb59bb`.

## Release decision

Do not upload the original `main` branch to App Store Connect. It cannot reliably produce the native application represented by the existing Apple record and contains release-blocking identity, packaging, entitlement, and data-ownership defects.

This hardening branch makes the native package reproducible and aligns iOS with the existing App Store Connect record. It is still a release candidate, not an authorization to upload: the database migration, real-device flows, signing, and Apple build diagnostics must be verified first.

## P0 findings addressed in this branch

- **Apple identity mismatch:** App Store Connect uses `com.ChrisDavis-courtiq`, while Xcode used `com.pivottraining.courtiq`. Debug and Release now use the existing Apple identifier. Android retains its valid Java-style application ID because Apple's legacy identifier contains a hyphen and cannot safely be reused as an Android namespace.
- **Unreproducible native package:** Capacitor expected `out/`, but the normal build never generated it. `build:native` now uses Next.js static export, and the OAuth callback works client-side so the export completes. `sync:ios` builds, copies, syncs, then verifies native configuration.
- **Unstable workspace tracing:** Next.js could select an unrelated parent
  lockfile as the workspace root, making build traces depend on files outside
  CourtIQ. Tracing is now pinned to the repository directory for reproducible
  web and native builds.
- **Invalid release numbering:** the repository used build `1` even though App Store Connect shows failed builds through `64`. The next source build is `65`; confirm no newer upload exists immediately before archiving.
- **Device compatibility:** the app target required iOS `26.0`. It now supports iOS 15+, consistent with Capacitor 8's supported floor.
- **Camera declaration:** movement tracking used the camera without an iOS purpose string. `NSCameraUsageDescription` is now present.
- **OAuth deep-link exchange:** native code passed an entire URL where Supabase expects the PKCE code and leaked the app URL listener across mounts. It now extracts the code and removes the listener.
- **False onboarding:** profile query errors were interpreted as a missing profile. Users now see a retryable error instead of being routed into duplicate profile creation.
- **Family player ownership:** the UI inserted `manager_uid`, but the checked-in fresh schema did not define it and RLS only allowed a user's primary player. Migration `20260811190000_managed_player_rls.sql` establishes explicit ownership for managed players and applies it to profiles, sessions, shots, journals, and team access.
- **Paid-tier bypass and misleading commerce:** Pro and Team IQ were granted
  entirely by `localStorage`, while a second in-game path still reported a
  simulated purchase as successful. All simulated purchase, price, upgrade, and
  fake account-link flows are now removed. Working individual IQ and heat-map
  analytics are available without a paywall; team collaboration is plainly
  unavailable until ownership and billing are server-verified.
- **Incomplete account deletion:** the UI removed a player row but left the Supabase Auth account and managed players behind. A user-authenticated `delete-account` Edge Function now removes all managed player data, then deletes the Auth user with server-only credentials.
- **Dependency exposure:** an unused Firebase dependency remained after the Supabase migration and pulled vulnerable packages into production. It is removed; safe dependency patches reduce the audit from 15 findings (including 3 critical) to 3 high findings inside the current Next.js major.
- **No automated gate:** CI, ESLint configuration, native-identity tests, web build, native export, and a native configuration verifier are now included.

## TestFlight failures 55, 61, 62, 63, and 64

The repository cannot reproduce or conclusively explain those uploads:

- its checked-in iOS build number was `1`, not any of 55–64;
- its current Xcode identity did not match the existing App Store record;
- Git history contains no matching native release commits or CI upload workflow;
- App Store Connect requires an authenticated session to reveal each failed processing message.

The bundle mismatch is a concrete release blocker, but it is not enough evidence to claim it was the only reason those five uploads failed. Obtain the processing message for build 64 (and one earlier failure if different), plus the uploader's archive/export log. Do not delete the existing app record or create a replacement bundle ID.

## Remaining P0 release gates

1. Apply the new Supabase migration in a staging project, then verify primary and managed-player create/read/update/delete, session and shot ownership, and team access with two separate user accounts.
2. Inspect App Store Connect build 64's processing errors while signed in. Reconcile the latest Apple build number before archiving.
3. Select/install full Xcode, download the Apple team profiles, archive build 65 with automatic signing, and run it on a supported physical iPhone. The current machine exposes Command Line Tools only, so an Xcode compile/archive could not be completed here.
4. Verify Supabase OAuth redirect allowlists include the existing native scheme and production web callback. Test email/password, password reset, Google, and Apple sign-in on device.
5. Deploy and test the `delete-account` Edge Function, then validate the public privacy policy/support contact against actual retention and child-consent practices.

## P1 product work after the release gates

- Replace synthetic managed-player identifiers and multi-table client deletion with transactional database RPCs.
- Design a secure participant model for collaborative live sessions. The current join-code query conflicts with owner-only RLS and must not be opened with a broad select policy.
- Persist parent-child relationships, entitlements, notification preferences, and analytics in the backend instead of local storage.
- Reintroduce paid tiers only with StoreKit/Play Billing and server-verified
  entitlements; keep prices and purchase language out of the app until then.
- Add real video capture/upload/storage lifecycle, quotas, resumable uploads, deletion, and consent. Current camera work is live pose overlay only; it is not a game-film workflow.
- Benchmark TensorFlow startup, sustained frame rate, heat, memory, and battery on older supported iPhones; move inference or capture to a native path if the web view cannot meet the product target.
- Add integration tests for auth/profile creation, shot logging/undo, session statistics, managed-player switching, and RLS denial cases.
- Upgrade Next.js to the first fully patched compatible release in a dedicated branch; the current major retains three upstream high-severity audit findings.

## Verification completed

- `npm run lint`
- `npm test`
- normal Next.js production build
- static native production export
- Capacitor iOS sync
- native identity/build/deployment/permission verifier

An Xcode simulator build and archive remain blocked by the local Xcode selection noted above.
