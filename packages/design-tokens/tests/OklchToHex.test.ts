// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../src/color/ContrastRatio.ts'
import { deltaE } from '../src/color/DeltaE.ts'
import { hexToOklch } from '../src/color/HexToOklab.ts'
import { oklchToHex } from '../src/color/OklchToHex.ts'

describe('colour conversion', () => {
  it('oklch_to_hex_matches_reference_values', () => {
    expect(oklchToHex({ kind: 'oklch', l: 1, c: 0, h: 0 })).toBe('#ffffff')
    expect(oklchToHex({ kind: 'oklch', l: 0, c: 0, h: 0 })).toBe('#000000')
    // The reviewed draft accent.
    expect(oklchToHex({ kind: 'oklch', l: 0.47, c: 0.085, h: 185 })).toBe('#076961')
    expect(oklchToHex({ kind: 'oklch', l: 0, c: 0, h: 0, alpha: 0.65 })).toBe('#000000a6')
  })

  it('out_of_gamut_colours_are_clipped_by_reducing_chroma', () => {
    const hex = oklchToHex({ kind: 'oklch', l: 0.9, c: 0.4, h: 140 })

    expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    expect(hexToOklch(hex).c).toBeLessThan(0.4)
  })

  it('hex_round_trips_through_oklch', () => {
    const lch = hexToOklch('#076961')

    expect(lch.l).toBeCloseTo(0.47, 2)
    expect(Math.abs(lch.h - 185)).toBeLessThan(1)
  })

  it('contrast_ratio_and_delta_e_match_known_values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#777777')).toBe(1)
    expect(deltaE('#000000', '#ffffff')).toBeCloseTo(100, 1)
    expect(deltaE('#076961', '#076961')).toBe(0)
  })
})
