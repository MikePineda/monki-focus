// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RuleMode, RuleSchedule, Target, Weekday } from '@monki-focus/rules/pure'
import { formatTimeOfDay } from '../../i18n/formatTime'
import type { Locale } from '../../i18n/locale'
import type { SimpleKey, Translate } from '../../i18n/t'
import { WEEKDAYS } from '../../ui/WeekdayPicker'

/** Catalog key of a surface's name (`surface.reddit.feed`); every bundled surface has one. */
export function surfaceNameKey(surface: string): SimpleKey {
  return `surface.${surface}` as SimpleKey
}

export function modeNameKey(mode: RuleMode): SimpleKey {
  return `rules.mode.${mode}` as SimpleKey
}

/** What a rule or category applies to, in words: a domain (and path), a surface or an app. */
export function targetLabel(target: Target, t: Translate): string {
  switch (target.kind) {
    case 'site':
      return target.path ? `${target.domain}${target.path}` : target.domain
    case 'surface':
      return t(surfaceNameKey(target.surface))
    case 'app':
      return target.package
  }
}

/** "Mon–Fri" for a run of three or more days, else "Sat, Sun"; "Every day" for all seven. */
export function daysLabel(days: readonly Weekday[], t: Translate): string {
  if (days.length === 7) return t('schedule.everyDay')
  const indices = WEEKDAYS.map((day, index) => (days.includes(day) ? index : -1)).filter(
    (index) => index >= 0
  )
  const first = indices[0]
  const last = indices.at(-1)
  const contiguous =
    first !== undefined && last !== undefined && last - first + 1 === indices.length
  const short = (index: number) => t(`weekday.${WEEKDAYS[index] as Weekday}.short`)
  if (contiguous && indices.length >= 3) {
    return t('schedule.dayRange', { from: short(first), to: short(last) })
  }
  return indices.map(short).join(', ')
}

/** "Always", "Work hours" or "Mon–Fri 9:00 AM–5:30 PM; Sat …". */
export function scheduleSummary(
  schedules: readonly RuleSchedule[],
  t: Translate,
  locale: Locale
): string {
  if (schedules.length === 0) return t('schedule.always')
  return schedules
    .map((schedule) =>
      'ref' in schedule
        ? t('schedule.workHours')
        : t('schedule.window', {
            days: daysLabel(schedule.days, t),
            start: formatTimeOfDay(schedule.start, locale),
            end: formatTimeOfDay(schedule.end, locale),
          })
    )
    .join('; ')
}
