// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import en from '../../../src/i18n/catalogs/en.json'
import es from '../../../src/i18n/catalogs/es.json'
import { createTranslator, interpolate } from '../../../src/i18n/t'

describe('createTranslator', () => {
  it('translator_returns_the_message_of_its_locale', () => {
    expect(createTranslator('en')('popup.title')).toBe(en['popup.title'])
    expect(createTranslator('es')('popup.title')).toBe(es['popup.title'])
  })

  it('translator_interpolates_params', () => {
    expect(createTranslator('en')('countdown.minutesLeft', { minutes: 1, seconds: 47 })).toBe(
      interpolate(en['countdown.minutesLeft'], { minutes: 1, seconds: 47 })
    )
  })
})

describe('interpolate', () => {
  it('interpolation_replaces_named_params', () => {
    expect(interpolate('{count} of {total}', { count: 2, total: 5 })).toBe('2 of 5')
  })

  it('interpolation_keeps_placeholders_without_a_param', () => {
    expect(interpolate('{count} left', {})).toBe('{count} left')
  })
})

describe('plural messages', () => {
  // `countdown.secondsLeft` has `_one` and `_other` forms in both catalogs.
  it('plural_uses_the_one_form_for_a_count_of_one', () => {
    expect(createTranslator('en')('countdown.secondsLeft', { count: 1 })).toBe(
      interpolate(en['countdown.secondsLeft_one'], { count: 1 })
    )
  })

  it('plural_uses_the_other_form_for_zero_and_many', () => {
    const t = createTranslator('en')
    expect(t('countdown.secondsLeft', { count: 0 })).toBe(
      interpolate(en['countdown.secondsLeft_other'], { count: 0 })
    )
    expect(t('countdown.secondsLeft', { count: 12 })).toBe(
      interpolate(en['countdown.secondsLeft_other'], { count: 12 })
    )
  })

  it('plural_follows_the_rules_of_the_locale', () => {
    const t = createTranslator('es')
    expect(t('countdown.secondsLeft', { count: 1 })).toBe(
      interpolate(es['countdown.secondsLeft_one'], { count: 1 })
    )
    // Spanish has a `many` category (1 000 000); it falls back to `_other`.
    expect(t('countdown.secondsLeft', { count: 1_000_000 })).toBe(
      interpolate(es['countdown.secondsLeft_other'], { count: 1_000_000 })
    )
  })

  it('plural_without_a_count_falls_back_to_the_other_form', () => {
    const t = createTranslator('en') as unknown as (key: string) => string
    expect(t('countdown.secondsLeft')).toBe(en['countdown.secondsLeft_other'])
  })

  it('plural_interpolates_the_count', () => {
    expect(createTranslator('en')('textField.wordCount', { count: 9 })).toBe(
      interpolate(en['textField.wordCount_other'], { count: 9 })
    )
  })
})
