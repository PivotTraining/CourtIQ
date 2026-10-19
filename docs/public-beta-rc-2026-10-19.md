# CourtIQ public beta release candidate — October 19, 2026

## Release posture

CourtIQ is being prepared for a **free public beta**, not a paid commercial launch. Billing remains out of scope for this release candidate.

## Verified production foundations

- The browser application is live at `app.getcourtiq.com`.
- The public marketing site is `getcourtiq.com`.
- The production Supabase project is healthy and the app authentication health endpoint reports reachable/healthy.
- Core player-data tables use row-level security and ownership relationships are backed by database constraints.
- The tracker ownership-alignment migration is installed in production.
- The public-beta account-deletion request queue is installed in production with RLS.
- An authenticated user can create and read only their own deletion request. A cross-account insert was explicitly denied in an isolated test. Test rows were rolled back.
- Account deletion is a manual beta workflow until the reviewed automatic deletion function can be deployed and exercised safely.
- Public support, privacy, and terms pages are available from the app.

## SECURITY DEFINER tracker RPC

Supabase currently warns that `public.apply_session_command(uuid,uuid,integer,jsonb)` is a `SECURITY DEFINER` function callable by authenticated users.

This is intentional for the versioned game-tracker command path. The current production definition:

- rejects unauthenticated callers;
- loads the requested session and verifies its player belongs to `auth.uid()` before processing a command;
- uses an empty fixed `search_path`;
- grants EXECUTE to `authenticated` and `service_role`, not `anon`;
- validates command shape, supported stats/zones, version conflicts, payload size, timestamps and reversals;
- writes through the guarded versioned session-command path.

A live cross-account call was rejected with `Session unavailable` before command processing. The linter warning is therefore documented as an intentional privileged RPC surface, not treated as proof of a vulnerability. Any future edits to this function must preserve its explicit ownership check and restricted grants.

## Still required before broad public-beta promotion

1. **Enable leaked-password protection** in Supabase Auth. The current advisor reports it disabled.
2. **Run a real human account journey** using a disposable account: signup, delivered confirmation, login, refresh, logout, recovery email, password reset, login again, and Google sign-in if offered. Passwords must remain user-entered and private.
3. **Verify a restorable production backup** and document the restore procedure. Migration rollback evidence is not a substitute for a full backup.
4. **Run physical-device QA** on at least one iPhone/Safari and one Android/Chrome device, covering the tracker, Skills, Adaptive Finishing, Film/video, forms, session recovery and home-screen use.
5. **Operate the deletion queue** during beta and process requests within the published support workflow.

## Paid-launch gates remain separate

Pricing, trial language, Stripe Checkout, signed provider events, persisted entitlements, renewal/failure/cancellation handling, taxes and billing support are not release requirements for the free public beta and must remain disabled until separately approved and verified.
