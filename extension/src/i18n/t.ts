// SPDX-License-Identifier: AGPL-3.0-or-later
import en from './catalogs/en.json'
import es from './catalogs/es.json'
import type { Locale } from './locale'

/** Message keys are generated from the English catalog. */
export type MessageKey = keyof typeof en
export type MessageParams = Readonly<Record<string, string | number>>
export type Translate = (key: MessageKey, params?: MessageParams) => string

// Typing every catalog as `Record<MessageKey, string>` makes a missing key a
// compile error on top of the parity test.
const catalogs: Record<Locale, Record<MessageKey, string>> = { en, es }

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
 */
export function createTranslator(locale: Locale): Translate {
  const catalog = catalogs[locale]
  return (key, params) => (params ? interpolate(catalog[key], params) : catalog[key])
}
