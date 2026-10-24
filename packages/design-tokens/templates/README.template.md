# monki-focus design system

> Status: **draft pending maintainer approval of the accent.** The visual source is the design system draft (private, pending maintainer approval). Nothing here is final until the maintainer approves the accent and the two key screens (the intention interstitial and the extension popup). A colour change now costs minutes; after the UI kits land it costs days.

This file and [DESIGN.md](DESIGN.md) are generated: every value, table and check result below comes from `packages/design-tokens/src/tokens.source.mjs` through `npm run docs` in `packages/design-tokens`. Do not edit them by hand; a test fails when they drift.

## Files

| Path                                           | What                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `docs/design/DESIGN.md`                        | Stitch-format design spec: front matter, both themes, validation, components, charts, do's and don'ts.                         |
| `docs/design/README.md`                        | This file: token tables, validator results, accent switch, platform wiring.                                                    |
| `packages/design-tokens/src/tokens.source.mjs` | The single source: every colour in OKLCH (or a reference to another token), the accent options, type, spacing, radius, motion. |
| `packages/design-tokens/dist/`                 | Generated, committed outputs for every client (below).                                                                         |
| `packages/design-tokens/tests/`                | The validators, as Vitest specs.                                                                                               |

## Accent

Active accent: **{{accent-label}}** (`{{accent-key}}`). Recommended: **deep teal-green** (`teal`). Alternative: **warm ink-amber** (`amber`).

Both options pass every contrast rule in both themes. Teal is recommended because amber sits almost on top of `status-warning`: accent links and warning icons would look identical, and fixing that means moving warning toward orange, which then crowds `status-critical`. Teal stays clear of every status hue and of the ink-blue focus-level ramp, and it reads as "calm instrument" rather than "alert".

<!-- @accent-values -->

<!-- @accent-checks -->

### How to switch the accent

1. In `packages/design-tokens/src/tokens.source.mjs`, change the one value `export const ACCENT = 'teal'` to another key of `accents` (today `'amber'`).
2. In `packages/design-tokens`, run `npm run build && npm run docs`. Every file in `dist/` and both files in `docs/design/` are regenerated; nothing else is edited by hand.
3. Run `npm test`. `switching_accent_source_rebuilds_all_outputs` already proves that the alternative rebuilds every output and passes every contrast rule. With amber, `accent_is_never_a_status_or_level_colour` fails on purpose against `status-warning` until that token moves toward orange.

## Tokens (light → dark)

<!-- @token-table -->

### Type

Web clients use `{{font-stack}}`. The native apps use the system face by default (pending the maintainer's decision); the generated styles accept another family.

<!-- @typography-table -->

### Spacing, sizing and radius

Values are px on the web, dp on Android and points on macOS.

<!-- @scale-table -->

### Motion and elevation

<!-- @motion-table -->

## Validation

The draft's check scripts are ported into Vitest specs (no script is shelled out), so `npm test` in `packages/design-tokens` is the validator. Results for the active accent:

<!-- @validation-summary -->

The categorical-palette check is not run: monki-focus has no categorical series. The only multi-colour encoding is the ordinal focus-level ramp. Decorative tokens (`line`, `gridline`, `baseline`, `mark-muted`) are reported, not enforced. ΔE is Euclidean OKLab distance × 100.

<details>
<summary>WCAG pairs, light theme</summary>

<!-- @contrast-light -->

</details>

<details>
<summary>WCAG pairs, dark theme</summary>

<!-- @contrast-dark -->

</details>

<details>
<summary>Material role pairs, both themes</summary>

<!-- @material-light -->

<!-- @material-dark -->

</details>

<details>
<summary>Focus-level ramp</summary>

<!-- @ramp-detail -->

</details>

<details>
<summary>Accent separation from status and level colours</summary>

<!-- @separation-detail -->

</details>

## How each platform consumes the outputs

| Client                                  | File                 | How                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extension (WXT) and dashboard (Angular) | `dist/tokens.css`    | Import `@monki-focus/design-tokens/tokens.css` once (the extension also injects it into each shadow root, where `:host` picks it up). Components use `var(--mf-surface-0)`, `var(--mf-space-md)`, `var(--mf-type-body-size)`. Set `data-theme="light"` or `"dark"` on the root or host to override the system theme.                                                 |
| Any JS/TS code                          | `dist/tokens.json`   | `import tokens from '@monki-focus/design-tokens/tokens.json'` for charts or canvas code that cannot read CSS variables.                                                                                                                                                                                                                                              |
| Android (`:core-ui`)                    | `dist/android/*.kt`  | Add `packages/design-tokens/dist/android` as a Kotlin source directory of `:core-ui` (package `dev.monkifocus.android.core.ui.theme`) and exclude it from Spotless. The theme passes `MonkiLightColorScheme` / `MonkiDarkColorScheme` to `MaterialTheme` and provides `LocalMonkiColors`; the `color_tokens_match_design_tokens_json` test reads `dist/tokens.json`. |
| macOS (SwiftUI)                         | `dist/macos/*.swift` | List `packages/design-tokens/dist/macos` as a source folder of the app target in `macos/project.yml` (XcodeGen). Views use `Color.monkiSurface0`, `MonkiTypography.body.font()`, `MonkiSpacing.spaceMd`; light and dark follow the system appearance with no asset catalog.                                                                                          |

## Rationale

- Light by default with a separately tuned dark theme: the interstitial interrupts a browsing session, and a bright neutral page reads as a pause, not a punishment; dark mode keeps the same contrast floors with its own steps.
- One accent, and its only fill is the exit. Leaving should be the easiest move, so the leave/close button is the largest, earliest, focused, accent-filled control; continuing is a quiet secondary button that needs a choice.
- The focus-level ramp is one ink-blue hue instead of a red-to-blue diverging scale. Red for "Distracting" would turn a measurement into a verdict; a single hue keeps the order readable without guilt and stays clear of the accent.
- Bypass and guardian notices are neutral `surface-2` banners with an `info` icon. They state a fact you agreed to; they are not alarms.
- Neutrals lean slightly toward the accent hue (OKLCH h 190, C ≤ 0.012) so greys look chosen. No cream, no serif, no purple, no gradients.
- Tabular figures on every timer and number column, because countdowns that jitter feel anxious. The progress line is 1px with no rings: circular timers read as a game.

## Decisions recorded with this draft

- The outputs in `dist/` are committed (the package `.gitignore` re-includes them) so the native builds read them by relative path without Node; `generated_outputs_are_up_to_date` keeps them honest.
- Every CSS custom property is prefixed `--mf-` (`--mf-surface-0`) because the extension injects its styles into third-party pages; DESIGN.md and the tables name tokens without the prefix, as the mocks do.
- The Compose schemes omit the Material `*-fixed` roles and `scrim` (not parameters of the stable builders, or applied with their own alpha by Material components); they stay in `tokens.json`, and the scrim lives in `MonkiColors`.
- Native apps default to the system face, per the maintainer's pending default; Inter stays the web face.
- The accent-separation floor is ΔE 9, between the recommended teal's closest pair (9.4) and amber's collision with `status-warning` (4.3 light, 2.9 dark).

## Open questions for the maintainer

1. Accent: teal (recommended) or amber? If amber, `status-warning` moves toward orange in a follow-up.
2. Native typography: Inter bundled in the Android and macOS apps, or the system face there (current default)?
3. Should the "Emergency access" link stay `ink-2` (deliberately quieter than accent links), as drawn?
4. The popup is drawn at 360 × 580 rather than about 540 to fit the private-window warning; drop the warning to a status-row icon if 540 is a hard limit.
5. Level ramp direction: in the light theme Distracting is the palest step and Focus the darkest. Is that the reading you want?
6. The heatmap bins Pulse into the five level bands so one ramp means one thing everywhere; confirm instead of a continuous scale.
