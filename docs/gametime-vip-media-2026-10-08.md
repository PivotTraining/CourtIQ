# GAMETIME entry, VIP visibility and media checkpoint

## Changes

- The application shell now has a large `GAMETIME — Record stats` action in its sticky top header. It opens the existing ShotLogger modal directly; it does not route to the legacy `gametime` training alias or start a saved session by itself.
- Desktop navigation has the same action above its scrollable links. The small mobile floating plus and lower desktop session button are replaced, not multiplied.
- `VIP & membership` is visible in the profile menu and desktop navigation independently of billing activation. With billing disabled, `/billing` shows a static, non-transactional overview rather than hiding the menu or implying a purchase is available.
- Free, trial, Player and Coach boundaries are explicit. Proposed prices come from the existing catalog. The overview is not an account entitlement check and neither starts a trial nor contacts Stripe. Existing StarterGate, server and database activation controls are unchanged.
- The development-only Skills sample includes the same action, links into the existing sample tracker, and can show the same inactive membership overview. A separate sample tab was used to avoid interrupting the user's open practice.

## Video answer

Existing `SessionVideo` attaches a compatible MP4, WebM or MOV clip to a saved session in IndexedDB on that browser/device. Limits are 100 MB per clip and 250 MB per account per device. Download is available. Clearing browser data, eviction or another browser/device can make a clip unavailable; local storage is not encrypted by CourtIQ or a cloud backup.

There is no full-game in-app recorder in this implementation. The training camera uses a live stream for the drill view; it does not persist that stream. Record with the device's camera app and attach a compatible clip afterward. Do not claim that CourtIQ automatically records a game or adds footage to Photos.

## Membership and payment answer

The designed free starter allows an unsaved shot counter and one unsaved introductory training session, with zero saved games, zero journal entries and no advanced analytics. The optional eligible-account trial lasts ten days and takes no card or automatic conversion. Player pricing is proposed at USD 9/month or 79/year; Coach at USD 29/month or 249/year. Coach is owner-managed, not shared invitations. App-wide rankings and cloud video are not available; NBA style comparisons are heuristics.

Read-only production environment metadata inspected on 2026-10-08: the primary `court-iq` project has backend URL/anonymous-key configuration and the tracker recovery flag, but no billing, trial, free-starter or premium activation variables and no Stripe credentials/catalog configuration. Values were not decrypted. No configuration was changed.

Billing source deliberately rejects live mode/keys. Test Checkout uses the configured expected account and dedicated CourtIQ Player/Coach products; signed lifecycle events synchronize owner-scoped subscription records and server access. A return page alone cannot confer paid access. The user's intended merchant is Pivot, but no live CourtIQ merchant/payout-bank setup or live payment was verified here. Revenue reporting/financial administration remains unbuilt. Tax registrations and recurring terms need review before activation.

## Verification

- 172 local tests passed, 0 failures. Five new tests execute the actual GAMETIME, shell and desktop handlers; cover opening/closing the logger on dashboard, Skills, IQ, family and billing; verify the inactive VIP overview; and preserve the activated billing path.
- Lint: 0 errors, 7 existing warnings. Full dependency audit: 0 vulnerabilities.
- Optimized production build passed in an isolated directory using placeholder backend values.
- Browser sample: phone-size layout has no horizontal overflow; the 63-pixel-high GAMETIME action opens the actual sample tracker. The action remains visible while the preview's content scrolls. Light/dark overview inspected; last bounded browser error scan empty.
- This is local/sample proof and source inspection, not an authenticated production tracker/save or Stripe provider test. The public application is unchanged until a separately approved release. No migrations, live data changes, charges or billing activation occurred.
