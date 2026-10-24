// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { formatNumber } from '../../../src/i18n/formatNumber'

describe('formatNumber', () => {
  it('numbers_use_the_grouping_of_the_locale', () => {
    expect(formatNumber(12_345, 'en')).toBe('12,345')
    expect(formatNumber(12_345, 'es')).toBe('12.345')
  })

  it('numbers_are_rounded_to_whole_units', () => {
    expect(formatNumber(41.6, 'en')).toBe('42')
  })
})
