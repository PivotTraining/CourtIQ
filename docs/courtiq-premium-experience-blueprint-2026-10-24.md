# CourtIQ — Premium experience blueprint and execution plan
**Date:** October 24, 2026  
**Audience:** product, design, engineering, release QA  
**Decision:** polish existing experience, ship camera + stats safely, and only then evaluate verified AI training. No paid product launch implied.

## Executive product direction

Create the premium feel of the supplied basketball screenshots without copying their proprietary UI, artwork, claims or fictitious functionality. CourtIQ remains visually distinct: midnight navy #1A1D2E, orange #FF6B35, warm court-ivory #F8F6F0, white, clear type. The two primary jobs are **Train** (development workouts) and **Track** (games and stats). **Record** is a contextual action within either mode, not a separate competing data silo. Families select the active child before any session and switch without mixing accounts.

**Product promise in public beta:** Record your own stats, practice purposefully, review progress and manage multiple eligible player profiles. Camera features are optional and explicitly labeled. Do **not** call manual make/miss logging or skeleton landmarks an "AI shot detector." Do not market full-game video storage, measured release angle/ball speed, XP/reward currency, paid "Pro" entitlements or shared public leaderboards until each is actually released and validated.

## Status inventory: October 24

- **Live/main:** family player switching, one-tap game tracker, manual game/shot logging, game deletion and stats removal, drill library, skills and manual practice outcomes, historical records, device-video attachment to session reports, branded light/dark tokens, settings and a non-transactional membership overview. Existing youth-account policy restricts new under-13 profiles pending verifiable consent.
- **Draft PR #33:** richer training studio and self-recorded shot-by-shot recap; not production.
- **Draft PR #39:** foreground MediaRecorder video within game tracker while stat buttons stay active, with local quota and permission recovery; not production.
- **Draft PR #40:** branded Google Identity Services login behind a preview-only client ID; not production.
- **In code but not validated as AI:** DrillCamera uses pose/skeleton landmarks. It is not verified to identify shot makes/misses, dribble counts, ball trajectory or biomechanics.
- **Billing:** public beta has no activated paid enrollment; existing memberships/plans are **proposed** and activation is gated. Keep screens informational until provider, entitlement and family privacy gates pass.
- **Existing critical dependency audit advisories:** unresolved; track separately and do not claim an all-green release.
- **User-supplied screenshots:** design references from another basketball app. Never present them as CourtIQ screenshots.

## Information architecture

Primary mobile navigation: **Home · Train · Track · Progress · Account**. A family switcher ("Recording for: [child] ▾") is visible ahead of any Train or Track session. Home may surface a three-button action group: **Train · Track stats · Record video**. The third button asks **Record workout** or **Record game**, then opens the appropriate mode with its integrated camera, rather than splitting shot logs across siloed record screens.

Desktop: max content width 1080–1200 px; cards and navigation adapt to space. Full-screen video/tracker remains intentionally immersive.

## Five screen specifications

### 1. Membership / future Pro
**Purpose:** establish trust and clearly distinguish free features from hypothetical paid capabilities, not collect money prematurely.
**Visual:** short basketball hero strip, 34px strong title, concise value proposition, 4–6 benefit rows at most, clear free-state card, monthly/yearly selector only when actual billing is enabled. Orange CTA only when supported by server-verified entitlement and checkout state. Legal/restore/membership links visible.
**Copy now:** "CourtIQ membership" · "Beta access is currently free" · "Paid plans are not active." Show factual availability rather than "unlimited" if quota or tier rules differ. Proposed pricing may be labeled and shown only in the transparent overview.
**Later:** one visibly selected plan, true billing cadence/total, cancel terms, no-card trial only if verified, restore/manage subscription when available. Do not invent legacy badges or competitions.
**State matrix:** beta free / billing unavailable / trial eligible / trial active / paid / past-due / cancellation scheduled / network error, each server-sourced. Never unlock based only on checkout redirect.
**Current files:** src/components/billing/MembershipOverview.jsx, BillingScreen.jsx, membership-overview.css. Keep all existing billing gates.

### 2. Train home
**Purpose:** next training action in under five seconds.
**Hero:** active child avatar/name at top, "Ready to put in work?" headline, optional real camera thumbnail or permitted licensed basketball visual. One primary **Start workout** CTA.
**Goal strip:** 3 compact cards for shots, dribbling, time, but goals must reflect chosen drill and actual saved data; hide non-existent counts. No fictional XP.
**Below:** seven-day calendar with completed sessions only, most recent 2–3 actual workouts, progress trend if backed by comparable results, "See all drills."
**Secondary paths:** Shooting, Guided Shooting, Guided Dribbling; category labels correspond to actually implemented drill behaviors. No automatic voice feedback claims unless enabled.
**Failure and empty states:** no history / offline / camera unsupported / no selected child; preserve workouts on fetch error, never replace with zero.
**Current files:** src/components/train/TrainScreen.jsx, SkillsScreen.jsx, WorkoutTimer.jsx, SkillsScreen.css family; align duplicate Train/Skill Lab entry points without removing lessons.

### 3. Training session / future AI Trainer
**Purpose:** track a workout without leaving the active camera.
**Above fold:** live portrait/landscape viewfinder (optional), camera status, elapsed time, drill name, goal progress, easy manual **Made / Missed** or **Clean / Needs work** inputs, pause and stop buttons. Keep camera optional and never gate practice on permission.
**Session recap:** duration, made/attempted, percentage only when denominator >0, best consecutive streak, shot-by-shot strip with manually recorded timestamps. Accessible correction/undo. Optional replay separately titled "Video recording"; recorded event timestamps are NOT synchronized to video until calibrated and tested.
**Fallback:** unsupported browser, permission denied, phone screen locked, recording size limit, save failure, or interrupted camera. Preserve stat session independently and offer download/retry for unsaved clip.
**Future computer vision:** validated make/miss detection, confidence, manual override, calibrated release metrics, frame-to-event sync, and real-device evaluation. May use existing pose landmarks for a limited visual coaching cue, but not as evidence of made shots or correct shooting form.
**Current draft:** PR #33; current pose component src/components/train/DrillCamera.jsx.
**Non-goals for this release:** voice scoring, XP, social leaderboard, automatic dribble accuracy, biomechanics scoring.

### 4. Game video + live stats
**Purpose:** one operator can film from a stationary phone AND log the active athlete's game stats.
**Layout:** player name/quarter & scoreboard if known; video preview across top ~35% in portrait (smaller when collapsed); big REC/time badge; stat rail with PTS/shots, REB, AST, STL, BLK, TO, PF, FT; persistent Undo and Save/End; selected court zone optional and never blocks quick box score.
**Flow:** select player → Track stats now → optionally tap Record video → approve camera → log actions while footage records → Stop & save video → end/save stats → report with local clip attached. If only one human operator is holding the phone, allow compact viewfinder and keep targets at least 44px.
**Persistence:** stats save independently through existing Supabase session ownership; video remains device-only under existing quotas (100MB per clip, 250MB per account), not cloud-backed/full-game continuous capture. Show actual remaining constraints; no background recording guarantee. Storage failures should not lose successfully recorded stats. Session/active child cannot switch while unsaved video is held.
**Source:** PR #39; src/components/shots/CourtTrackerView.jsx, ReliableTracker.jsx, ShotLogger.jsx, SessionVideo.jsx, src/lib/deviceVideo.mjs.
**Acceptance:** record and tap game stats concurrently on iPhone Safari, installed iOS Home Screen app, Android Chrome; correct player association; save video or recover blob on failure; reload and confirm stats and clip; camera denial leaves all stats controls working.
**Scope:** no auto-highlights or per-shot video sync until supported by real timestamps and validation.

### 5. Settings & family account
**Purpose:** clear parent ownership, easy switching and privacy.
**Groups:** My account / Players & family / Recording & storage / Notifications / Appearance / Privacy / Help.
**Each setting:** one-line human copy, icon, correct toggle/entry action, clear disabled state. No fake connected service or push permissions.
**Required controls:** switch/add eligible managed player; player-specific data notice; camera/mic access explanation and explicit consent; device-only footage, download & delete; gym-arrival opt-in; app-wide logout; export/delete instructions.
**Sensitive:** under-13 new player creation blocked until verified parental consent is in force; default video sharing is off; one parent cannot access another family's records; name and opponent omitted from social cards by default.
**Source:** src/components/settings/SettingsScreen.jsx, GymArrivalSettings.jsx, src/components/PlayerSwitcher.jsx and family dashboard.

## Design tokens and UX rules

- Reuse tokens in src/app/globals.css; **do not replace** existing color system wholesale.
- Type scale: screen 28–34px / section 20–24 / card figure 26–48 / text 14–16 / caption >=12 for actionable info. Contrast AA in both light/dark.
- 8px spacing increments; card radius 16–22; primary buttons min 48px height; interactive hit areas >=44x44px.
- Reduce floating secondary CTAs; each screen has one dominant action. Ensure safe-area inset and sticky controls on iPhone 18-class viewport.
- Motion <200ms for simple feedback, respect prefers-reduced-motion. Avoid long animations while in live tracking.
- Every stat shows its source: self-entered / automatically calculated / sensor-derived with validation. Never fabricate zero values from failed reads.
- Test at 320, 375, 390, 430px and tablet/desktop; real dark/light themes; phone keyboard and VoiceOver/TalkBack.
- Background hero footage/image requires ownership/licensing, compressed media, poster fallback, performance budget and optional reduced motion. No user/player image without consent.

## Build order: make the release safer, not larger

| Sequence | Slice | Required engineering work | Merge gate |
| --- | --- | --- | --- |
| 0 | Beta integrity and regression | Verify Google signup on installed iOS, existing accounts, stats data separation, camera consent; track and fix dependency audit; retain current working routes | Two real parents, two players, Safari/Chrome, no cross-account data or lost saved sessions |
| 1 | Shared polish | Unify shell/hero/button/stat cards using existing tokens; make player switch persistent and top action visible; improve spacing and empty/loading states | Screenshot diff 320–430px, accessibility, no history regressions |
| 2 | Training recap | Review & harden PR #33, prove per-rep timeline, streaks, save/retry and older-history fallback, avoid invented AI data | Tests green; parent can finish, save, reopen a recorded training session |
| 3 | Integrated camera + stats | Review & harden PR #39; permission, foreground recording, audio default, 100MB cap, local saved media, family switch/end guard | Real-device pass on iPhone Safari/Home Screen and Android; camera never blocks stat inputs |
| 4 | Train dashboard polish | Restructure TrainScreen and SkillsScreen around one hero, drill paths, goal cards, streak & real history; link completed-session recap | All displayed counts derived from persisted records; no imaginary XP |
| 5 | Future AI coach experiment | Annotate real footage, prototype detection with truth labels, validate low light/multiple players, confidence + override; store no unauthorized child video | Explicit reviewed accuracy thresholds, privacy assessment, opt-in, negative-case tests; no public AI claim before proof |
| 6 | Membership design only | Refresh membership overview and later live checkout behind existing flags and Stripe verification; approved entitlements/pricing first | Real subscription lifecycle, refund/cancel UX, compliance, no accidental billing |

**Parallel-safe boundaries:** PR #33 and PR #39 touch different parts of the UI but both interact with sessions/videos; rebase on current main and run combined mobile QA before merge. PR #40 touches Google login and must be tested independently; do not bundle experimental OAuth with camera deployment.

## Ship checklist

1. CI lint and automated tests; security audit blockers addressed or explicitly recorded as release risk. Preview build READY does not equal a mobile smoke test.
2. Three complete parent journeys: parent selects child A→records game→adds video→saves→switches child B→records training→returns to A; verify shots and clips don't bleed across children. Reopen after app refresh and sign-out/login.
3. Real-device matrix: iOS Safari, iOS Home Screen PWA, Android Chrome, desktop keyboard; camera permission allowed/denied; interruption/lock/size quota/device space.
4. Video permission and consent explicit; upload is opt-in only when a real endpoint exists; video local storage clearly labeled. Provide recovery for full disk, quota error and stop-before-exit.
5. Stats are source-of-truth and replay media is ancillary; deletion of a saved game removes relevant stats and local clip where available.
6. No payment CTA unless signed entitlement/Stripe are functional. No AI/XP/automatic measurements claimed before release.
7. Record exact tested production deployment ID, SHA, dates, smoke check, known limitations and rollback route; release owner signs off.

## Release success metrics (targets for instrumenting, not claimed results)
- Game tracking start → first entered stat, time to launch (goal: ≤2 taps after active player selected).
- Game save success and return-to-history success (target: ≥99% in instrumented beta).
- Training session completed → result saved → replay opened, separately track user cancellation.
- Video opt-in rate, denied permission, save failure, recovered/downloaded clip, and recording interrupted. Do not upload footage or confidential labels into analytics.
- Onboarding: first Google authentication → select player → first recorded stat. Track abandon points without revealing parent/child PII.
- Performance: first interaction usable on supported phones, no accidental horizontal scrolling, accessible modal focus and clear empty/error states.

## Immediate next engineering ticket
**Deliver one vertical slice:** integrate and QA PR #39 on a test parent account with real iPhone, while preserving stats save on video denial/failure. Then merge PR #33 to improve practice recap, and perform shared visual polish against user-provided reference screenshots. Keep AI promise and paywall behind evidence/activation gates.

---
Existing PRs: [Training recap #33](https://github.com/PivotTraining/CourtIQ/pull/33), [Video + stats #39](https://github.com/PivotTraining/CourtIQ/pull/39), [Branded Google #40](https://github.com/PivotTraining/CourtIQ/pull/40).
