// SPDX-License-Identifier: AGPL-3.0-or-later
import { formatNumber } from './formatNumber'
import type { Locale } from './locale'
import type { Translate } from './t'

/** Whole minutes of `seconds`, rounded to the nearest minute. */
export function minutesOf(seconds: number): number {
  return Math.round(seconds / 60)
}

/** "4 h 12 min" / "12 min" (catalog units, locale digits). */
export function formatDuration(seconds: number, t: Translate, locale: Locale): string {
  const total = minutesOf(seconds)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return t('duration.minutes', { minutes: formatNumber(minutes, locale) })
  return t('duration.hoursMinutes', {
    hours: formatNumber(hours, locale),
    minutes: formatNumber(minutes, locale),
  })
}
