# CourtIQ gym arrival reminders (October 23, 2026)

## Current delivery

**Available as a proposed web/PWA implementation on this branch, subject to CI and live device testing:**

- Settings → **Gym arrival reminders** is an explicit opt-in. Turning it on requests location once.
- While CourtIQ is **open and visible**, it checks device GPS against the public Georgia school-campus list and up to 25 privately saved gym locations. No server location trail is sent to choose geofences.
- Locations include active Georgia regular public middle/high schools serving grades 6–12 from NCES EDGE 2024–25. Private gyms, AAU venues, recreation facilities and tournament locations can be saved **on site** using the player's GPS and a gym name.
- Public campus points are *not* gym entrances. The radius is 300 m for public schools and 250 m for locally saved gyms. GPS accuracy varies.
- A matching arrival triggers an in-app card with **Track stats now** → Gametime and a Film Lab shortcut. Device/account-specific cooldown is six hours and GPS hysteresis prevents repeated boundary jitter notifications.
- Opt-out stops GPS watching. Tab-hidden/closed apps do not continue watching. Location and preferences stay in the browser's device storage; use clear browser-site-data to erase them.
- Account-level youth age restrictions remain in effect. Do not enable background location by default, particularly for minors.

## What is NOT yet live or proven

Browser geolocation is insufficient to wake CourtIQ when closed. The proposed web feature does **not** support lock-screen, terminated-app, or reliable background notifications. Calling this "fully enabled geofencing" would be inaccurate.

**Native release gates:**

1. Re-establish a tested, signed iOS/Android shell for the current Next.js application. The 2026 web-first decision superseded the earlier Capacitor packaging audit. Obtain Apple/Google app identity, signing accounts, real-device builds, and store approvals as applicable.
2. Choose and pin a maintained native geofencing library compatible with that shell. Integrate true OS-managed region entry/exit monitoring instead of polling background GPS. Attach local notifications and deep links to Gametime and Film Lab.
3. On a user-initiated opt-in only, explain separate **Always allow location** and notification access, including Android background-location disclosures/review. Denials must leave normal stat tracking working.
4. Register **nearest 20 iOS** / **nearest 100 Android** regions from the same campus dataset with a platform-safe radius. Rotate the registrations on app launch and meaningful movement. Do not upload continuous location or share whereabouts with teammates.
5. Native entry needs durable on-device cooldown state and a pending local notification/deep link that survives an app being terminated. Test false arrivals, same-site alert deduplication, travel games, location revocation, device restarts, lock screens, and no-network behavior.
6. Verify the released app with 2+ physical devices and a real gym before advertising background arrival reminders. Also verify accessibility and guardian/youth privacy disclosures.

## Gametime integration

The main **GAMETIME** button now passes `quickStart`, skips the old pre-game wizard, and creates a new individual game immediately or resumes the user's latest already-active game (on the reliable recovery path). An active/pending unsynced local recording takes precedence to avoid losing entries. Opponent, season, format and final scores can be added later.

The legacy tracker also starts an individual game directly when the button is pressed; team sharing, join codes and practice remain available through the alternate setup flow. Session creation still waits for backend confirmation. Failures show a retry path instead of recording unsaved stats.
