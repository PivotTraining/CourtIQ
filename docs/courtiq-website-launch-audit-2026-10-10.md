# CourtIQ public website: 19-point launch-readiness audit
10 October 2026 · Draft PR #19 · based on the October 10 main branch

The photographed checklist is about both public conversion pages and a signed-in product.
The changes in this PR are source changes only, not proof of live deployment or visual QA.

| # | Checklist item | Current position | Release note |
|---|---|---|---|
| 1 | Custom 404 | Existing, improved | Basketball-themed 404 already existed. Kept the home link and non-indexable metadata. |
| 2 | CTA above the fold | Existing, measured | Landing hero already opens `/dashboard`; hero CTA now has privacy-controlled event counting. |
| 3 | Meta title per page | Improved in PR | Public homepage/Privacy/Terms titles and distinct private section titles. Auth and preview pages noindex. |
| 4 | Meta description per page | Improved in PR | Landing/legal descriptions plus signed-in app section descriptions. |
| 5 | Open Graph image | Added in PR | Generated 1200×630 branded image under Next.js metadata route; Twitter summary-large supported. |
| 6 | Favicon set | Existing | Branded SVG, 48px PNG, app icons and Apple touch icon. |
| 7 | robots.txt | Added in PR | Public marketing/legal content allowed; auth, API, preview and personal app routes disallowed. |
| 8 | sitemap.xml | Added in PR | Lists only home, privacy and terms pages. |
| 9 | Alt text on every image | Partial verification | Public landing screenshots and logo already have descriptive `alt`. A complete image audit across the authenticated app and browser QA remain to be done. Decorative images should have empty alt; informative visuals should describe the information. |
| 10 | Mobile breakpoints | Existing, QA pending | Current mobile and desktop app styles remain. Responsive landing CTA added; needs real-device testing. |
| 11 | Sticky mobile CTA | Added in PR | Public marketing page only, never overlays signed-in basketball tracking screens. |
| 12 | Loading states | Existing | Sign-in, profile setup and app loading states already exist. Confirm live auth/network states separately. |
| 13 | Form error states | Existing | Sign-in, password recovery and player-setup errors are visible. Validate real server responses separately. |
| 14 | Thank-you page | Not applicable yet | No confirmed newsletter/contact/lead submission flow exists to justify a separate success route. Real sign-up/email confirmation already uses an accurate inline confirmation message. Do not fabricate a successful submission. |
| 15 | Privacy policy | Existing, updated | Adds explicit analytics preferences. AI Coach-specific privacy changes exist separately in draft PR #18 and must be reconciled before either merges. |
| 16 | Terms page | Existing | Legal copy needs owner/legal review before public growth campaigns. |
| 17 | Cookie banner | Privacy-choice equivalent added | Essential account storage remains usable. Optional first-party usage telemetry defaults OFF until the visitor explicitly opts in, can be changed on /privacy, and honors DNT/GPC signals. Third-party tracking not introduced. |
| 18 | Analytics installed | Existing, consent-gated | First-party event endpoint already existed. CTA click is a newly allowed event. No advertising tracking, marketing pixels, or third-party script installed. |
| 19 | Real contact address | Unverified | Need a business-approved real support email/contact method and, only if appropriate, actual physical business mailing address. Nothing fabricated or exposed from private data. |

## Before merge or production deployment
1. Confirm correct canonical origin and app domain (`https://getcourtiq.com`) across all environments.
2. Run lint, automated tests, security audit and production build on final PR head, then visual QA on iPhone/Android/desktop including dark mode and consent banner/mobile CTA spacing.
3. Open the generated `/opengraph-image`, `/robots.txt` and `/sitemap.xml` from a staging deployment and validate returned media types/content.
4. Check unfurled share previews using social platform debuggers and verify canonical, Open Graph and noindex tags in rendered HTML.
5. Obtain and verify an official support/contact address; do not guess one from domain or founder information.
6. Confirm legal/privacy text, data-retention descriptions, and the behavior of essential cookies and optional measurement.
7. Reconcile shared `src/app/privacy/page.js` changes from open AI Coach PR #18 before merging both branches.
8. Sign-up, sign-in, logout, reset and session recovery must pass live authenticated tests. SEO CI success is not live auth verification.
9. Do not create meaningless thank-you URLs without a corresponding successful action.

## Suggested conversion testing after release
Track anonymous `marketing_cta_click` and app entry (consent permitting) separately from account sign-up completions. Do not assume a click is a registered or paying customer. Review bounce, time-to-first-use and retention only with consent and appropriate privacy controls.
