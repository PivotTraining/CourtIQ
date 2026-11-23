# CourtIQ in-game recording, first-use guide and Block stat release verification

This feature stores video on the recording device (IndexedDB). It does NOT automatically write to iPhone Photos, Files, or Cloud, and does not modify previously saved clips.

## What to check on the actual recording device

1. Sign in with a parent account, choose the correct athlete and start a sample game. Record with filming permission.
2. Confirm REC is clearly visible and a standalone video clip is saved approximately every 30 seconds. Filming should resume only after the prior save completes.
3. Stop and save. Confirm all saved clips are visible, playable, and downloadable. Download one to Files or Photos and verify the independent backup.
4. Reload the same app/browser and same player/game, then confirm saved segments are still available. Sign in to another device to verify local footage is *not* falsely represented as cloud-synced.
5. Test camera denial, backgrounding, low storage (250 MB per-account limit), navigating away mid-recording, and iOS Safari power interruption. Explain that a browser crash can lose the unfinished segment.
6. On a fresh account with no recorded games, open the welcome guide, launch game tracking, and review steps. Reopen guide on demand and ensure different accounts have separate dismissal state.
7. While looking at Shot chart, tap Block and confirm **BLK** increases by one in the current session; Undo reverses it. Verify Assist, Rebound, Steal, Turnover and Foul are also accessible, without switching to Box Score.
8. Tap any court zone to select a shot, log Made or Missed, and confirm the location stays selected. No separate location dropdown should obscure the court.

Release constraints: never delete/reinstall the app or clear Safari website data to troubleshoot missing footage. New local video segments do not recover recordings that never saved. Do not enable customer billing from this PR.
