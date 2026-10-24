// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locale } from './locale'

/** 24-hour clock in Spanish, the locale's own clock in English (DESIGN.md). */
function hourCycle(locale: Locale): Intl.DateTimeFormatOptions {
  return locale === 'es' ? { hourCycle: 'h23' } : {}
}

/** A wall-clock `HH:MM` in the locale ("9:00 AM", "9:00"). */
export function formatTimeOfDay(time: string, locale: Locale): string {
  const [hours, minutes] = time.split(':').map(Number)
  const instant = Date.UTC(2026, 0, 5, hours ?? 0, minutes ?? 0)
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    ...hourCycle(locale),
  }).format(instant)
}

/** An instant as the user's local weekday, date and time in `timeZone` ("Tue, Oct 27, 12:00 AM"). */
export function formatInstantIn(instant: string, timeZone: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    ...hourCycle(locale),
  }).format(Date.parse(instant))
}

/** An instant (epoch ms) as a local time of day in `timeZone`. */
export function formatClockTime(epochMs: number, locale: Locale, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    ...(timeZone ? { timeZone } : {}),
    hour: 'numeric',
    minute: '2-digit',
    ...hourCycle(locale),
  }).format(epochMs)
}

/** A local date `YYYY-MM-DD` as a short weekday and day ("Mon 5"). */
export function formatLocalDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
  }).format(Date.parse(`${date}T12:00:00Z`))
}
