// SPDX-License-Identifier: AGPL-3.0-or-later
import { hexToLinearSrgb } from './HexToLinearSrgb.ts'

export interface Oklab {
  readonly l: number
  readonly a: number
  readonly b: number
}

/** `#rrggbb` to OKLab (Ottosson 2020). */
export function hexToOklab(hex: string): Oklab {
  const [r, g, b] = hexToLinearSrgb(hex)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

/** `#rrggbb` to OKLCH, hue in degrees 0..360. */
export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const { l, a, b } = hexToOklab(hex)
  const h = (Math.atan2(b, a) * 180) / Math.PI
  return { l, c: Math.hypot(a, b), h: h < 0 ? h + 360 : h }
}
