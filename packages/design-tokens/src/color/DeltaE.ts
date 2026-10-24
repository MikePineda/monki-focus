// SPDX-License-Identifier: AGPL-3.0-or-later
import { hexToOklab } from './HexToOklab.ts'

/**
 * Perceptual distance as Euclidean OKLab ΔE scaled by 100 (black to white is
 * 100), the unit the design draft reports.
 */
export function deltaE(a: string, b: string): number {
  const x = hexToOklab(a)
  const y = hexToOklab(b)
  return 100 * Math.hypot(x.l - y.l, x.a - y.a, x.b - y.b)
}
