# CourtIQ

CourtIQ is a responsive web application for basketball development. Players open a URL on a phone, tablet, or computer. The optional home-screen shortcut uses the web app manifest; there is no native build or App Store release workflow.

## Run locally

1. Install Node.js 24 and run `npm ci`.
2. Copy `.env.example` to `.env.local` and enter the existing CourtIQ Supabase URL and public anon key.
3. Run `npm run dev` and visit `http://localhost:3000`.

Run `npm test`, `npm run lint`, and `npm run build` before publishing.

The public homepage is `/`. The signed-in application starts at `/dashboard`; training, sessions, journal, game log, skills, heat map, and IQ have their own browser routes.

See [the web launch guide](docs/web-launch.md) for hosting, authentication callbacks, and the remaining live-backend checks.

Latest verification: [October 5 repair and launch-readiness checkpoint](docs/launch-readiness-2026-10-05.md). Local functional checks pass; live backend, paid-release gates, and an unpatched development-tooling advisory remain open.
