// SPDX-License-Identifier: AGPL-3.0-or-later
import { epochSecondsOf, instantOf, localTimeAt, utcInstantOf } from '@monki-focus/engine'
import type { IntentionSummary } from '../../shared/StatsContract'
import type { IntentionEntry, IntentionEntryKind } from '../storage/db'
import type { IntentionLog } from '../storage/IntentionLog'

/** A local day lasts at most 25 hours; read a little more and filter by date. */
const LOOKBACK_SECONDS = 27 * 3_600

/** Today's intention facts, counted by kind (optionally for one group). */
export interface IntentionDay {
  summary: IntentionSummary
  count(kind: IntentionEntryKind, group?: string): number
}

/**
 * Today's intentions in the pinned zone: `total` commitments, `kept`
 * (left in time), `broken` (extended) and `closes` (the gate closed).
 */
export class IntentionStatsQuery {
  constructor(private readonly log: Pick<IntentionLog, 'between'>) {}

  async today(nowMs: number, timeZone: string): Promise<IntentionDay> {
    const nowSeconds = epochSecondsOf(instantOf(nowMs))
    const date = localTimeAt(nowSeconds, timeZone).localDate
    const entries = (
      await this.log.between(
        utcInstantOf(nowSeconds - LOOKBACK_SECONDS),
        utcInstantOf(nowSeconds + 1)
      )
    ).filter((entry) => localTimeAt(epochSecondsOf(entry.at), timeZone).localDate === date)
    const count = (kind: IntentionEntryKind, group?: string) =>
      entries.filter(
        (entry: IntentionEntry) =>
          entry.kind === kind && (group === undefined || entry.group === group)
      ).length
    return {
      summary: {
        total: count('committed'),
        kept: count('kept'),
        broken: count('broken'),
        closes: count('closed'),
      },
      count,
    }
  }
}
