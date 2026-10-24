// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Daily totals (SEMANTICS.md §10.7): intervals are split at local midnight
 * in the pinned time zone; per local date the total, the seconds by level
 * and the pulse. Only dates with time appear, ascending.
 */
import type {
  CategoryLevel,
  DailyTotal,
  LevelledInterval,
  SecondsByLevel,
} from '@monki-focus/rules'
import { compareCodeUnits } from './CodeUnitOrder.ts'
import { epochSecondsOf } from './Instant.ts'
import { localDateOf, nextLocalMidnight } from './LocalCalendar.ts'
import { pulse } from './PulseCalculator.ts'

const LEVELS: readonly CategoryLevel[] = [0, 25, 50, 75, 100]

function emptyByLevel(): SecondsByLevel {
  return { '0': 0, '25': 0, '50': 0, '75': 0, '100': 0 }
}

export function dailyTotals(entries: readonly LevelledInterval[], timeZone: string): DailyTotal[] {
  const days = new Map<string, SecondsByLevel>()
  for (const entry of entries) {
    let cursor = epochSecondsOf(entry.timestamp)
    const end = cursor + entry.duration
    while (cursor < end) {
      const pieceEnd = Math.min(nextLocalMidnight(cursor, timeZone), end)
      const date = localDateOf(cursor, timeZone)
      const byLevel = days.get(date) ?? emptyByLevel()
      byLevel[entry.level] += pieceEnd - cursor
      days.set(date, byLevel)
      cursor = pieceEnd
    }
  }
  return [...days.entries()]
    .sort(([a], [b]) => compareCodeUnits(a, b))
    .map(([date, secondsByLevel]) => {
      const levelled = LEVELS.map((level) => ({ level, seconds: secondsByLevel[level] }))
      return {
        date,
        seconds: levelled.reduce((sum, entry) => sum + entry.seconds, 0),
        secondsByLevel,
        pulse: pulse(levelled),
      }
    })
}
