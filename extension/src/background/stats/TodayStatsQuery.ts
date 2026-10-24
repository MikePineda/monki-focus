// SPDX-License-Identifier: AGPL-3.0-or-later
import { pulse, UNCATEGORISED, type SyncBlock } from '@monki-focus/analytics'
import { epochSecondsOf, instantOf, localTimeAt, utcInstantOf } from '@monki-focus/engine'
import type { TodayStats, TopActivity } from '../../shared/StatsContract'
import type { BlockRepository } from '../storage/BlockRepository'
import { emptySecondsByLevel, levelIndexOf } from './LevelScale'
import { localTimeOfBlock } from './LocalDay'

export const TOP_ACTIVITIES = 5

/** A local day lasts at most 25 hours; read a little more and filter by date. */
const LOOKBACK_SECONDS = 27 * 3_600

function topActivities(blocks: readonly SyncBlock[]): TopActivity[] {
  const byKey = new Map<string, { seconds: number; byLevel: Map<number, number> }>()
  for (const block of blocks) {
    if (block.activityKey === null) continue
    const entry = byKey.get(block.activityKey) ?? { seconds: 0, byLevel: new Map() }
    entry.seconds += block.seconds
    entry.byLevel.set(block.level, (entry.byLevel.get(block.level) ?? 0) + block.seconds)
    byKey.set(block.activityKey, entry)
  }
  return [...byKey.entries()]
    .map(([activityKey, { seconds, byLevel }]) => {
      // The level with the most seconds; on a tie the lower (more distracting) one.
      const [level] = [...byLevel.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0] ?? [50]
      return { activityKey, seconds, level: levelIndexOf(level as SyncBlock['level']) }
    })
    .sort((a, b) => b.seconds - a.seconds || (a.activityKey < b.activityKey ? -1 : 1))
    .slice(0, TOP_ACTIVITIES)
}

/** `stats.today`: today's blocks in the pinned zone, summarised for the popup. */
export class TodayStatsQuery {
  constructor(private readonly blocks: Pick<BlockRepository, 'between'>) {}

  async run(nowMs: number, timeZone: string): Promise<TodayStats> {
    const nowSeconds = epochSecondsOf(instantOf(nowMs))
    const date = localTimeAt(nowSeconds, timeZone).localDate
    const candidates = await this.blocks.between(
      utcInstantOf(nowSeconds - LOOKBACK_SECONDS),
      utcInstantOf(nowSeconds + 1)
    )
    const today = candidates.filter(
      (block) => localTimeOfBlock(block.blockStart, timeZone).localDate === date
    )
    const levels = emptySecondsByLevel()
    let uncategorisedSeconds = 0
    for (const block of today) {
      if (block.categoryPath === UNCATEGORISED.categoryPath) uncategorisedSeconds += block.seconds
      else levels[levelIndexOf(block.level)] += block.seconds
    }
    return {
      date,
      pulse: pulse(today),
      totalSeconds: today.reduce((sum, block) => sum + block.seconds, 0),
      levels,
      uncategorisedSeconds,
      topActivities: topActivities(today),
      intentions: { total: 0, kept: 0, broken: 0, closes: 0 },
    }
  }
}
