# CourtIQ Brand V2

## Direction

An orange basketball-Q symbol paired with a bold, upright CourtIQ wordmark.
Court is charcoal on light surfaces and white on dark surfaces; IQ is orange.
The compact symbol is also used independently for browser and phone icons.

Palette: court orange `#FF6B35`, charcoal `#161B24`, white `#FFFFFF`.
Full logo: `679 × 120` viewBox, with text converted to paths. No runtime fonts.
Use the SVGs for interface artwork and the 2400-pixel PNGs for other tools.

## Method and final image-generation brief

Exploratory raster concepts were produced with the built-in image generation
tool, not a CLI fallback. The selected direction was rebuilt as native SVG
geometry and outlined type because the generated transparent raster edges were
not suitable for production. Raster concepts are not the shipped brand assets.

Final concept prompt:

> Create a single horizontal premium basketball-performance app logo for
> CourtIQ. Use an original bold basketball-Q symbol: a circular orange Q whose
> generous negative-space interior carries only two crisp curved basketball
> seams, with a purposeful diagonal Q tail. It must remain recognizable at
> 24 pixels. Do not put another small icon inside it. Set the wordmark exactly
> as CourtIQ, in a bold, upright, modern athletic sans serif. Court is charcoal
> #161B24 and IQ is court orange #FF6B35. Flat two-color artwork, clean geometry,
> no gradients, glows, noisy edges, crests, brains, circuits or mascots. Transparent
> background, no panels, mockups or captions. Wide horizontal lockup.

The vector cleanup uses Arial Black as a type foundation, converted into seven
glyph paths. It is not a trademark clearance or font-license assessment.

## Exports

`public/brand/courtiq-v2/` contains light, dark and single-color logos (SVG +
transparent PNG), the symbol (SVG + PNG), ordinary app icons, a distinct Android
maskable icon, and an opaque 180-pixel Apple touch icon. Maskable artwork is
tested against the central 80% safe circle. Old public assets remain untouched.

`src/lib/brandArtwork.mjs` is generated inline SVG artwork for social report
cards. Those exports need no image request or font fetch. Recorded statistics,
headlines and sharing privacy rules are unchanged.

## Rebuild

From the repository root, run `node design/courtiq-brand-v2/build-logo.mjs`.
The default source font is the macOS Arial Black installation. An alternate
path to the same font can be supplied as the first argument. Dependencies are
the existing Next.js compiled font reader and Sharp installation. Rebuilding
is not required for normal CI or deployment: finalized artwork is committed.

## Integration and verification scope

- Landing page, login, dashboard, desktop navigation, loading and offline states.
- Local Skills preview, development profile export, square/story social cards.
- HTML icon links, manifest, notification icons and versioned public cache.
- The existing theme class selects the visible logo without DOM reads in React
  rendering or additional event listeners.
- Existing service-worker exclusions for authenticated pages, API responses and
  third-party player data are retained. Only CourtIQ static caches are refreshed.
- No identity-provider, database, payment, environment or production settings
  are changed by this branding work.

Source/asset regression tests live in `tests/brand-assets.test.mjs`. Browser QA
uses local sample-only routes and checks light/dark switching and phone-width
overflow. Local tests do not establish authenticated production behavior or
successful installation onto a physical phone. Production release is separate.

### Verified locally on 2026-10-09

- 198 tests passed, including 6 branding/export regressions.
- Lint: 0 errors, 2 pre-existing hook-dependency warnings elsewhere.
- Production dependency audit: 0 vulnerabilities; no dependencies changed.
- Isolated optimized production build completed successfully, with dummy sample
  backend configuration and no production credentials copied into the build.
- 390-pixel browser checks: landing and real login components loaded the correct
  SVG artwork without horizontal overflow. Skills preview switched from the
  white/orange to the charcoal/orange wordmark immediately, then back.
- No warnings/errors captured in the tested login/skills browser tabs.
- Ordinary/maskable/Apple icon dimensions and maskable safe-area pixels passed.
- Square/story report SVGs rasterized to 1080×1080 and 1080×1920 without external
  image requests. Provider-backed player data and physical-device installation
  were not exercised.

Proof screenshots saved locally in Downloads as
`courtiq-brand-v2-review-2026-10-09.png`,
`courtiq-brand-login-phone-2026-10-09.png`, and
`courtiq-brand-skills-phone-2026-10-09.png`.
