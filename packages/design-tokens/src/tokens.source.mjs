// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The single source of truth for every monki-focus design token.
 *
 * Every colour is authored in OKLCH (or as a reference to another token) and
 * converted to sRGB by the generators, so a hue or lightness tweak is one edit
 * here followed by `npm run build && npm run docs` in this package. No output
 * file is ever edited by hand.
 *
 * Status: draft pending maintainer approval of the accent.
 */

/**
 * @typedef {'light' | 'dark'} Theme
 * @typedef {{ kind: 'oklch', l: number, c: number, h: number, alpha?: number }} OklchValue
 * @typedef {{ kind: 'ref', token: string, theme?: Theme, alpha?: number }} RefValue
 * @typedef {OklchValue | RefValue} ColorValue
 * @typedef {'surface' | 'ink' | 'line' | 'accent' | 'level' | 'chart' | 'status'} ColorGroup
 * @typedef {{ name: string, group: ColorGroup, light: ColorValue, dark: ColorValue, usage: string }} ColorToken
 * @typedef {'accent' | 'accent-hover' | 'accent-ink' | 'accent-soft'} AccentRole
 * @typedef {'tertiary-fixed-dim' | 'on-tertiary-fixed'} AccentMaterialRole
 * @typedef {{
 *   label: string,
 *   light: Record<AccentRole, ColorValue>,
 *   dark: Record<AccentRole, ColorValue>,
 *   material: Record<AccentMaterialRole, ColorValue>,
 * }} AccentOption
 */

/**
 * @param {number} l OKLCH lightness, 0..1
 * @param {number} c OKLCH chroma
 * @param {number} h OKLCH hue in degrees
 * @param {number} [alpha] opacity, 0..1
 * @returns {OklchValue}
 */
const oklch = (l, c, h, alpha) =>
  alpha === undefined ? { kind: 'oklch', l, c, h } : { kind: 'oklch', l, c, h, alpha }

/**
 * A reference to another colour token, in the same theme unless `theme` is given.
 * @param {string} token
 * @param {{ theme?: Theme, alpha?: number }} [options]
 * @returns {RefValue}
 */
const ref = (token, options = {}) => ({ kind: 'ref', token, ...options })

/** Neutral hue bias: greys lean very slightly toward the teal accent. */
const NEUTRAL_HUE = 190
/** Focus-level ramp: one cool ink-blue hue. */
const LEVEL_HUE = 250
/**
 * Lightness and chroma of level-0..level-4 (light theme reads light to dark).
 * @type {[number, number][]}
 */
const LEVEL_LIGHT = [
  [0.76, 0.075],
  [0.655, 0.09],
  [0.555, 0.095],
  [0.455, 0.09],
  [0.355, 0.08],
]
/**
 * Lightness and chroma of level-0..level-4 (dark theme reads dark to light).
 * @type {[number, number][]}
 */
const LEVEL_DARK = [
  [0.43, 0.07],
  [0.53, 0.085],
  [0.63, 0.09],
  [0.73, 0.085],
  [0.83, 0.07],
]
const LEVEL_NAMES = ['Distracting', 'Personal', 'Neutral', 'Other work', 'Focus']

const WHITE = oklch(1, 0, 0)
const NEAR_BLACK = oklch(0.165, 0.006, NEUTRAL_HUE)

/** @type {Record<string, AccentOption>} */
export const accents = {
  teal: {
    label: 'Deep teal-green',
    light: {
      'accent': oklch(0.47, 0.085, 185),
      'accent-hover': oklch(0.41, 0.08, 185),
      'accent-ink': WHITE,
      'accent-soft': oklch(0.952, 0.028, 185),
    },
    dark: {
      'accent': oklch(0.77, 0.09, 180),
      'accent-hover': oklch(0.84, 0.08, 180),
      'accent-ink': NEAR_BLACK,
      'accent-soft': oklch(0.29, 0.04, 185),
    },
    material: {
      'tertiary-fixed-dim': oklch(0.86, 0.06, 185),
      'on-tertiary-fixed': oklch(0.25, 0.04, 185),
    },
  },
  amber: {
    label: 'Warm ink-amber',
    light: {
      'accent': oklch(0.505, 0.105, 62),
      'accent-hover': oklch(0.44, 0.095, 62),
      'accent-ink': WHITE,
      'accent-soft': oklch(0.955, 0.032, 75),
    },
    dark: {
      'accent': oklch(0.81, 0.12, 75),
      'accent-hover': oklch(0.87, 0.1, 78),
      'accent-ink': NEAR_BLACK,
      'accent-soft': oklch(0.3, 0.045, 65),
    },
    material: {
      'tertiary-fixed-dim': oklch(0.86, 0.07, 70),
      'on-tertiary-fixed': oklch(0.25, 0.045, 62),
    },
  },
}

/** The accent the design recommends. */
export const RECOMMENDED_ACCENT = 'teal'

/**
 * THE switch: the accent every output is built with. Change it to another key
 * of `accents` (for example 'amber') and run `npm run build && npm run docs`.
 */
export const ACCENT = 'teal'

/**
 * Colour tokens in output order. Accent-family tokens come from the chosen accent.
 * @param {string} [accentKey]
 * @returns {ColorToken[]}
 */
export function colorTokens(accentKey = ACCENT) {
  const accent = accents[accentKey]
  if (!accent) throw new Error(`Unknown accent "${accentKey}"`)
  const N = NEUTRAL_HUE
  return [
    // Surfaces
    {
      name: 'surface-0',
      group: 'surface',
      light: oklch(0.985, 0.003, N),
      dark: NEAR_BLACK,
      usage:
        'Page background: interstitial, stats page, dashboard, Android overlay. Chart surface.',
    },
    {
      name: 'surface-1',
      group: 'surface',
      light: WHITE,
      dark: oklch(0.2, 0.007, N),
      usage:
        'Raised: extension popup body, menu bar panel, overlay card, toast, text field, table header band.',
    },
    {
      name: 'surface-2',
      group: 'surface',
      light: oklch(0.958, 0.005, N),
      dark: oklch(0.245, 0.008, N),
      usage:
        'Sunken fills: segmented-control track, empty heatmap cell, neutral notice banner, pressed row, skeleton.',
    },
    {
      name: 'scrim',
      group: 'surface',
      light: ref('ink-1', { alpha: 0.55 }),
      dark: oklch(0, 0, 0, 0.65),
      usage: 'Dims the page behind the timeout overlay card. Solid colour with alpha; never blur.',
    },
    // Ink
    {
      name: 'ink-1',
      group: 'ink',
      light: oklch(0.225, 0.01, N),
      dark: oklch(0.945, 0.006, N),
      usage:
        'Primary text and icons on surface-0/1/2; countdown digits; ink-filled buttons (label in surface-0).',
    },
    {
      name: 'ink-2',
      group: 'ink',
      light: oklch(0.43, 0.012, N),
      dark: oklch(0.8, 0.01, N),
      usage:
        'Secondary text on surface-0/1/2: field labels, row meta, axis titles, the "why" line.',
    },
    {
      name: 'ink-3',
      group: 'ink',
      light: oklch(0.525, 0.012, N),
      dark: oklch(0.69, 0.012, N),
      usage:
        'Muted text on surface-0/1/2: context line, captions, placeholders, tick labels, disabled labels.',
    },
    // Lines
    {
      name: 'line',
      group: 'line',
      light: oklch(0.912, 0.006, N),
      dark: oklch(0.3, 0.008, N),
      usage:
        '1px hairline dividers between rows and sections. Decorative (no contrast requirement).',
    },
    {
      name: 'line-strong',
      group: 'line',
      light: oklch(0.615, 0.01, N),
      dark: oklch(0.53, 0.01, N),
      usage:
        'Boundaries that must be seen (>=3:1): text-field border, secondary-button border, segmented outline, progress-line track end.',
    },
    // Accent (interaction only)
    {
      name: 'accent',
      group: 'accent',
      light: accent.light.accent,
      dark: accent.dark.accent,
      usage:
        'The single chromatic accent. Fill of the one leave/close control per screen; links; selected segment text and border; active tab. Never a chart mark, never body text emphasis.',
    },
    {
      name: 'accent-hover',
      group: 'accent',
      light: accent.light['accent-hover'],
      dark: accent.dark['accent-hover'],
      usage: 'Hover/pressed state of accent fills and links.',
    },
    {
      name: 'accent-ink',
      group: 'accent',
      light: accent.light['accent-ink'],
      dark: accent.dark['accent-ink'],
      usage: 'Label and icon on an accent fill (the Close / Leave button).',
    },
    {
      name: 'accent-soft',
      group: 'accent',
      light: accent.light['accent-soft'],
      dark: accent.dark['accent-soft'],
      usage: 'Selection wash behind accent text: selected 5/10/15 segment, selected nav item.',
    },
    {
      name: 'focus',
      group: 'accent',
      light: ref('accent'),
      dark: ref('accent'),
      usage: 'Keyboard focus ring: 2px solid, 2px offset in the surface colour. = accent.',
    },
    // Focus-level ramp (marks only)
    ...LEVEL_NAMES.map((label, i) => {
      const [lightL, lightC] = LEVEL_LIGHT[i] ?? [0, 0]
      const [darkL, darkC] = LEVEL_DARK[i] ?? [0, 0]
      return /** @type {ColorToken} */ ({
        name: `level-${i}`,
        group: 'level',
        light: oklch(lightL, lightC, LEVEL_HUE),
        dark: oklch(darkL, darkC, LEVEL_HUE),
        usage: `${label} (${i * 25}) on marks only: day stacked-bar segment, heatmap cell, 8px legend key. Never text, never a control.`,
      })
    }),
    // Chart chrome
    {
      name: 'mark-neutral',
      group: 'chart',
      light: oklch(0.5, 0.012, N),
      dark: oklch(0.7, 0.012, N),
      usage:
        'Single-series marks: 7-day Pulse bars, top-sites minute bars. No legend; the title names it.',
    },
    {
      name: 'mark-muted',
      group: 'chart',
      light: oklch(0.83, 0.008, N),
      dark: oklch(0.36, 0.008, N),
      usage:
        'De-emphasised marks: uncategorised time, days without data. Always labelled or in the table.',
    },
    {
      name: 'gridline',
      group: 'chart',
      light: oklch(0.935, 0.005, N),
      dark: oklch(0.255, 0.007, N),
      usage: 'Chart gridlines: 1px solid, horizontal only. Decorative.',
    },
    {
      name: 'baseline',
      group: 'chart',
      light: oklch(0.79, 0.008, N),
      dark: oklch(0.41, 0.008, N),
      usage: 'Chart baseline / axis rule: 1px solid.',
    },
    // Status (reserved; always icon + label)
    {
      name: 'status-good',
      group: 'status',
      light: oklch(0.52, 0.13, 138),
      dark: oklch(0.8, 0.15, 138),
      usage:
        'Success icon (circle-check) beside an ink label: "Connector installed". Never alone, never a chart mark.',
    },
    {
      name: 'status-warning',
      group: 'status',
      light: oklch(0.535, 0.11, 78),
      dark: oklch(0.83, 0.13, 82),
      usage:
        'Warning icon (triangle-alert) beside an ink label: "No access in private windows". Never alone.',
    },
    {
      name: 'status-critical',
      group: 'status',
      light: oklch(0.53, 0.16, 27),
      dark: oklch(0.73, 0.14, 25),
      usage:
        'Errors only: icon, field-error text, destructive-action label/border. Bypass and guardian notices are NOT critical; they are neutral.',
    },
  ]
}

/**
 * Material 3 roles (Stitch front matter and Compose `lightColorScheme` /
 * `darkColorScheme`), derived from the semantic tokens. Primary is ink; the
 * accent rides on tertiary. Values are references or OKLCH, in output order.
 * @param {string} [accentKey]
 * @returns {Record<Theme, Record<string, ColorValue>>}
 */
export function materialRoles(accentKey = ACCENT) {
  const accent = accents[accentKey]
  if (!accent) throw new Error(`Unknown accent "${accentKey}"`)
  const N = NEUTRAL_HUE
  /** @param {Theme} theme */
  const shared = (theme) => {
    const other = theme === 'light' ? 'dark' : 'light'
    return {
      'background': ref('surface-0'),
      'on-background': ref('ink-1'),
      'surface': ref('surface-0'),
      'surface-dim': theme === 'light' ? oklch(0.93, 0.005, N) : oklch(0.14, 0.005, N),
      'surface-bright': theme === 'light' ? ref('surface-1') : oklch(0.28, 0.008, N),
      'surface-container-lowest': theme === 'light' ? ref('surface-1') : oklch(0.14, 0.005, N),
      'surface-container-low': ref('surface-0'),
      'surface-container': theme === 'light' ? ref('surface-2') : ref('surface-1'),
      'surface-container-high': theme === 'light' ? ref('gridline') : ref('surface-2'),
      'surface-container-highest': theme === 'light' ? ref('line') : oklch(0.28, 0.008, N),
      'surface-variant': ref('surface-2'),
      'on-surface': ref('ink-1'),
      'on-surface-variant': ref('ink-2'),
      'inverse-surface': theme === 'light' ? oklch(0.3, 0.01, N) : ref('ink-1'),
      'inverse-on-surface': theme === 'light' ? ref('surface-2') : ref('surface-1'),
      'outline': ref('line-strong'),
      'outline-variant': ref('line'),
      'surface-tint': ref('ink-1'),
      'primary': ref('ink-1'),
      'on-primary': ref('surface-0'),
      'primary-container': ref('surface-2'),
      'on-primary-container': ref('ink-1'),
      'inverse-primary': ref('accent', { theme: other }),
      'secondary': ref('ink-2'),
      'on-secondary': ref('surface-0'),
      'secondary-container': ref('surface-2'),
      'on-secondary-container': ref('ink-1'),
      'tertiary': ref('accent'),
      'on-tertiary': ref('accent-ink'),
      'tertiary-container': ref('accent-soft'),
      'on-tertiary-container': ref('accent'),
      'error': ref('status-critical'),
      'on-error': theme === 'light' ? WHITE : ref('surface-0'),
      'error-container': theme === 'light' ? oklch(0.955, 0.025, 27) : oklch(0.28, 0.06, 27),
      'on-error-container': theme === 'light' ? oklch(0.42, 0.13, 27) : oklch(0.88, 0.06, 27),
      'primary-fixed': ref('surface-2'),
      'primary-fixed-dim': ref('line'),
      'on-primary-fixed': ref('ink-1'),
      'on-primary-fixed-variant': ref('ink-2'),
      'secondary-fixed': ref('surface-2'),
      'secondary-fixed-dim': ref('line'),
      'on-secondary-fixed': ref('ink-1'),
      'on-secondary-fixed-variant': ref('ink-2'),
      // Fixed roles are theme-independent by definition: always the light accent family.
      'tertiary-fixed': ref('accent-soft', { theme: 'light' }),
      'tertiary-fixed-dim': accent.material['tertiary-fixed-dim'],
      'on-tertiary-fixed': accent.material['on-tertiary-fixed'],
      'on-tertiary-fixed-variant': ref('accent', { theme: 'light' }),
    }
  }
  return { light: shared('light'), dark: shared('dark') }
}

/**
 * Font families. The web clients self-host Inter; the native apps use the
 * system face (Roboto, SF Pro) unless the maintainer decides otherwise.
 */
export const fontFamilies = {
  web: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
  native: 'system',
}

/**
 * Text styles: size and line height in px (sp on Android, pt on macOS),
 * letter spacing in em.
 * @type {{ name: string, size: number, lineHeight: number, weight: 400 | 500 | 600, letterSpacingEm: number, tabular: boolean, usage: string }[]}
 */
export const textStyles = [
  {
    name: 'countdown',
    size: 96,
    lineHeight: 96,
    weight: 500,
    letterSpacingEm: -0.02,
    tabular: true,
    usage:
      'Pause countdown and emergency wait. 72/72 on screens under 600px tall (Android overlay).',
  },
  {
    name: 'display',
    size: 40,
    lineHeight: 48,
    weight: 500,
    letterSpacingEm: -0.02,
    tabular: false,
    usage: 'The one hero per view: Pulse on the stats page and dashboard.',
  },
  {
    name: 'stat',
    size: 32,
    lineHeight: 40,
    weight: 500,
    letterSpacingEm: -0.015,
    tabular: true,
    usage: 'Pulse in the popup and menu bar; guardian summary figures.',
  },
  {
    name: 'title',
    size: 24,
    lineHeight: 32,
    weight: 600,
    letterSpacingEm: -0.01,
    tabular: false,
    usage: 'Screen titles, "What are you here for?", timeout card title.',
  },
  {
    name: 'heading',
    size: 18,
    lineHeight: 24,
    weight: 600,
    letterSpacingEm: -0.005,
    tabular: false,
    usage: 'Section, card and chart titles.',
  },
  {
    name: 'body',
    size: 16,
    lineHeight: 24,
    weight: 400,
    letterSpacingEm: 0,
    tabular: false,
    usage: 'Running text, input values, the "why" line.',
  },
  {
    name: 'body-strong',
    size: 16,
    lineHeight: 24,
    weight: 500,
    letterSpacingEm: 0,
    tabular: false,
    usage: 'Button labels.',
  },
  {
    name: 'body-sm',
    size: 14,
    lineHeight: 20,
    weight: 400,
    letterSpacingEm: 0,
    tabular: false,
    usage: 'Dense surfaces only: popup, menu bar panel, table rows, banners, toasts.',
  },
  {
    name: 'numeric',
    size: 14,
    lineHeight: 20,
    weight: 500,
    letterSpacingEm: 0,
    tabular: true,
    usage: 'Every column of numbers, mm:ss timers, counts.',
  },
  {
    name: 'label',
    size: 13,
    lineHeight: 16,
    weight: 500,
    letterSpacingEm: 0.01,
    tabular: true,
    usage: 'Field labels, segmented options, legend items, nav items, context line.',
  },
  {
    name: 'caption',
    size: 12,
    lineHeight: 16,
    weight: 400,
    letterSpacingEm: 0.01,
    tabular: true,
    usage: 'Helper text, axis ticks, footnotes, level line.',
  },
]

/** Spacing and sizing in px (dp on Android, pt on macOS). */
export const spacing = [
  { name: 'space-xs', px: 4, usage: 'Icon-to-label gap; half step.' },
  { name: 'space-sm', px: 8, usage: 'Between related controls.' },
  { name: 'space-md', px: 16, usage: 'Side gutter; header-to-content.' },
  { name: 'space-lg', px: 24, usage: 'Between groups inside a section; card padding.' },
  { name: 'space-xl', px: 32, usage: 'Between sections.' },
  { name: 'space-2xl', px: 48, usage: 'Interstitial vertical rhythm between blocks.' },
  { name: 'space-3xl', px: 64, usage: 'Top offset of the interstitial column.' },
  { name: 'row', px: 56, usage: 'List row height.' },
  { name: 'row-compact', px: 44, usage: 'Table and popup row height.' },
  { name: 'tap-min', px: 44, usage: 'Minimum hit area.' },
  { name: 'tap', px: 48, usage: 'Inline buttons, segmented control.' },
  { name: 'tap-lg', px: 56, usage: 'The Close button; bottom primary button.' },
  { name: 'column-max', px: 560, usage: 'Interstitial and timeout card column.' },
  { name: 'popup-width', px: 360, usage: 'Extension popup width.' },
  { name: 'panel-width', px: 340, usage: 'macOS menu bar panel width.' },
]

/** Corner radii in px (dp on Android, pt on macOS). */
export const radius = [
  {
    name: 'radius-sm',
    px: 4,
    usage: 'Bar data-ends, heatmap cells, checkbox, segmented thumb inset.',
  },
  { name: 'radius-md', px: 8, usage: 'Buttons, fields, segmented control, toasts.' },
  { name: 'radius-lg', px: 12, usage: 'Cards, overlay card, banners.' },
  { name: 'radius-xl', px: 16, usage: 'Android bottom sheets (top corners) only.' },
  { name: 'radius-full', px: 9999, usage: 'Progress-line ends and 8px legend dots only.' },
]

/** Durations in milliseconds. */
export const durations = [
  { name: 'duration-fast', ms: 150, usage: 'Toasts, segment changes, hover.' },
  { name: 'duration-base', ms: 200, usage: 'Overlay card and sheet enter.' },
  {
    name: 'breath-phase',
    ms: 4000,
    usage: 'Breath pause: 4s expand, 4s contract. Static under reduced motion.',
  },
]

/** Cubic-bezier easings (x1, y1, x2, y2). */
export const easings = [
  { name: 'easing-standard', x1: 0.2, y1: 0, x2: 0, y2: 1, usage: 'Every transition.' },
]

/**
 * Elevation. Only level 2 casts a shadow, and only in the light theme; the
 * dark theme uses a 1px `line` border instead.
 * @type {{ name: string, light: { y: number, blur: number, color: ColorValue }[], dark: { y: number, blur: number, color: ColorValue }[], border: string | null, usage: string }[]}
 */
export const elevation = [
  { name: 'elevation-0', light: [], dark: [], border: null, usage: 'Page, lists, charts.' },
  {
    name: 'elevation-1',
    light: [],
    dark: [],
    border: 'line',
    usage: 'surface-1 + 1px line: fields, popup sections that need a frame.',
  },
  {
    name: 'elevation-2',
    light: [
      { y: 1, blur: 2, color: ref('ink-1', { alpha: 0.06 }) },
      { y: 8, blur: 24, color: ref('ink-1', { alpha: 0.08 }) },
    ],
    dark: [],
    border: 'line',
    usage: 'Floating only: timeout overlay card, toast, tooltip.',
  },
]

/** One icon family per platform. */
export const icons = {
  web: { set: 'Lucide', stroke: 1.75, size: 20 },
  macos: { set: 'SF Symbols', weight: 'regular', scale: 'medium' },
  android: { set: 'Material Symbols Outlined', weight: 400, grade: 0, opticalSize: 20, fill: 0 },
}
