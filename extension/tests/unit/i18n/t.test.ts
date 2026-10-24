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
})

describe('interpolate', () => {
  it('interpolation_replaces_named_params', () => {
    expect(interpolate('{count} of {total}', { count: 2, total: 5 })).toBe('2 of 5')
  })

  it('interpolation_keeps_placeholders_without_a_param', () => {
    expect(interpolate('{count} left', {})).toBe('{count} left')
  })
})
