// SPDX-License-Identifier: AGPL-3.0-or-later
import en from './catalogs/en.json'
import es from './catalogs/es.json'
import type { Locale } from './locale'

type CatalogKey = keyof typeof en
type PluralForm = `_${'one' | 'other'}`

/** Base of every key that has `_one` / `_other` forms (`textField.wordCount`). */
export type PluralKey = CatalogKey extends infer K
  ? K extends `${infer Base}${PluralForm}`
    ? Base
    : never
  : never
/** Every key without plural forms. */
export type SimpleKey = Exclude<CatalogKey, `${string}${PluralForm}`>
/** Message keys are generated from the English catalog. */
export type MessageKey = SimpleKey | PluralKey
export type MessageParams = Readonly<Record<string, string | number>>

export interface Translate {
  /** Plural messages pick their form from `count` with `Intl.PluralRules`. */
  (key: PluralKey, params: MessageParams & { readonly count: number }): string
  (key: SimpleKey, params?: MessageParams): string
}

// Typing every catalog as `Record<CatalogKey, string>` makes a missing key a
// compile error on top of the parity test.
const catalogs: Record<Locale, Record<CatalogKey, string>> = { en, es }

/** Replaces `{name}` placeholders; unknown placeholders are left as they are. */
export function interpolate(message: string, params: MessageParams): string {
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder
  )
}

/**
 * Own catalogs instead of `chrome.i18n`, which follows the browser language
 * and cannot switch at runtime. `public/_locales` only holds the store name
 * and description.
 *
 * Plurals without ICU: a plural message is stored as `<key>_one` and
 * `<key>_other`; `t(key, { count })` asks `Intl.PluralRules` for the
 * category and falls back to `_other` for categories a catalog does not
 * carry (Spanish `many`, for example).
 */
export function createTranslator(locale: Locale): Translate {
  const catalog: Readonly<Record<string, string>> = catalogs[locale]
  const pluralRules = new Intl.PluralRules(locale)

  const lookup = (key: string, params: MessageParams | undefined): string => {
    if (Object.hasOwn(catalog, key)) return catalog[key] as string
    const count = params?.count
    const form = typeof count === 'number' ? pluralRules.select(count) : 'other'
    return catalog[`${key}_${form}`] ?? catalog[`${key}_other`] ?? key
  }

  return ((key: string, params?: MessageParams) => {
    const message = lookup(key, params)
    return params ? interpolate(message, params) : message
  }) as Translate
}
