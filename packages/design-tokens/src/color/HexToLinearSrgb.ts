// SPDX-License-Identifier: AGPL-3.0-or-later
/** `#rrggbb` (alpha ignored) to linear-light sRGB channels in 0..1. */
export function hexToLinearSrgb(hex: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) throw new Error(`Not a hex colour: ${hex}`)
  const channel = (offset: number): number => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return [channel(1), channel(3), channel(5)]
}
