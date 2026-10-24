// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { compareNullableCodeUnits } from '../../src/CodeUnitOrder.ts'

describe('CodeUnitOrder', () => {
  it('null_sorts_before_every_string_and_code_units_are_not_locale_order', () => {
    expect(compareNullableCodeUnits(null, 'a')).toBe(-1)
    expect(compareNullableCodeUnits('a', null)).toBe(1)
    expect(compareNullableCodeUnits(null, null)).toBe(0)
    expect(compareNullableCodeUnits('Z', 'a')).toBe(-1)
  })
})
