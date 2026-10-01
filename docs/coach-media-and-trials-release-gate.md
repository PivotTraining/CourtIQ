# CourtIQ coach workflow, video, social cards and trials — October 1, 2026

Local implementation checkpoint. No live database migration, production flag,
Stripe product, subscription, tax setting, charge or public release was changed.

## Built locally

- Owner-managed roster games: choose 1–30 owned players, create one game with
  separate protected player ledgers, switch recording player without ending the
  game, resume, review roster totals and complete all records atomically.
- Creation and completion use stable request IDs. Duplicate retry does not create
  another game. Version conflicts fail the whole completion. Missing player
  records or pending device entries block completion.
- Team report distinguishes recorded points from entered final team scores.
  Combined shooting percentages weight attempts; free throws count once;
  team minutes/possessions/lineup ratings are not inferred. CSV identifies scope,
  missing records and denominators, and neutralizes formula prefixes in names.
- Square 1080×1080 and Story 1080×1920 report-derived social cards; PNG generation,
  preview, file-share capability detection and a native download link. Names are
  opt-in. Cards include the recorded date, zero-attempt percentages are unknown,
  and no clip, location, private note or automatic social post is included.
- Report video controls in the recap, session history, game log and recovered
  saved report. One device-stored MP4/WebM/MOV clip per account/session, 100 MB
  per clip, 250 MB per account on that device. IndexedDB stores the actual blob,
  not an ephemeral URL. A browser playback probe runs before replacement; failed
  validation/storage leaves the earlier clip intact. Playback/download/delete
  controls and explicit footage-permission selection are present.
- Clips are **not** cloud-backed, encrypted by CourtIQ, cross-device, full-game
  recording or AI analysis. Browser storage can be cleared/evicted. Account scope
  prevents accidental display under another login, not access by a device owner.
  Successful account deletion attempts local clip cleanup and explicitly warns
  if the browser cannot confirm it; original/downloaded/other-device copies are
  not deleted automatically. Clip deletion requires an explicit confirmation.
- Ten-day new-user trial clock: authenticated verified account eligibility,
  exactly 240 hours, once per account, immutable client permissions, retry returns
  the original window, expired trials do not restart. Inactive by default. This
  is **not** paid feature enforcement or completed Stripe integration.
- Fixed the global CSS reset's cascade layer: utility padding and centering now
  work instead of being overridden by the unlayered universal reset. The saved
  report's actual browser padding is 24 px again.

## Local verification

- 71 automated tests pass; includes SQL ownership/atomic completion/idempotence,
  foreign-account and anonymous rejection, stale version/NULL version rejection,
  trial eligibility/privacy/expiry/retry, stored blob isolation and account cleanup,
  stats/CSV/formula escaping, safe SVG and true card dimensions, and spacing.
- Lint and production build passed after synchronizing the newer main-branch
  brand work, using clearly fake Supabase configuration. Public homepage,
  layout, privacy, terms and domain middleware remain identical to newer main.
- Production-mode local server returned HTTP 404 for both `/dev/coach` and
  `/dev/tracker` even with `COURTIQ_LOCAL_PREVIEW=true`; homepage returned 200.
- Actual sample browser flow: roster creation with two players; player selection;
  shared manual period/clock; offline assist retained, finishing blocked until
  retry, synced assist counted once; all player records completed together;
  saved report reopened and final 60–55 distinct from six recorded points.
- MDN's public flower MP4 used only as test footage: local save, playback through
  its five-second duration, invalid replacement rejected with previous clip kept,
  leave/reload and reopen preserved the same video metadata. No real athlete
  footage or camera permission was used and no clip was uploaded to a server.
- Real light/dark colors and neon stat borders/shadows inspected. No horizontal
  overflow in the observed 320×700 and 390×844 CSS phone viewports. Desktop
  viewport checks and the normal browser view were inspected. Temporary viewport
  overrides were reset.
- Visual evidence: `coach-report-phone-dark.jpg`, `coach-report-phone-light.jpg`,
  `coach-social-story-phone.jpg`, `coach-social-square-desktop.jpg`,
  `coach-tracker-desktop-dark.jpg`.
- **Download delivery is unverified:** the in-app browser timed out waiting for
  CSV/PNG download events, including a native PNG anchor. PNG generation and
  CSV contents are verified; do not call the browser delivery check passed.
  Video download and native app sharing are also unexercised. Test in actual
  Safari/Chrome on phones/desktops, including canceled sharing.
- This sample fixture does not verify live Supabase/Auth persistence, production
  entitlements, cloud storage, assistant roles, 200% zoom or landscape behavior.

## Activation gates

1. Restore authorized Supabase access; inspect the real schema/policies, check
   advisors and take a verified restorable backup. Do not bypass prior denial.
2. Apply the ownership, ledger and roster migrations in order only after review.
   Test real owned/foreign accounts, restored data, ledger retries, different-
   device conflicts, completion and authorized cascades. Keep recovery and coach
   flags false until that passes. The development sample routes must return 404
   in production even with `COURTIQ_LOCAL_PREVIEW=true`.
3. Trial migration can be staged inactive. Before enabling, integrate real server
   entitlements and approved no-card/card/conversion rules; define the new-user
   cutoff at launch, grandfathering and multiple-account abuse policy. Never
   paywall record access/export or erase stats on trial expiry. No promotional
   trial UI is active today.
4. Reconnect and verify the Pivot Stripe account/sandbox. Prices remain proposals.
   Build authenticated Checkout/Portal, allowlisted prices, signed/deduplicated
   webhooks, reconciliation and subscription lifecycle tests. Trial-to-checkout
   must preserve the original deadline. Review tax registrations and public terms.
5. Before cloud video: private owner-scoped storage, signed URLs, resumable upload,
   codec/real-device tests, account deletion, quota/cost/retention policies and
   age/guardian permission workflow. Do not advertise device-only clips as backup.

Assistant/player/parent invitations, coach assignments and shared cloud clips
remain genuine missing product work, not simply missing credentials.
