// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { compareNullableCodeUnits } from '../../src/CodeUnitOrder.ts'
import { epochSecondsOf, utcInstantOf } from '../../src/Instant.ts'

describe('Instant', () => {
  it('an_offset_instant_is_written_back_in_utc_without_fractions', () => {
    expect(utcInstantOf(epochSecondsOf('2026-10-26T20:00:00.900+11:00'))).toBe(
      '2026-10-26T09:00:00Z'
    )
  })

  it('text_that_is_not_an_instant_fails_loudly', () => {
    expect(() => epochSecondsOf('yesterday')).toThrow(RangeError)
  })
})

describe('CodeUnitOrder', () => {
  it('null_sorts_before_every_string_and_code_units_are_not_locale_order', () => {
    expect(compareNullableCodeUnits(null, 'a')).toBe(-1)
    expect(compareNullableCodeUnits('a', null)).toBe(1)
    expect(compareNullableCodeUnits(null, null)).toBe(0)
    expect(compareNullableCodeUnits('Z', 'a')).toBe(-1)
  })
})
