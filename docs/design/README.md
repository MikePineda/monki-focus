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

Active accent: **Deep teal-green** (`teal`). Recommended: **deep teal-green** (`teal`). Alternative: **warm ink-amber** (`amber`).

Both options pass every contrast rule in both themes. Teal is recommended because amber sits almost on top of `status-warning`: accent links and warning icons would look identical, and fixing that means moving warning toward orange, which then crowds `status-critical`. Teal stays clear of every status hue and of the ink-blue focus-level ramp, and it reads as "calm instrument" rather than "alert".

| Token          | Deep teal-green light | Deep teal-green dark | Warm ink-amber light | Warm ink-amber dark |
| -------------- | --------------------- | -------------------- | -------------------- | ------------------- |
| `accent`       | `#076961`             | `#6ec7b6`            | `#8f5518`            | `#eeb563`           |
| `accent-hover` | `#01574f`             | `#8fdccc`            | `#77450c`            | `#f9cc87`           |
| `accent-ink`   | `#ffffff`             | `#0b0f0f`            | `#ffffff`            | `#0b0f0f`           |
| `accent-soft`  | `#dbf6f1`             | `#10322e`            | `#fdeed9`            | `#3d2914`           |

| Option                                        | Theme | `accent` on worst surface | `accent-ink` on `accent` | `accent` on `accent-soft` | Closest status/level (ΔE) | Contrast rules | Separation (ΔE ≥ 9) |
| --------------------------------------------- | ----- | ------------------------- | ------------------------ | ------------------------- | ------------------------- | -------------- | ------------------- |
| Deep teal-green (`teal`, active, recommended) | light | 5.81:1                    | 6.56:1                   | 5.77:1                    | `level-3` 9.4             | PASS           | PASS                |
| Deep teal-green (`teal`, active, recommended) | dark  | 8.08:1                    | 9.65:1                   | 6.92:1                    | `status-good` 10.7        | PASS           | PASS                |
| Warm ink-amber (`amber`)                      | light | 5.35:1                    | 6.03:1                   | 5.29:1                    | `status-warning` 4.3      | PASS           | FAIL                |
| Warm ink-amber (`amber`)                      | dark  | 8.79:1                    | 10.49:1                  | 7.49:1                    | `status-warning` 2.9      | PASS           | FAIL                |

### How to switch the accent

1. In `packages/design-tokens/src/tokens.source.mjs`, change the one value `export const ACCENT = 'teal'` to another key of `accents` (today `'amber'`).
2. In `packages/design-tokens`, run `npm run build && npm run docs`. Every file in `dist/` and both files in `docs/design/` are regenerated; nothing else is edited by hand.
3. Run `npm test`. `switching_accent_source_rebuilds_all_outputs` already proves that the alternative rebuilds every output and passes every contrast rule. With amber, `accent_is_never_a_status_or_level_colour` fails on purpose against `status-warning` until that token moves toward orange.

## Tokens (light → dark)

| Token             | Light       | Dark        | Use                                                                                                                           |
| ----------------- | ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `surface-0`       | `#f8fbfa`   | `#0b0f0f`   | Page background: interstitial, stats page, dashboard, Android overlay.                                                        |
| `surface-1`       | `#ffffff`   | `#131717`   | Raised: extension popup body, menu bar panel, overlay card, toast, text field, table header band.                             |
| `surface-2`       | `#eef2f2`   | `#1c2221`   | Sunken fills: segmented-control track, empty heatmap cell, neutral notice banner, pressed row, skeleton.                      |
| `scrim`           | `#171d1d8c` | `#000000a6` | Dims the page behind the timeout overlay card.                                                                                |
| `ink-1`           | `#171d1d`   | `#e9eeee`   | Primary text and icons on surface-0/1/2; countdown digits; ink-filled buttons (label in surface-0).                           |
| `ink-2`           | `#495251`   | `#b7c0bf`   | Secondary text on surface-0/1/2: field labels, row meta, axis titles, the "why" line.                                         |
| `ink-3`           | `#636d6c`   | `#939e9d`   | Muted text on surface-0/1/2: context line, captions, placeholders, tick labels, disabled labels.                              |
| `line`            | `#dee3e3`   | `#292f2f`   | 1px hairline dividers between rows and sections.                                                                              |
| `line-strong`     | `#7e8786`   | `#666e6d`   | Boundaries that must be seen (>=3:1): text-field border, secondary-button border, segmented outline, progress-line track end. |
| `accent`          | `#076961`   | `#6ec7b6`   | The single chromatic accent.                                                                                                  |
| `accent-hover`    | `#01574f`   | `#8fdccc`   | Hover/pressed state of accent fills and links.                                                                                |
| `accent-ink`      | `#ffffff`   | `#0b0f0f`   | Label and icon on an accent fill (the Close / Leave button).                                                                  |
| `accent-soft`     | `#dbf6f1`   | `#10322e`   | Selection wash behind accent text: selected 5/10/15 segment, selected nav item.                                               |
| `focus`           | `#076961`   | `#6ec7b6`   | Keyboard focus ring: 2px solid, 2px offset in the surface colour.                                                             |
| `level-0`         | `#8db5e0`   | `#305275`   | Distracting (0) on marks only: day stacked-bar segment, heatmap cell, 8px legend key.                                         |
| `level-1`         | `#6595c6`   | `#446f9b`   | Personal (25) on marks only: day stacked-bar segment, heatmap cell, 8px legend key.                                           |
| `level-2`         | `#4577a8`   | `#5e8dbe`   | Neutral (50) on marks only: day stacked-bar segment, heatmap cell, 8px legend key.                                            |
| `level-3`         | `#2b5987`   | `#7eacdc`   | Other work (75) on marks only: day stacked-bar segment, heatmap cell, 8px legend key.                                         |
| `level-4`         | `#153e64`   | `#a5ccf4`   | Focus (100) on marks only: day stacked-bar segment, heatmap cell, 8px legend key.                                             |
| `mark-neutral`    | `#5c6665`   | `#96a1a0`   | Single-series marks: 7-day Pulse bars, top-sites minute bars.                                                                 |
| `mark-muted`      | `#c2c9c8`   | `#393e3e`   | De-emphasised marks: uncategorised time, days without data.                                                                   |
| `gridline`        | `#e6ebea`   | `#1f2423`   | Chart gridlines: 1px solid, horizontal only.                                                                                  |
| `baseline`        | `#b5bcbb`   | `#464c4b`   | Chart baseline / axis rule: 1px solid.                                                                                        |
| `status-good`     | `#3f7a28`   | `#8cd472`   | Success icon (circle-check) beside an ink label: "Connector installed".                                                       |
| `status-warning`  | `#906405`   | `#f1bf5b`   | Warning icon (triangle-alert) beside an ink label: "No access in private windows".                                            |
| `status-critical` | `#b63b35`   | `#f3827a`   | Errors only: icon, field-error text, destructive-action label/border.                                                         |

### Type

Web clients use `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. The native apps use the system face by default (pending the maintainer's decision); the generated styles accept another family.

| Style         | Size / line | Weight | Tracking | Figures      | Use                                                                                      |
| ------------- | ----------- | ------ | -------- | ------------ | ---------------------------------------------------------------------------------------- |
| `countdown`   | 96 / 96     | 500    | −0.02em  | tabular      | Pause countdown and emergency wait. 72/72 on screens under 600px tall (Android overlay). |
| `display`     | 40 / 48     | 500    | −0.02em  | proportional | The one hero per view: Pulse on the stats page and dashboard.                            |
| `stat`        | 32 / 40     | 500    | −0.015em | tabular      | Pulse in the popup and menu bar; guardian summary figures.                               |
| `title`       | 24 / 32     | 600    | −0.01em  | proportional | Screen titles, "What are you here for?", timeout card title.                             |
| `heading`     | 18 / 24     | 600    | −0.005em | proportional | Section, card and chart titles.                                                          |
| `body`        | 16 / 24     | 400    | 0        | proportional | Running text, input values, the "why" line.                                              |
| `body-strong` | 16 / 24     | 500    | 0        | proportional | Button labels.                                                                           |
| `body-sm`     | 14 / 20     | 400    | 0        | proportional | Dense surfaces only: popup, menu bar panel, table rows, banners, toasts.                 |
| `numeric`     | 14 / 20     | 500    | 0        | tabular      | Every column of numbers, mm:ss timers, counts.                                           |
| `label`       | 13 / 16     | 500    | +0.01em  | tabular      | Field labels, segmented options, legend items, nav items, context line.                  |
| `caption`     | 12 / 16     | 400    | +0.01em  | tabular      | Helper text, axis ticks, footnotes, level line.                                          |

### Spacing, sizing and radius

Values are px on the web, dp on Android and points on macOS.

| Token         | Value  | Use                                                            |
| ------------- | ------ | -------------------------------------------------------------- |
| `space-xs`    | 4px    | Icon-to-label gap; half step.                                  |
| `space-sm`    | 8px    | Between related controls.                                      |
| `space-md`    | 16px   | Side gutter; header-to-content.                                |
| `space-lg`    | 24px   | Between groups inside a section; card padding.                 |
| `space-xl`    | 32px   | Between sections.                                              |
| `space-2xl`   | 48px   | Interstitial vertical rhythm between blocks.                   |
| `space-3xl`   | 64px   | Top offset of the interstitial column.                         |
| `row`         | 56px   | List row height.                                               |
| `row-compact` | 44px   | Table and popup row height.                                    |
| `tap-min`     | 44px   | Minimum hit area.                                              |
| `tap`         | 48px   | Inline buttons, segmented control.                             |
| `tap-lg`      | 56px   | The Close button; bottom primary button.                       |
| `column-max`  | 560px  | Interstitial and timeout card column.                          |
| `popup-width` | 360px  | Extension popup width.                                         |
| `panel-width` | 340px  | macOS menu bar panel width.                                    |
| `radius-sm`   | 4px    | Bar data-ends, heatmap cells, checkbox, segmented thumb inset. |
| `radius-md`   | 8px    | Buttons, fields, segmented control, toasts.                    |
| `radius-lg`   | 12px   | Cards, overlay card, banners.                                  |
| `radius-xl`   | 16px   | Android bottom sheets (top corners) only.                      |
| `radius-full` | 9999px | Progress-line ends and 8px legend dots only.                   |

### Motion and elevation

| Token             | Value                                                          | Use                                                                |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `duration-fast`   | 150ms                                                          | Toasts, segment changes, hover.                                    |
| `duration-base`   | 200ms                                                          | Overlay card and sheet enter.                                      |
| `breath-phase`    | 4000ms                                                         | Breath pause: 4s expand, 4s contract. Static under reduced motion. |
| `easing-standard` | `cubic-bezier(0.2, 0, 0, 1)`                                   | Every transition.                                                  |
| `elevation-0`     | `none`                                                         | Page, lists, charts.                                               |
| `elevation-1`     | `none`                                                         | surface-1 + 1px line: fields, popup sections that need a frame.    |
| `elevation-2`     | light `0 1px 2px #171d1d0f, 0 8px 24px #171d1d14`, dark `none` | Floating only: timeout overlay card, toast, tooltip.               |

## Validation

The draft's check scripts are ported into Vitest specs (no script is shelled out), so `npm test` in `packages/design-tokens` is the validator. Results for the active accent:

| Check                                               | Test                                                         | Light     | Dark      |
| --------------------------------------------------- | ------------------------------------------------------------ | --------- | --------- |
| Text ≥ 4.5:1                                        | `every_text_token_meets_4_5_contrast_in_both_themes`         | PASS (21) | PASS (21) |
| Focus ring, boundaries, icons, marks ≥ 3:1          | `focus_border_icon_tokens_meet_3_to_1`                       | PASS (14) | PASS (14) |
| Level ramp: monotone, ΔL ≥ 0.06, end ≥ 2:1, one hue | `level_ramp_is_monotonic_and_distinguishable_in_both_themes` | PASS (18) | PASS (18) |
| Accent vs status and level ΔE ≥ 9                   | `accent_is_never_a_status_or_level_colour`                   | PASS (8)  | PASS (8)  |
| Material on-X / X ≥ 4.5:1                           | `every_material_on_role_meets_4_5_contrast_in_both_themes`   | PASS (18) | PASS (18) |

The categorical-palette check is not run: monki-focus has no categorical series. The only multi-colour encoding is the ordinal focus-level ramp. Decorative tokens (`line`, `gridline`, `baseline`, `mark-muted`) are reported, not enforced. ΔE is Euclidean OKLab distance × 100.

<details>
<summary>WCAG pairs, light theme</summary>

| Token                       | On                       | Ratio | Min | Kind                                           | Result |
| --------------------------- | ------------------------ | ----- | --- | ---------------------------------------------- | ------ |
| `ink-1` `#171d1d`           | `surface-0` `#f8fbfa`    | 16.40 | 4.5 | text (primary text)                            | PASS   |
| `ink-1` `#171d1d`           | `surface-1` `#ffffff`    | 17.07 | 4.5 | text (primary text)                            | PASS   |
| `ink-1` `#171d1d`           | `surface-2` `#eef2f2`    | 15.14 | 4.5 | text (primary text)                            | PASS   |
| `ink-2` `#495251`           | `surface-0` `#f8fbfa`    | 7.73  | 4.5 | text (secondary text)                          | PASS   |
| `ink-2` `#495251`           | `surface-1` `#ffffff`    | 8.05  | 4.5 | text (secondary text)                          | PASS   |
| `ink-2` `#495251`           | `surface-2` `#eef2f2`    | 7.14  | 4.5 | text (secondary text)                          | PASS   |
| `ink-3` `#636d6c`           | `surface-0` `#f8fbfa`    | 5.13  | 4.5 | text (muted text)                              | PASS   |
| `ink-3` `#636d6c`           | `surface-1` `#ffffff`    | 5.34  | 4.5 | text (muted text)                              | PASS   |
| `ink-3` `#636d6c`           | `surface-2` `#eef2f2`    | 4.73  | 4.5 | text (muted text)                              | PASS   |
| `surface-0` `#f8fbfa`       | `ink-1` `#171d1d`        | 16.40 | 4.5 | text (ink button label)                        | PASS   |
| `accent` `#076961`          | `surface-0` `#f8fbfa`    | 6.30  | 4.5 | text (link, selected segment)                  | PASS   |
| `accent` `#076961`          | `surface-1` `#ffffff`    | 6.56  | 4.5 | text (link, selected segment)                  | PASS   |
| `accent` `#076961`          | `surface-2` `#eef2f2`    | 5.81  | 4.5 | text (link, selected segment)                  | PASS   |
| `accent` `#076961`          | `accent-soft` `#dbf6f1`  | 5.77  | 4.5 | text (link, selected segment)                  | PASS   |
| `accent-hover` `#01574f`    | `surface-0` `#f8fbfa`    | 8.14  | 4.5 | text (link hover)                              | PASS   |
| `accent-hover` `#01574f`    | `surface-1` `#ffffff`    | 8.48  | 4.5 | text (link hover)                              | PASS   |
| `accent-ink` `#ffffff`      | `accent` `#076961`       | 6.56  | 4.5 | text (Close label)                             | PASS   |
| `accent-ink` `#ffffff`      | `accent-hover` `#01574f` | 8.48  | 4.5 | text (Close label)                             | PASS   |
| `status-critical` `#b63b35` | `surface-0` `#f8fbfa`    | 5.50  | 4.5 | text (field error)                             | PASS   |
| `status-critical` `#b63b35` | `surface-1` `#ffffff`    | 5.73  | 4.5 | text (field error)                             | PASS   |
| `status-critical` `#b63b35` | `surface-2` `#eef2f2`    | 5.08  | 4.5 | text (field error)                             | PASS   |
| `focus` `#076961`           | `surface-0` `#f8fbfa`    | 6.30  | 3   | non-text (focus ring)                          | PASS   |
| `focus` `#076961`           | `surface-1` `#ffffff`    | 6.56  | 3   | non-text (focus ring)                          | PASS   |
| `focus` `#076961`           | `surface-2` `#eef2f2`    | 5.81  | 3   | non-text (focus ring)                          | PASS   |
| `line-strong` `#7e8786`     | `surface-0` `#f8fbfa`    | 3.54  | 3   | non-text (UI boundary)                         | PASS   |
| `line-strong` `#7e8786`     | `surface-1` `#ffffff`    | 3.69  | 3   | non-text (UI boundary)                         | PASS   |
| `line-strong` `#7e8786`     | `surface-2` `#eef2f2`    | 3.27  | 3   | non-text (UI boundary)                         | PASS   |
| `status-good` `#3f7a28`     | `surface-0` `#f8fbfa`    | 5.01  | 3   | non-text (status icon)                         | PASS   |
| `status-good` `#3f7a28`     | `surface-1` `#ffffff`    | 5.22  | 3   | non-text (status icon)                         | PASS   |
| `status-good` `#3f7a28`     | `surface-2` `#eef2f2`    | 4.62  | 3   | non-text (status icon)                         | PASS   |
| `status-warning` `#906405`  | `surface-0` `#f8fbfa`    | 5.03  | 3   | non-text (status icon)                         | PASS   |
| `status-warning` `#906405`  | `surface-1` `#ffffff`    | 5.24  | 3   | non-text (status icon)                         | PASS   |
| `status-warning` `#906405`  | `surface-2` `#eef2f2`    | 4.64  | 3   | non-text (status icon)                         | PASS   |
| `mark-neutral` `#5c6665`    | `surface-0` `#f8fbfa`    | 5.69  | 3   | non-text (single-series mark)                  | PASS   |
| `mark-neutral` `#5c6665`    | `surface-1` `#ffffff`    | 5.93  | 3   | non-text (single-series mark)                  | PASS   |
| `level-0` `#8db5e0`         | `surface-0` `#f8fbfa`    | 2.05  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-0` `#8db5e0`         | `surface-1` `#ffffff`    | 2.14  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-1` `#6595c6`         | `surface-0` `#f8fbfa`    | 3.03  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-1` `#6595c6`         | `surface-1` `#ffffff`    | 3.15  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-2` `#4577a8`         | `surface-0` `#f8fbfa`    | 4.53  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-2` `#4577a8`         | `surface-1` `#ffffff`    | 4.71  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-3` `#2b5987`         | `surface-0` `#f8fbfa`    | 7.00  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-3` `#2b5987`         | `surface-1` `#ffffff`    | 7.29  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-4` `#153e64`         | `surface-0` `#f8fbfa`    | 10.59 | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-4` `#153e64`         | `surface-1` `#ffffff`    | 11.02 | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `baseline` `#b5bcbb`        | `surface-0` `#f8fbfa`    | 1.85  | -   | decorative (axis rule)                         | INFO   |
| `baseline` `#b5bcbb`        | `surface-1` `#ffffff`    | 1.93  | -   | decorative (axis rule)                         | INFO   |
| `mark-muted` `#c2c9c8`      | `surface-0` `#f8fbfa`    | 1.62  | -   | decorative (labelled mark)                     | INFO   |
| `mark-muted` `#c2c9c8`      | `surface-1` `#ffffff`    | 1.68  | -   | decorative (labelled mark)                     | INFO   |
| `line` `#dee3e3`            | `surface-0` `#f8fbfa`    | 1.24  | -   | decorative (hairline)                          | INFO   |
| `line` `#dee3e3`            | `surface-1` `#ffffff`    | 1.30  | -   | decorative (hairline)                          | INFO   |
| `gridline` `#e6ebea`        | `surface-0` `#f8fbfa`    | 1.16  | -   | decorative (gridline)                          | INFO   |

</details>

<details>
<summary>WCAG pairs, dark theme</summary>

| Token                       | On                       | Ratio | Min | Kind                                           | Result |
| --------------------------- | ------------------------ | ----- | --- | ---------------------------------------------- | ------ |
| `ink-1` `#e9eeee`           | `surface-0` `#0b0f0f`    | 16.46 | 4.5 | text (primary text)                            | PASS   |
| `ink-1` `#e9eeee`           | `surface-1` `#131717`    | 15.42 | 4.5 | text (primary text)                            | PASS   |
| `ink-1` `#e9eeee`           | `surface-2` `#1c2221`    | 13.79 | 4.5 | text (primary text)                            | PASS   |
| `ink-2` `#b7c0bf`           | `surface-0` `#0b0f0f`    | 10.38 | 4.5 | text (secondary text)                          | PASS   |
| `ink-2` `#b7c0bf`           | `surface-1` `#131717`    | 9.72  | 4.5 | text (secondary text)                          | PASS   |
| `ink-2` `#b7c0bf`           | `surface-2` `#1c2221`    | 8.70  | 4.5 | text (secondary text)                          | PASS   |
| `ink-3` `#939e9d`           | `surface-0` `#0b0f0f`    | 6.99  | 4.5 | text (muted text)                              | PASS   |
| `ink-3` `#939e9d`           | `surface-1` `#131717`    | 6.55  | 4.5 | text (muted text)                              | PASS   |
| `ink-3` `#939e9d`           | `surface-2` `#1c2221`    | 5.86  | 4.5 | text (muted text)                              | PASS   |
| `surface-0` `#0b0f0f`       | `ink-1` `#e9eeee`        | 16.46 | 4.5 | text (ink button label)                        | PASS   |
| `accent` `#6ec7b6`          | `surface-0` `#0b0f0f`    | 9.65  | 4.5 | text (link, selected segment)                  | PASS   |
| `accent` `#6ec7b6`          | `surface-1` `#131717`    | 9.04  | 4.5 | text (link, selected segment)                  | PASS   |
| `accent` `#6ec7b6`          | `surface-2` `#1c2221`    | 8.08  | 4.5 | text (link, selected segment)                  | PASS   |
| `accent` `#6ec7b6`          | `accent-soft` `#10322e`  | 6.92  | 4.5 | text (link, selected segment)                  | PASS   |
| `accent-hover` `#8fdccc`    | `surface-0` `#0b0f0f`    | 12.19 | 4.5 | text (link hover)                              | PASS   |
| `accent-hover` `#8fdccc`    | `surface-1` `#131717`    | 11.42 | 4.5 | text (link hover)                              | PASS   |
| `accent-ink` `#0b0f0f`      | `accent` `#6ec7b6`       | 9.65  | 4.5 | text (Close label)                             | PASS   |
| `accent-ink` `#0b0f0f`      | `accent-hover` `#8fdccc` | 12.19 | 4.5 | text (Close label)                             | PASS   |
| `status-critical` `#f3827a` | `surface-0` `#0b0f0f`    | 7.60  | 4.5 | text (field error)                             | PASS   |
| `status-critical` `#f3827a` | `surface-1` `#131717`    | 7.13  | 4.5 | text (field error)                             | PASS   |
| `status-critical` `#f3827a` | `surface-2` `#1c2221`    | 6.37  | 4.5 | text (field error)                             | PASS   |
| `focus` `#6ec7b6`           | `surface-0` `#0b0f0f`    | 9.65  | 3   | non-text (focus ring)                          | PASS   |
| `focus` `#6ec7b6`           | `surface-1` `#131717`    | 9.04  | 3   | non-text (focus ring)                          | PASS   |
| `focus` `#6ec7b6`           | `surface-2` `#1c2221`    | 8.08  | 3   | non-text (focus ring)                          | PASS   |
| `line-strong` `#666e6d`     | `surface-0` `#0b0f0f`    | 3.69  | 3   | non-text (UI boundary)                         | PASS   |
| `line-strong` `#666e6d`     | `surface-1` `#131717`    | 3.45  | 3   | non-text (UI boundary)                         | PASS   |
| `line-strong` `#666e6d`     | `surface-2` `#1c2221`    | 3.09  | 3   | non-text (UI boundary)                         | PASS   |
| `status-good` `#8cd472`     | `surface-0` `#0b0f0f`    | 10.81 | 3   | non-text (status icon)                         | PASS   |
| `status-good` `#8cd472`     | `surface-1` `#131717`    | 10.13 | 3   | non-text (status icon)                         | PASS   |
| `status-good` `#8cd472`     | `surface-2` `#1c2221`    | 9.06  | 3   | non-text (status icon)                         | PASS   |
| `status-warning` `#f1bf5b`  | `surface-0` `#0b0f0f`    | 11.33 | 3   | non-text (status icon)                         | PASS   |
| `status-warning` `#f1bf5b`  | `surface-1` `#131717`    | 10.62 | 3   | non-text (status icon)                         | PASS   |
| `status-warning` `#f1bf5b`  | `surface-2` `#1c2221`    | 9.49  | 3   | non-text (status icon)                         | PASS   |
| `mark-neutral` `#96a1a0`    | `surface-0` `#0b0f0f`    | 7.25  | 3   | non-text (single-series mark)                  | PASS   |
| `mark-neutral` `#96a1a0`    | `surface-1` `#131717`    | 6.80  | 3   | non-text (single-series mark)                  | PASS   |
| `level-0` `#305275`         | `surface-0` `#0b0f0f`    | 2.38  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-0` `#305275`         | `surface-1` `#131717`    | 2.23  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-1` `#446f9b`         | `surface-0` `#0b0f0f`    | 3.67  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-1` `#446f9b`         | `surface-1` `#131717`    | 3.43  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-2` `#5e8dbe`         | `surface-0` `#0b0f0f`    | 5.53  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-2` `#5e8dbe`         | `surface-1` `#131717`    | 5.19  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-3` `#7eacdc`         | `surface-0` `#0b0f0f`    | 8.10  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-3` `#7eacdc`         | `surface-1` `#131717`    | 7.59  | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-4` `#a5ccf4`         | `surface-0` `#0b0f0f`    | 11.51 | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `level-4` `#a5ccf4`         | `surface-1` `#131717`    | 10.79 | 2   | ordinal (ordinal mark (legend + table relief)) | PASS   |
| `baseline` `#464c4b`        | `surface-0` `#0b0f0f`    | 2.20  | -   | decorative (axis rule)                         | INFO   |
| `baseline` `#464c4b`        | `surface-1` `#131717`    | 2.06  | -   | decorative (axis rule)                         | INFO   |
| `mark-muted` `#393e3e`      | `surface-0` `#0b0f0f`    | 1.77  | -   | decorative (labelled mark)                     | INFO   |
| `mark-muted` `#393e3e`      | `surface-1` `#131717`    | 1.66  | -   | decorative (labelled mark)                     | INFO   |
| `line` `#292f2f`            | `surface-0` `#0b0f0f`    | 1.42  | -   | decorative (hairline)                          | INFO   |
| `line` `#292f2f`            | `surface-1` `#131717`    | 1.33  | -   | decorative (hairline)                          | INFO   |
| `gridline` `#1f2423`        | `surface-0` `#0b0f0f`    | 1.23  | -   | decorative (gridline)                          | INFO   |

</details>

<details>
<summary>Material role pairs, both themes</summary>

| Text role                           | On role                             | Ratio | Result |
| ----------------------------------- | ----------------------------------- | ----- | ------ |
| on-background `#171d1d`             | background `#f8fbfa`                | 16.40 | PASS   |
| on-surface `#171d1d`                | surface `#f8fbfa`                   | 16.40 | PASS   |
| on-surface `#171d1d`                | surface-container-highest `#dee3e3` | 13.17 | PASS   |
| on-surface-variant `#495251`        | surface-variant `#eef2f2`           | 7.14  | PASS   |
| inverse-on-surface `#eef2f2`        | inverse-surface `#282f2f`           | 12.11 | PASS   |
| on-primary `#f8fbfa`                | primary `#171d1d`                   | 16.40 | PASS   |
| on-primary-container `#171d1d`      | primary-container `#eef2f2`         | 15.14 | PASS   |
| on-secondary `#f8fbfa`              | secondary `#495251`                 | 7.73  | PASS   |
| on-secondary-container `#171d1d`    | secondary-container `#eef2f2`       | 15.14 | PASS   |
| on-tertiary `#ffffff`               | tertiary `#076961`                  | 6.56  | PASS   |
| on-tertiary-container `#076961`     | tertiary-container `#dbf6f1`        | 5.77  | PASS   |
| on-error `#ffffff`                  | error `#b63b35`                     | 5.73  | PASS   |
| on-error-container `#862723`        | error-container `#feebe9`           | 7.85  | PASS   |
| on-primary-fixed `#171d1d`          | primary-fixed `#eef2f2`             | 15.14 | PASS   |
| on-primary-fixed-variant `#495251`  | primary-fixed `#eef2f2`             | 7.14  | PASS   |
| on-tertiary-fixed `#042824`         | tertiary-fixed `#dbf6f1`            | 13.84 | PASS   |
| on-tertiary-fixed `#042824`         | tertiary-fixed-dim `#a5ded6`        | 10.51 | PASS   |
| on-tertiary-fixed-variant `#076961` | tertiary-fixed `#dbf6f1`            | 5.77  | PASS   |

| Text role                           | On role                             | Ratio | Result |
| ----------------------------------- | ----------------------------------- | ----- | ------ |
| on-background `#e9eeee`             | background `#0b0f0f`                | 16.46 | PASS   |
| on-surface `#e9eeee`                | surface `#0b0f0f`                   | 16.46 | PASS   |
| on-surface `#e9eeee`                | surface-container-highest `#252a2a` | 12.42 | PASS   |
| on-surface-variant `#b7c0bf`        | surface-variant `#1c2221`           | 8.70  | PASS   |
| inverse-on-surface `#131717`        | inverse-surface `#e9eeee`           | 15.42 | PASS   |
| on-primary `#0b0f0f`                | primary `#e9eeee`                   | 16.46 | PASS   |
| on-primary-container `#e9eeee`      | primary-container `#1c2221`         | 13.79 | PASS   |
| on-secondary `#0b0f0f`              | secondary `#b7c0bf`                 | 10.38 | PASS   |
| on-secondary-container `#e9eeee`    | secondary-container `#1c2221`       | 13.79 | PASS   |
| on-tertiary `#0b0f0f`               | tertiary `#6ec7b6`                  | 9.65  | PASS   |
| on-tertiary-container `#6ec7b6`     | tertiary-container `#10322e`        | 6.92  | PASS   |
| on-error `#0b0f0f`                  | error `#f3827a`                     | 7.60  | PASS   |
| on-error-container `#fdc9c2`        | error-container `#421c18`           | 10.14 | PASS   |
| on-primary-fixed `#e9eeee`          | primary-fixed `#1c2221`             | 13.79 | PASS   |
| on-primary-fixed-variant `#b7c0bf`  | primary-fixed `#1c2221`             | 8.70  | PASS   |
| on-tertiary-fixed `#042824`         | tertiary-fixed `#dbf6f1`            | 13.84 | PASS   |
| on-tertiary-fixed `#042824`         | tertiary-fixed-dim `#a5ded6`        | 10.51 | PASS   |
| on-tertiary-fixed-variant `#076961` | tertiary-fixed `#dbf6f1`            | 5.77  | PASS   |

</details>

<details>
<summary>Focus-level ramp</summary>

| Theme | Surface     | Check              | Detail                             | Result |
| ----- | ----------- | ------------------ | ---------------------------------- | ------ |
| light | `surface-0` | lightness-monotone | steps read light to dark           | PASS   |
| light | `surface-0` | adjacent-delta-l   | smallest gap 0.098, min 0.06       | PASS   |
| light | `surface-0` | end-contrast       | level-0 #8db5e0 at 2.05:1, min 2:1 | PASS   |
| light | `surface-0` | single-hue         | hue spread 1.2°, max 10°           | PASS   |
| light | `surface-1` | lightness-monotone | steps read light to dark           | PASS   |
| light | `surface-1` | adjacent-delta-l   | smallest gap 0.098, min 0.06       | PASS   |
| light | `surface-1` | end-contrast       | level-0 #8db5e0 at 2.14:1, min 2:1 | PASS   |
| light | `surface-1` | single-hue         | hue spread 1.2°, max 10°           | PASS   |
| dark  | `surface-0` | lightness-monotone | steps read dark to light           | PASS   |
| dark  | `surface-0` | adjacent-delta-l   | smallest gap 0.100, min 0.06       | PASS   |
| dark  | `surface-0` | end-contrast       | level-0 #305275 at 2.38:1, min 2:1 | PASS   |
| dark  | `surface-0` | single-hue         | hue spread 1.1°, max 10°           | PASS   |
| dark  | `surface-1` | lightness-monotone | steps read dark to light           | PASS   |
| dark  | `surface-1` | adjacent-delta-l   | smallest gap 0.100, min 0.06       | PASS   |
| dark  | `surface-1` | end-contrast       | level-0 #305275 at 2.23:1, min 2:1 | PASS   |
| dark  | `surface-1` | single-hue         | hue spread 1.1°, max 10°           | PASS   |

</details>

<details>
<summary>Accent separation from status and level colours</summary>

| Theme | Accent    | Versus                      | ΔE   | Result |
| ----- | --------- | --------------------------- | ---- | ------ |
| light | `#076961` | `level-0` `#8db5e0`         | 30.2 | PASS   |
| light | `#076961` | `level-1` `#6595c6`         | 20.7 | PASS   |
| light | `#076961` | `level-2` `#4577a8`         | 12.7 | PASS   |
| light | `#076961` | `level-3` `#2b5987`         | 9.4  | PASS   |
| light | `#076961` | `level-4` `#153e64`         | 14.2 | PASS   |
| light | `#076961` | `status-good` `#3f7a28`     | 10.9 | PASS   |
| light | `#076961` | `status-warning` `#906405`  | 16.9 | PASS   |
| light | `#076961` | `status-critical` `#b63b35` | 24.5 | PASS   |
| dark  | `#6ec7b6` | `level-0` `#305275`         | 35.3 | PASS   |
| dark  | `#6ec7b6` | `level-1` `#446f9b`         | 26.0 | PASS   |
| dark  | `#6ec7b6` | `level-2` `#5e8dbe`         | 17.4 | PASS   |
| dark  | `#6ec7b6` | `level-3` `#7eacdc`         | 10.8 | PASS   |
| dark  | `#6ec7b6` | `level-4` `#a5ccf4`         | 11.1 | PASS   |
| dark  | `#6ec7b6` | `status-good` `#8cd472`     | 10.7 | PASS   |
| dark  | `#6ec7b6` | `status-warning` `#f1bf5b`  | 17.8 | PASS   |
| dark  | `#6ec7b6` | `status-critical` `#f3827a` | 22.8 | PASS   |

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
