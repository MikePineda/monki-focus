// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * OKLCH to sRGB hex. Out-of-gamut colours are brought inside sRGB by reducing
 * chroma in 0.002 steps (hue and lightness are kept), exactly as the reviewed
 * draft did, so the generated hex values match the reviewed mocks.
 */
export interface Oklch {
  readonly kind?: 'oklch'
  readonly l: number
  readonly c: number
  readonly h: number
  readonly alpha?: number
}

const CHROMA_STEP = 0.002
const GAMUT_EPSILON = 1e-4

const linearToSrgb = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055

const oklchToLinearSrgb = (l: number, c: number, h: number): [number, number, number] => {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const lms = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ] as const
  return [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ]
}

const inGamut = (rgb: readonly number[]): boolean =>
  rgb.every((v) => v >= -GAMUT_EPSILON && v <= 1 + GAMUT_EPSILON)

const toByte = (linear: number): string =>
  Math.round(Math.max(0, Math.min(1, linearToSrgb(Math.max(0, linear)))) * 255)
    .toString(16)
    .padStart(2, '0')

const alphaByte = (alpha: number): string =>
  Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')

/** `#rrggbb`, or `#rrggbbaa` when an alpha below 1 is given. */
export function oklchToHex(color: Oklch): string {
  let chroma = color.c
  let rgb = oklchToLinearSrgb(color.l, chroma, color.h)
  while (!inGamut(rgb) && chroma > 0) {
    chroma -= CHROMA_STEP
    rgb = oklchToLinearSrgb(color.l, chroma, color.h)
  }
  const hex = '#' + rgb.map(toByte).join('')
  return color.alpha === undefined || color.alpha >= 1 ? hex : hex + alphaByte(color.alpha)
}

/** Applies an alpha to an opaque `#rrggbb` value. */
export function withAlpha(hex: string, alpha: number | undefined): string {
  return alpha === undefined || alpha >= 1 ? hex : hex.slice(0, 7) + alphaByte(alpha)
}
