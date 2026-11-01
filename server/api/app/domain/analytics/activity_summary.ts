// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  capAcrossDevices,
  dailyTotals,
  pulse,
  type CategoryLevel,
  type Pulse,
  type SecondsByLevel,
  type SyncBlock,
} from '@monki-focus/analytics'

/** How many activity keys a summary lists. */
export const TOP_ACTIVITY_KEYS = 10

const LEVELS: readonly CategoryLevel[] = [0, 25, 50, 75, 100]

export interface DaySummary {
  readonly date: string
  readonly seconds: number
  readonly secondsByLevel: SecondsByLevel
  readonly pulse: Pulse
}

export interface CategoryTotal {
  readonly categoryPath: string
  readonly level: CategoryLevel
  readonly seconds: number
}

export interface ActivityKeyTotal extends CategoryTotal {
  readonly activityKey: string
}

export interface ActivitySummary {
  readonly seconds: number
  readonly secondsByLevel: SecondsByLevel
  readonly pulse: Pulse
  readonly days: readonly DaySummary[]
  readonly categories: readonly CategoryTotal[]
  readonly topActivityKeys: readonly ActivityKeyTotal[]
}

function emptyByLevel(): SecondsByLevel {
  return { '0': 0, '25': 0, '50': 0, '75': 0, '100': 0 }
}

function bySecondsThenName<T extends { seconds: number }>(name: (entry: T) => string) {
  return (a: T, b: T) => b.seconds - a.seconds || (name(a) < name(b) ? -1 : 1)
}

/**
 * The user's activity across every device over local `dates` in `timeZone`
 * (SEMANTICS.md §10.5–§10.9): blocks are capped at 300 s per block start
 * across devices first, then totalled per local date, per level and per
 * category, with the focus pulse and the top activity keys (blocks without
 * a key count in the totals, never in the top list). Dates without time
 * appear with zeros and a null pulse.
 */
export function summariseActivity(
  blocks: readonly SyncBlock[],
  dates: readonly string[],
  timeZone: string
): ActivitySummary {
  const capped = capAcrossDevices(blocks)
  const totalsByDate = new Map(
    dailyTotals(
      capped.map((block) => ({
        timestamp: block.blockStart,
        duration: block.seconds,
        level: block.level,
      })),
      timeZone
    ).map((day) => [day.date, day])
  )
  const days = dates.map(
    (date) =>
      totalsByDate.get(date) ?? { date, seconds: 0, secondsByLevel: emptyByLevel(), pulse: null }
  )

  const secondsByLevel = emptyByLevel()
  const categories = new Map<string, CategoryTotal>()
  const keys = new Map<string, ActivityKeyTotal>()
  for (const block of capped) {
    secondsByLevel[block.level] += block.seconds
    const category = `${block.level}|${block.categoryPath}`
    const known = categories.get(category)
    categories.set(category, {
      categoryPath: block.categoryPath,
      level: block.level,
      seconds: (known?.seconds ?? 0) + block.seconds,
    })
    if (block.activityKey === null) continue
    const key = `${category}|${block.activityKey}`
    const seen = keys.get(key)
    keys.set(key, {
      activityKey: block.activityKey,
      categoryPath: block.categoryPath,
      level: block.level,
      seconds: (seen?.seconds ?? 0) + block.seconds,
    })
  }

  const levelled = LEVELS.map((level) => ({ level, seconds: secondsByLevel[level] }))
  return {
    seconds: levelled.reduce((sum, entry) => sum + entry.seconds, 0),
    secondsByLevel,
    pulse: pulse(levelled),
    days,
    categories: [...categories.values()].sort(
      bySecondsThenName((entry: CategoryTotal) => entry.categoryPath)
    ),
    topActivityKeys: [...keys.values()]
      .sort(bySecondsThenName((entry: ActivityKeyTotal) => entry.activityKey))
      .slice(0, TOP_ACTIVITY_KEYS),
  }
}
