// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import en from '../../../src/i18n/catalogs/en.json'
import es from '../../../src/i18n/catalogs/es.json'
import chromeEn from '../../../public/_locales/en/messages.json'
import chromeEs from '../../../public/_locales/es/messages.json'

const sortedKeys = (catalog: object) => Object.keys(catalog).sort()
const placeholders = (message: string) =>
  [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

describe('i18n catalogs', () => {
  it('i18n_catalogs_have_identical_keys', () => {
    expect(sortedKeys(es)).toEqual(sortedKeys(en))
  })

  it('i18n_catalogs_have_no_empty_messages', () => {
    for (const message of [...Object.values(en), ...Object.values(es)]) {
      expect(message.trim()).not.toBe('')
    }
  })

  it('i18n_catalogs_use_the_same_placeholders_per_key', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(es[key]), key).toEqual(placeholders(en[key]))
    }
  })

  it('chrome_locales_have_identical_keys', () => {
    expect(sortedKeys(chromeEs)).toEqual(sortedKeys(chromeEn))
    expect(sortedKeys(chromeEn)).toEqual(['extDescription', 'extName'])
  })

  it('chrome_locale_descriptions_fit_the_store_limit', () => {
    // The Chrome Web Store rejects manifest descriptions over 132 characters.
    for (const messages of [chromeEn, chromeEs]) {
      expect(messages.extDescription.message.length).toBeLessThanOrEqual(132)
    }
  })
})
