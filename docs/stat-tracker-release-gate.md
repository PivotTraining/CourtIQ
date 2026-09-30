# CourtIQ stat tracker — September 30, 2026

Later checkpoint: [recovery-and-billing-release-gate.md](recovery-and-billing-release-gate.md)
records subsequent reliability work and approved sample-browser testing. The
46-test/no-browser-approval statements below describe the earlier checkpoint.

## Implementation

- Tracker uses the Shell's actual persisted light/dark preference, with an in-tracker toggle. Storage restrictions do not crash the theme control.
- Court size is constrained by both width and viewport height. Desktop uses separate court/control columns; short screens retain a scrollable content area rather than clipping inputs. Touch targets stay at least 44px, zone targets are spaced apart, and a named location selector offers another accessible path.
- Light mode uses neutral surfaces and dark stat text. Dark mode uses distinct neon stat colors, illuminated borders and a dark court. Changes are scoped to the tracker.
- Existing checked save/undo/end-session behavior and synchronous pending-write guard remain intact. Inputs visibly lock while saving. Minutes increments and decrements can both be undone.
- The recap, session history and expanded game log share one player performance report and CSV export: traditional box score, shooting splits with attempts, eFG%, estimated TS%, AST/TO, shot distribution and game points per 36 when actual minutes were entered.
- Free throws are excluded from FG attempts and counted once in points. Reopened reports use FT shot logs first, with fallback for older summary-only records. Game-log aggregate FG% uses total makes/attempts, includes 0%-shooting games, and is not a simple average of percentages. The Sessions FG ring also excludes FT attempts.
- Season/monthly per-game averages use game records only, excluding practice scoring. Existing intelligence calculations share the corrected point/FG sources, and game coaching insights require at least three games. These repairs do not validate the existing heuristic 0–99 skill-rating model as a professional rating.
- Missing denominators show unavailable metrics, not invented zero percentages. Unknown zones are excluded and flagged. EFF is explicitly not PER; per-36 is not a forecast; no team usage, ratings or plus/minus are inferred from player-only data. Small-sample and manually recorded-data caveats remain visible.

Definitions checked against the [NBA statistics glossary](https://www.nba.com/stats/help/glossary) and [Hudl basketball glossary](https://static.hudl.com/craft/support/glossaries/Hudl-Instat-Basketball-Glossary_2022-11-23.pdf?mtime=20231010135318).

## Verification and remaining release gates

Final local verification: all 46 tests pass, lint passes, production build passes with clearly fake CI environment values, and the diff has no whitespace errors.

46 automated tests cover statistics, live-versus-reopened report consistency, legacy FT summaries, zero denominators, export contents, undo and save locks, actual server-rendered tracker/report controls and scoped CSS layout contracts, alongside the earlier safety suite. The season/monthly regression test proves practice scoring cannot inflate per-game averages and includes a zero-make game in FG%. Server rendering and CSS assertions are not screenshots or proof of real browser sizing.

Browser permission for local visual verification was requested again for this new UI task; no approval has been received at this checkpoint. Phone/desktop/landscape/zoom screenshots, interactive theme/zone/stat/CSV checks and authenticated save/reload remain mandatory before public release. Check at least 320×568, 390×844, 844×390 and 1440×900, plus 200% zoom. Verify all inputs remain reachable on short screens.

No migration is needed for these report/display changes; they use existing shot logs and game_stats fields. The earlier ownership migration and live persistence prerequisites in [core-repair-release-gate.md](core-repair-release-gate.md) still apply. No schema, live records, production environment, public domain or subscription plan was changed.

The current dependency audit meets the CI moderate-or-higher gate but reports one low-severity DOMPurify advisory in the existing dependency tree. The prior audit's zero-findings snapshot is no longer current. This tracker change does not alter dependencies.
