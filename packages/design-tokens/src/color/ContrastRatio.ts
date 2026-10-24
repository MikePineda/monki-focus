// SPDX-License-Identifier: AGPL-3.0-or-later
import { hexToLinearSrgb } from './HexToLinearSrgb.ts'

const relativeLuminance = (hex: string): number => {
  const [r, g, b] = hexToLinearSrgb(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x contrast ratio between two opaque colours, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05)
}
