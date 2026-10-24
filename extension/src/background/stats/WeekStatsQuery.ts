// SPDX-License-Identifier: AGPL-3.0-or-later
import { pulse, type PulseInput, type SyncBlock } from '@monki-focus/analytics'
import { epochSecondsOf, instantOf, localTimeAt, utcInstantOf } from '@monki-focus/engine'
import type { DailyPulse, HourlyCell, WeekStats } from '../../shared/StatsContract'
import type { BlockRepository } from '../storage/BlockRepository'
import { localDateOfDayNumber, localTimeOfBlock } from './LocalDay'

export const WEEK_DAYS = 7
/** Weeks the weekday × hour averages cover. */
export const HOURLY_WEEKS = 4

const DAY_SECONDS = 86_400

function sumSeconds(blocks: readonly PulseInput[]): number {
  return blocks.reduce((sum, block) => sum + block.seconds, 0)
}

function groupInto(groups: Map<number, SyncBlock[]>, key: number, block: SyncBlock): void {
  const group = groups.get(key)
  if (group) group.push(block)
  else groups.set(key, [block])
}

/**
 * `stats.week`: the pulse of each of the last seven local days and, over the
 * last four weeks, the average tracked seconds and the pulse per weekday and
 * local hour (the stats page heat map).
 */
export class WeekStatsQuery {
  constructor(private readonly blocks: Pick<BlockRepository, 'between'>) {}

  async run(nowMs: number, timeZone: string): Promise<WeekStats> {
    const nowSeconds = epochSecondsOf(instantOf(nowMs))
    const today = localTimeAt(nowSeconds, timeZone).dayNumber
    const firstHourlyDay = today - HOURLY_WEEKS * WEEK_DAYS + 1
    const candidates = await this.blocks.between(
      // One spare day covers the longest offset between UTC and local time.
      utcInstantOf(nowSeconds - (HOURLY_WEEKS * WEEK_DAYS + 1) * DAY_SECONDS),
      utcInstantOf(nowSeconds + 1)
    )

    const byDay = new Map<number, SyncBlock[]>()
    const byCell = new Map<number, SyncBlock[]>()
    for (const block of candidates) {
      const local = localTimeOfBlock(block.blockStart, timeZone)
      if (local.dayNumber < firstHourlyDay || local.dayNumber > today) continue
      groupInto(byDay, local.dayNumber, block)
      groupInto(byCell, local.weekday * 24 + Math.floor(local.minuteOfDay / 60), block)
    }

    const days: DailyPulse[] = []
    for (let day = today - WEEK_DAYS + 1; day <= today; day += 1) {
      const blocks = byDay.get(day) ?? []
      days.push({
        date: localDateOfDayNumber(day),
        pulse: pulse(blocks),
        totalSeconds: sumSeconds(blocks),
      })
    }
    const hourly: HourlyCell[] = []
    for (let weekday = 0; weekday < WEEK_DAYS; weekday += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        const blocks = byCell.get(weekday * 24 + hour) ?? []
        hourly.push({
          weekday,
          hour,
          averageSeconds: Math.round(sumSeconds(blocks) / HOURLY_WEEKS),
          pulse: pulse(blocks),
        })
      }
    }
    return { days, weeks: HOURLY_WEEKS, hourly }
  }
}
