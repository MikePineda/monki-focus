// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locale } from './locale'

const formatters = new Map<Locale, Intl.NumberFormat>()

/** A number in the locale's digits and grouping ("12,345" / "12.345"). */
export function formatNumber(value: number, locale: Locale): string {
  let formatter = formatters.get(locale)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
    formatters.set(locale, formatter)
  }
  return formatter.format(value)
}
