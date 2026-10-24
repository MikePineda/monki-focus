<!-- @front-matter -->

> Status: draft pending maintainer approval of the accent. Every value on this page is generated from `packages/design-tokens/src/tokens.source.mjs`; [README.md](README.md) has the full validator output and how to switch the accent.

## Brand & Style

monki-focus is an open-source, local-first anti-doomscroll toolkit: a Chromium MV3 extension, a native Android app, a native macOS menu-bar app and an optional web dashboard. It should feel like **a calm, quiet instrument that helps you choose**. It is not a productivity scoreboard, not a parental-control panel with red alarms, and never a generic AI-generated app or a dark-neon "productivity bro" tool.

The style is **neutral editorial**. Light surfaces are the default; the dark theme is designed separately with its own steps and its own validated data colours. Typography carries the hierarchy, hairlines separate content instead of boxes, and the only colour you notice is the one thing you can do.

Principles, in priority order:

1. **The exit is the easiest thing on screen.** On every gate the leave/close action is the largest control, wears the only accent fill, is enabled from the first second and takes initial focus. Continuing is always possible but always costs a sentence and a choice.
2. **Measure, never judge.** Numbers are stated plainly ("42 min today", "Pulse 56"). No red for distraction, no streaks, no praise, no shame. Distracting time is just the lightest step of a neutral ramp.
3. **One accent, for interaction.** The accent ({{accent-label-lower}}) marks what you can act on: the leave/close fill, links, the selected segment, the active nav item, the focus ring. It never colours a number, a chart mark or body copy.
4. **Two people at most, and only in words.** People are "you" and "your guardian" ("tú" and "tu guardián"). The UI never assumes a name. Guardian and bypass notices are neutral information, never alarms.
5. **Honest and inspectable.** Every chart has a table view. Every status has an icon and a word. Data stays on the device unless the person turns sync on, and the UI says so.

**Voice.** Bilingual from day one: Spanish (`es`) and English (`en`), same structure, separate catalogues. Sentence case everywhere, buttons included ("Cerrar pestaña", "Close tab"). Short declarative sentences, no exclamation marks, no emoji. Buttons state exactly what happens. Dates and times are locale-aware: Spanish uses 24-hour time and day-first short dates ("18:00", "sáb 25 oct"); English uses its locale default ("6:00 pm", "Sat 25 Oct"). Durations read "42 min", "4 h 12 min"; running timers read "06:42"; ordinals follow the locale ("3.ª visita", "3rd visit").

## Colors

All colours are semantic tokens. Components reference tokens only; a raw hex outside the token package is a bug. On the web every token is a CSS custom property prefixed `--mf-` (`--mf-surface-0`), because the extension injects its styles into third-party pages. Light values are the defaults on `:root` and `:host` (the extension's shadow roots); dark values apply under `[data-theme="dark"]` and under `prefers-color-scheme: dark` when no explicit theme is set. The front matter carries the light theme in Material role names for Stitch plus the semantic extras; the tables below are the full specification for both themes. `tokens.json` holds the same values as data for the CSS, Compose and SwiftUI generators.

Roles at a glance:

- **Surfaces** step by lightness in both themes, never by shadow. Neutrals lean very slightly toward the accent hue (OKLCH h≈190, C≤0.012) so the greys read as chosen rather than default.
- **Ink** has three steps; all three pass 4.5:1 on every surface in both themes.
- **Accent** is {{accent-label-lower}} (`{{hex:light:accent}}` light, `{{hex:dark:accent}}` dark). It fills exactly one control per screen, the leave/close action, with `accent-ink` on top ({{ratio:light:accent-ink:accent}} light, {{ratio:dark:accent-ink:accent}} dark). Every other primary button is ink (`ink-1` fill, `surface-0` label). `accent-soft` is the selection wash behind accent text.
- **Focus levels** (`level-0`…`level-4`) are one ink-blue hue (OKLCH h=250), stepped light→dark in the light theme and dark→light in the dark theme, validated as an ordinal ramp in both. Marks only: day stacked bar, heatmap cells, legend keys. Labels beside them stay in ink. Light `level-0` and `level-1` sit between 2:1 and 3:1 on the surface, so every level chart ships its legend and table view.
- **Status** (`good`, `warning`, `critical`) is reserved feedback: the icon wears the status colour, the label stays in ink. `status-critical` is the only red, also allowed as field-error text (≥4.5:1). Bypass and guardian notices are neutral (`surface-2`, `info` icon in `ink-2`).
- **Chart chrome.** `gridline` and `baseline` are solid hairlines. `mark-neutral` is the single-series mark colour (7-day Pulse). `mark-muted` is uncategorised time.

### Light theme

<!-- @light-table -->

### Dark theme

<!-- @dark-table -->

Material role mapping for the dark theme (for Stitch dark screens and Compose `darkColorScheme`). Primary is ink; the accent rides on `tertiary`:

<!-- @material-dark-table -->

### Accent options (maintainer's choice)

Each option swaps only the four accent tokens, `focus` and the two accent-derived Material fixed roles; everything else stays. The active option is the one `ACCENT` names in `tokens.source.mjs`. The warm ink-amber alternative passes every contrast rule, but it sits almost on top of `status-warning` (see the closest-colour column), so choosing it means warning icons and accent links would read as the same colour; if the maintainer picks amber, `status-warning` must move toward orange in a follow-up.

<!-- @accent-values -->

<!-- @accent-checks -->

### Validation

Every check below is a Vitest test in `packages/design-tokens/tests`; the full pair-by-pair tables are in [README.md](README.md).

<!-- @validation-summary -->

## Typography

One family on the web: **Inter** (variable, v4, OFL), self-hosted as woff2 in the extension and dashboard (no network font requests: the extension is local-first and CSP-locked). The native apps use the system face (Roboto on Android, SF Pro on macOS) by default until the maintainer decides; the generated Compose and SwiftUI styles take an optional family, so bundling Inter later is one argument. Weights 400, 500 and 600 only. Web fallback stack: `{{font-stack}}`. No display face, no serif, no monospace.

<!-- @typography-table -->

- **Tabular figures** on every countdown, timer and column of numbers (`font-variant-numeric: tabular-nums`; SwiftUI `.monospacedDigit()`; Compose `fontFeatureSettings = "tnum"`). Proportional figures only for the single `display` hero.
- Numbers align right in tables so digits line up. Keep running text to about 60 characters (`max-width: 48ch` on the interstitial). Headings use `text-wrap: balance`.

## Layout & Spacing

- **Grid.** 8px base with a 4px half step for icon-to-label gaps. Tokens: 4, 8, 16, 24, 32, 48, 64.
- **Interstitial and timeout.** Full page, `surface-0`, one centred column ≤ 560px, 72px below a 64px top bar, nothing from the visited site (no favicon, no colours). Blocks are separated by 32–48px of whitespace; a single hairline sits above the footer.
- **Extension popup.** 360 × 580 (Chrome caps popups at 600). 16px gutters, sections separated by 1px `line`, a 52px header and a 44px footer.
- **macOS menu bar panel.** 340 wide, height to content (max 640), the same section order as the popup.
- **Android.** Designed at 390 × 844 with system bars and gesture insets respected (no fake status bar). Gutter 16, primary action bottom-anchored 16px above the gesture inset.
- **Stats page and dashboard.** Fluid, max content width 1120px, 24px gutters, single column under 720px.
- **Rows.** List rows 56px; table rows 44px (32px inside the popup and menu bar, where rows are not tappable).
- **Targets.** Minimum 44px hit area, 48px for inline buttons and segmented controls, 56px for the leave/close button and bottom primary buttons. A visual smaller than its target (a 28px toggle in the popup, an 8px dot) gets an invisible hit area that reaches 44px on touch platforms.

## Elevation & Depth

Flat by default. Depth comes from surface steps and hairlines, never from heavy shadow, gradients or blur.

| Level | Light                                        | Dark                                | Used by                                                              |
| ----- | -------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| 0     | `surface-0`                                  | `surface-0`                         | Pages, lists, charts.                                                |
| 1     | `surface-1` + 1px `line`                     | `surface-1` + 1px `line`            | Text fields, warning banners, the popup body (it is its own window). |
| 2     | `surface-1` + `{{shadow:light:elevation-2}}` | `surface-1` + 1px `line`, no shadow | Floating things only: timeout overlay card, toasts, tooltips.        |

- The timeout overlay sits over `scrim` (light `{{hex:light:scrim}}`, dark `{{hex:dark:scrim}}`). No backdrop blur, no glass.
- Nothing is more than one step above what is behind it. No cards inside cards.

## Shapes

| Token                    | Value  | Use                                                        |
| ------------------------ | ------ | ---------------------------------------------------------- |
| `rounded.sm`             | 4px    | Bar data-ends, heatmap cells, segmented thumb, checkboxes. |
| `rounded.DEFAULT` / `md` | 8px    | Buttons, text fields, segmented track, icon buttons.       |
| `rounded.lg`             | 12px   | Overlay card, banners, toasts, dashboard cards.            |
| `rounded.xl`             | 16px   | Top corners of Android bottom sheets only.                 |
| `rounded.full`           | 9999px | Only 8px legend dots and progress-line ends.               |

No pill buttons, no pill chips, no radii outside 4 / 8 / 12 / 16.

**Icons, one family per platform.** Web, extension and dashboard: Lucide at 20px (16px in the popup), 1.75px stroke, round caps and joins, `currentColor` from an ink or status token. macOS: SF Symbols, regular weight, medium scale, `.foregroundStyle` from the same tokens. Android: Material Symbols Outlined, weight 400, grade 0, fill 0, optical size 20/24. No emoji as icons, no illustrations, no mascots.

| Meaning                       | Lucide (web, extension) | SF Symbols (macOS)         | Material Symbols Outlined (Android) |
| ----------------------------- | ----------------------- | -------------------------- | ----------------------------------- |
| Close / leave                 | `x`                     | `xmark`                    | `close`                             |
| Emergency access              | `life-buoy`             | `lifepreserver`            | `support`                           |
| Blocked / locked              | `lock`                  | `lock`                     | `lock`                              |
| Information / guardian notice | `info`                  | `info.circle`              | `info`                              |
| Warning                       | `triangle-alert`        | `exclamationmark.triangle` | `warning`                           |
| Success                       | `circle-check`          | `checkmark.circle`         | `check_circle`                      |
| Error                         | `circle-alert`          | `exclamationmark.circle`   | `error`                             |
| Done (toast)                  | `check`                 | `checkmark`                | `check`                             |
| Search without the feed       | `search`                | `magnifyingglass`          | `search`                            |
| Settings                      | `settings`              | `gearshape`                | `settings`                          |
| Statistics                    | `chart-column`          | `chart.bar`                | `bar_chart`                         |
| Table view                    | `table-2`               | `tablecells`               | `table`                             |
| Timer / intention time        | `timer`                 | `timer`                    | `timer`                             |
| Schedule                      | `clock`                 | `clock`                    | `schedule`                          |
| Focus session                 | `focus`                 | `scope`                    | `center_focus_strong`               |
| Breath pause                  | `wind`                  | `wind`                     | `air`                               |
| Guardian                      | `shield`                | `shield`                   | `shield`                            |
| Bedtime                       | `moon`                  | `moon`                     | `bedtime`                           |
| Hidden feed                   | `eye-off`               | `eye.slash`                | `visibility_off`                    |
| Sites                         | `globe`                 | `globe`                    | `language`                          |
| Apps                          | `app-window`            | `macwindow`                | `web_asset`                         |
| Export                        | `download`              | `square.and.arrow.down`    | `download`                          |
| Delete data                   | `trash-2`               | `trash`                    | `delete`                            |
| Open externally               | `external-link`         | `arrow.up.right.square`    | `open_in_new`                       |
| Next / disclosure             | `chevron-right`         | `chevron.right`            | `chevron_right`                     |

## Motion

Motion is restrained and functional. Only these things move:

| What                | Duration               | Easing                       | Behaviour                                                                                      |
| ------------------- | ---------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Breath pause        | 4000ms in / 4000ms out | `ease-in-out`                | A 1px outlined circle scales 0.6 → 1 → 0.6; the label alternates "Breathe in" / "Breathe out". |
| Pause progress line | linear, real time      | linear                       | Grows with the countdown, driven by the stored end time, never by accumulated ticks.           |
| Overlay card enter  | 200ms                  | `cubic-bezier(0.2, 0, 0, 1)` | Fades in and rises 8px; the scrim fades in.                                                    |
| Toast               | 150ms                  | `cubic-bezier(0.2, 0, 0, 1)` | Fades in while rising 8px; leaves by fading after 5s.                                          |
| Segment change      | 150ms                  | `cubic-bezier(0.2, 0, 0, 1)` | The selection wash slides to the new option.                                                   |

- Everything else changes instantly: no page transitions, no count-ups, no chart grow-in, no parallax, no hover lifts.
- `prefers-reduced-motion: reduce` (and the OS equivalents): the breath circle stays still while its label alternates, overlay and toasts use opacity only (100ms), segments jump. Countdown digits never animate.
- Android may add a 10ms haptic tick when an intention is committed. Never confetti or celebration.

## Components

Every component styles itself through the tokens above, supports both themes and has a visible focus state: `outline: 2px solid var(--mf-focus); outline-offset: 2px`, following the shape's radius.

### Button

- **Leave** (accent): `accent` fill, `accent-ink` label in `body-strong`, 56px, full column width, radius 8, optional `x` icon. The leave/close action only ("Close tab", "Leave reddit.com", "Cerrar pestaña"). One per screen, enabled from second 1, initial focus. Hover/pressed: `accent-hover`.
- **Ink** (primary everywhere else): `ink-1` fill, `surface-0` label, 48px (56 at the bottom of an Android screen). "Start focus · 25 min", "Continue" in onboarding.
- **Secondary**: transparent, 1px `line-strong` border, `ink-1` label, 48px. The alternative that costs something: "Continue to reddit.com", "5 more min", "Cancel emergency".
- **Quiet**: text in `accent` (or `ink-2` for "Emergency access"), 1px underline at 4px offset, 44px hit area. Inline actions: "End now", "Allow", "Search reddit.com without the feed".
- **Disabled**: `ink-3` label, `line` border, plus a caption that says why ("Choose how long first"). Never opacity alone.
- **Destructive**: secondary shape with a `status-critical` border and label and a `trash-2` icon. Never a red fill.

### Text field

- Label above in `label` / `ink-2`; field 48px, `surface-1`, 1px `line-strong` border, radius 8, `body` value, 16px padding; placeholder in `ink-3`.
- Helper row below in `caption` / `ink-3`: guidance left, counter right in tabular figures ("9 words").
- The intention field is optional at levels 0–1 and required at level 2+ (≥ 3 words, different from the previous one). The rule reads as guidance, not as an error: "At least 3 words, different from last time." When it is not met, the helper turns `ink-1` with an `info` icon, never red. `Enter` submits only while the field has focus.
- Placeholder rotates through neutral examples: "Reply to one message", "Check the opening hours", "Watch the lecture recording".
- Errors that really are errors (a failed save) use `status-critical` text with a `circle-alert` icon.

### Segmented control

- `surface-2` track with 4px padding, radius 8; options 40px tall (48px overall), `label` type, tabular figures.
- Selected: `accent` text and 1px `accent` border on `accent-soft`. Unselected: `ink-1` text, transparent.
- The duration picker (5 / 10 / 15 min) has **no default**: choosing is the commitment, and "Continue" stays disabled until a duration is chosen.
- `role="radiogroup"`; arrow keys move the selection.

### Countdown

- `countdown` type in `ink-1`, tabular. Seconds read as a bare number plus a muted unit ("12 s"); waits of a minute or more read `m:ss` ("1:47").
- Driven by a stored end time (`pauseEndsAt`), so reloading never resets it. `aria-live="polite"`, announced every 5 s.
- Followed by the progress line and the "why" sentence of the current pause type (`body` / `ink-2`).
- Breath variant: a 160px frame with a 1px `ink-1` outlined circle on `surface-2`, the `title`-size label and a `label` / `ink-3` rhythm line ("4 s in · 4 s out · 8 s left").

### Progress line

- 1px tall, full column width. Track `line`, fill `ink-1`, square ends. No rings, no circular timers, never the accent.
- `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`.

### Stat number

- One number with a small label above in `caption` / `ink-3` and context beside or below ("of 100 · 4 h 12 min tracked").
- `stat` (32) in compact surfaces, `display` (40) as the page hero. A missing value is an em dash "—", never 0.
- No deltas in green or red. If a comparison is shown it is words in ink ("6 points above your 7-day average").

### Level bar

- One 100% stacked horizontal bar of tracked time by level, in fixed scale order left to right: `level-0` Distracting → `level-4` Focus. Uncategorised time, when present, is a final `mark-muted` segment labelled "Uncategorised".
- 12px tall in the popup and menu bar, 24px on the stats page. 2px `surface` gaps between segments, 4px rounded outer ends only.
- Legend below: 8px dot, level name in ink, minutes in tabular `ink-2`. Always paired with the chart/table toggle.
- `role="img"` with an `aria-label` listing every level and its minutes.

### Data table

- Header row in `caption` / `ink-3` weight 500, a 1px `line-strong` rule beneath it; body rows separated by 1px `line`.
- 44px rows on pages, 32px in the popup and menu bar. Text left, numbers right in tabular figures, units in the header ("Min"), not in every cell.
- A level column shows an 8px level dot plus the level name in `ink-2`.
- Every chart's table view uses this component with the same data and order as the chart.

### Chart / table toggle

- A two-option segmented control ("Chart" | "Table", with `chart-column` and `table-2` icons on pages) in the chart frame's header, right-aligned. 28px visual in the popup with a 44px hit area on touch.
- The choice is remembered per chart in local storage. The table view is a first-class view, not a fallback.

### Toast

- Bottom centre, `surface-1`, 1px `line`, radius 12, `elevation-2`, `body-sm`, a `check` icon in `ink-2`. 5s, `role="status"`.
- Facts only, at most one neutral count: "Closed. That's 4 closes today." / "Cerrado. Llevas 4 cierres hoy."

### Banner

- Inline, persistent until the cause is fixed. Radius 12, 12px 16px padding, `body-sm`, at most one quiet action.
- **Notice**: `surface-2`, `info` icon in `ink-2`. Guardian and bypass information ("Your guardian will be told you used emergency access."). Never red.
- **Warning**: `surface-1` + 1px `line`, `triangle-alert` in `status-warning`. Setup problems ("Not running in private windows." + "Allow").
- **Error**: `circle-alert` in `status-critical`, label in ink.

### Overlay card

- The timeout card: max 480px wide, 32px padding, `surface-1`, radius 12, `elevation-2`, centred over `scrim`; the page's media is paused underneath.
- Content top to bottom: context in `label` / `ink-3`, the title quoting the intention in `title`, the Leave button (accent, initial focus), the "5 more min" secondary button, and the cost note in `caption` / `ink-3` ("Counts as a broken intention · next pause will be 30 s").
- `role="dialog"`, `aria-modal="true"`, focus trapped, `Esc` does nothing (leaving is a choice, not a dismissal).

### List row

- 56px, 16px horizontal padding, leading 20px icon or 8px level dot, primary text in `body` (or `body-sm` in the popup), secondary in `caption` / `ink-3`, trailing value in tabular `numeric` or a `chevron-right`.
- Rows are separated by 1px `line`; pressed state `surface-2`. No cards around lists.

### Tab / nav

- Stats page and dashboard: a top tab row of `label` items, 44px tall; the active tab shows `accent` text and a 2px `accent` underline; inactive tabs `ink-2`.
- Settings side nav (options page, macOS Settings): 40px items, active item `accent` text on `accent-soft`, radius 8.
- Android: a bottom navigation bar with Material Symbols, active item `accent` icon and label on an `accent-soft` indicator; 80px tall plus the gesture inset.

## Charts

Charts are drawn in SVG (Swift Charts and Compose Canvas on native) from the same tokens as the UI. The rules below are non-negotiable.

**Marks**

- Bars and columns at most 24px thick; 4px rounded data-end, square at the baseline; one baseline.
- 2px surface-coloured gaps between stacked segments and between touching bars. Never outline a mark to separate it.
- Lines (if ever needed): 2px, round joins; markers ≥ 8px with a 2px surface ring.
- Gridlines 1px solid `gridline`, horizontal only. Baseline 1px solid `baseline`. Never dashed.
- Heatmap cells: square, 2px surface gaps, radius 4; empty hours are `surface-2` with no mark, never `level-0`.

**Colour**

- Focus level is ordinal, so it always uses `level-0..4` in that order; a filter never repaints a level.
- Single-series charts use `mark-neutral` and need no legend; the title names them. The 7-day Pulse chart is single-series.
- The heatmap bins each hour's Pulse into the five level bands (0–19, 20–39, 40–59, 60–79, 80–100) and paints the matching `level-*` step, so one ramp means one thing everywhere.
- The accent is never a mark. Status colours never appear in charts.
- Text is never set in a level or mark colour. Labels sit outside the marks.

**Structure**

- One value axis, never dual. Axis ticks in `caption` tabular / `ink-3`, rounded to clean values (0, 25, 50, 75, 100 for Pulse).
- Legend for two or more series, above or below the plot, 8px dot plus the label in ink.
- Every chart has a table view and a chart/table toggle. Tooltips enhance and never gate a value.
- No donut or pie, no 3D, no dual axes, no gradients, no animated grow-in.

**The charts this product has**

- **Today by level** (popup, menu bar, stats): the Level bar above.
- **Pulse · 7 days** (stats, dashboard): seven vertical bars in `mark-neutral`, 24px wide, y ticks 0/50/100, today's bar labelled with its value; days with no data show "—" under the axis and no bar. Table: Day, Pulse, Tracked, Focus min.
- **Hour × weekday heatmap** (stats): 24 columns × 7 rows of 16px cells, hours along the top every 3 h in the locale's format ("06", "09" in Spanish; "6 am", "9 am" in English), weekdays down the side starting on Monday. Table: weekday rows, hour columns, Pulse per cell or "—".
- **Intentions log** (stats): not a chart; a data table of time, site, intention text, minutes chosen, outcome ("On time", "Extended", "Broken", "Closed") with an icon per outcome in `ink-2`.

## Do's and Don'ts

**Do**

- Make the leave/close action the largest control, the one accent fill, enabled at once and focused first.
- Use tabular figures on every countdown, timer and column of numbers.
- Use the accent only for the leave/close fill, links, the selected segment, the active nav item and the focus ring.
- Separate content with whitespace and 1px `line` hairlines.
- Give every chart a table view and every status an icon plus a word.
- Write copy in Spanish and English with locale-aware dates and times (24-hour in Spanish).
- Refer to people only as "you" and "your guardian" ("tú", "tu guardián").
- Design the dark theme with its own steps and check it with the same contrast rules.

**Don't**

- No gradients, glassmorphism, backdrop blur, glows or neon, anywhere.
- No purple or blue-violet, no second accent, no accent-filled control other than the one leave/close action.
- No red for distraction, for bypasses or for guardian notices. Red means an error.
- No streaks, badges, scores against other people, praise or shame.
- No emoji as icons, no decorative illustrations, no mascots, no mixed icon sets on one platform.
- No shadows beyond level 2, no cards inside cards.
- No pill-shaped buttons or chips, no radii outside 4 / 8 / 12 / 16.
- No donut, pie, 3D or dual-axis charts, no dashed gridlines, no chart without a table.
- No text in a level or mark colour, no accent-coloured bars.
- No motion beyond the breath, the progress line, the overlay card, toasts and segment changes; no count-ups.
- No real names in mocks, copy or fixtures.
