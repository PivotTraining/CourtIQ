# CourtIQ web launch

> Current repair status and mandatory backend/release sequence: [core-repair-release-gate.md](core-repair-release-gate.md). The original audit below is historical where contradicted by that record.

## Updated backend evidence

The user identified the existing CourtIQ project as `tkjvkvrzlvbukxbsilvw` (`courtiq-dev`, CourtIQ organization). Its Auth endpoint and existing tables were reachable. With explicit approval, the malformed Site URL was changed to `https://app.getcourtiq.com` and three exact branch-preview callback URLs were added. Real Google sign-in then reached profile setup and survived a reload. That proves sign-in on the prior preview, not the latest repair's live CRUD or deletion behavior. Branch-specific Preview public backend variables were corrected; production hosting variables were not changed.

The later audit found the older primary-player SELECT policy still live and no deployed `delete-account` function. The September 30 repair prepares the updated migration and function, but dashboard access was declined before live application. Do not interpret local tests or passing builds as a repaired production database.

Product direction confirmed September 30, 2026: a browser application that works on desktop, tablet, and mobile. Optional home-screen installation is a shortcut to the same web product.

## Changes

- Remove remaining Capacitor dependencies and native authentication listeners.
- Keep browser routes and responsive navigation; unknown paths now return the existing 404 page.
- Allow browser zoom, fix the narrow-screen homepage grid, and allow either orientation for installed shortcuts.
- Finish password recovery with a new-password form after exchanging the recovery code. Reuse the single-use code exchange across development effect replays.
- Show confirmation-email guidance after signup and return confirmations to the browser callback.
- Restrict service-worker caching to public static files. Auth/API responses and player pages are never cached; offline navigation shows a reconnect page.
- Remove automatic notification permission prompts during app startup.
- Disable automatic URL session detection so the callback owns the single-use code exchange.
- Explicitly declare the Next.js framework in `vercel.json`; keep the service worker fresh on updates.
- Show a reconnect instruction instead of promising offline stats will automatically save. Show an availability page if authentication configuration is missing.

## Hosting

Use the existing Vercel project attached to `PivotTraining/CourtIQ`. Build command: `npm run build`; framework: Next.js; keep the standard server deployment so `/api/auth-status` remains available.

Required environment variables, for preview and production:

- `NEXT_PUBLIC_SUPABASE_URL`: the URL of the existing CourtIQ project.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: that project's public key, never a service-role key.

The connected Vercel account currently lists `court-iq` and `court-iq-deploy`, both with deployment records for this repository. Their returned production URLs responded with HTTP 404 during this audit. The CLI confirms `court-iq` uses the generic Other preset while `court-iq-deploy` uses Next.js. `vercel.json` now declares the intended framework. Confirm the intended project and current domain before promoting this branch.

The CLI lists the Supabase variables in Production only for `court-iq-deploy`. A usable preview requires those two public variables in Preview too. No existing production variables were changed, and no production secrets were downloaded.

A targeted read of only `NEXT_PUBLIC_SUPABASE_URL` found `https://iopntnrycwbhpqclbulm.supabase.co` with a trailing newline. Public DNS returned NXDOMAIN on September 30, 2026; the auth health request could not resolve that hostname. A control lookup for the connected PivotTraining project succeeded. This establishes an unavailable configured endpoint, not whether CourtIQ's data was deleted. Environment values are now trimmed in the client and health checks. Identify the existing CourtIQ project and its status before changing the address or promoting a release.

## Authentication

In the existing CourtIQ Supabase project, set the Site URL to the selected production origin. Allow `/auth/callback` redirects on that origin, including the query parameters used for OAuth, confirmation, and recovery. Add `http://localhost:3000/auth/callback` for local development when needed. Preview callbacks need an explicitly approved preview origin as well.

Keep existing users, player ownership, and tables in the same CourtIQ database. The connected Supabase account currently lists PivotTraining and doorline; CourtIQ is not visible there. A separate account/organization or the existing CourtIQ project credentials must be confirmed before validating live sign-in and saved records. Do not replace it with another application's database.

## Release verification

1. Require passing tests, lint, and production build.
2. Check the homepage and login on narrow mobile and desktop layouts, browser back/forward, valid app deep links, and unknown-route 404s.
3. Check Google sign-in, email confirmation, password recovery, sign-out, and a player profile reload against the real CourtIQ backend.
4. Save and reload a training record to confirm persistence and ownership; confirm account deletion still calls the existing authenticated backend function.
5. Confirm `/api/auth-status` reports healthy on the selected live origin. The diagnostic is public and exposes neither the key nor project URL.
6. Verify offline navigation shows the reconnect page, and auth/API responses do not appear in Cache Storage.

Live user flows cannot be certified from a placeholder project URL. Local browser tests use an isolated mock backend and are documented as such.

## Verification completed September 30, 2026

- All 20 Node tests pass; lint passes without warnings; the production build succeeds using clearly fake CI environment values.
- Desktop and 375px mobile homepage inspection; mobile dashboard has no horizontal overflow and browser zoom is allowed.
- Mock-backed browser sign-in, dashboard, training navigation, and a complete password-recovery callback followed by a successful password update and dashboard return. No real account or record was created.
- Unknown route returns HTTP 404. Offline reconnect page renders; service-worker runtime tests verify the navigation fallback and exclusion of auth/API/player responses. Browser offline emulation did not reliably exercise the worker navigation fallback, so that specific live behavior remains a release check.
- Existing deployment URLs tested returned 404; real Google sign-in, email delivery, saved records, and account deletion are not certified.
