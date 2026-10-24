// SPDX-License-Identifier: AGPL-3.0-or-later
import { BLOCK_SECONDS, toBlocks, type ActivityEvent } from '@monki-focus/analytics'
import { epochSecondsOf, instantOf, utcInstantOf, type RulesCatalog } from '@monki-focus/engine'
import type { Browser } from 'wxt/browser'
import type { BlockRepository } from '../storage/BlockRepository'
import type { EventRepository } from '../storage/EventRepository'
import type { Outbox } from '../storage/Outbox'
import { RAW_EVENT_RETENTION_DAYS, type Retention } from '../storage/Retention'
import type { AnalyticsRules } from './AnalyticsRules'
import { attributeEvent } from './EventAttribution'

/** Name of the aggregation alarm. */
export const AGGREGATE_ALARM = 'aggregate'

/** `browser.storage.local` key: block start up to which blocks are final. */
export const AGGREGATED_THROUGH_STORAGE_NAME = 'tracking.aggregatedThrough'

const DAY_SECONDS = 86_400
/** How far before the window an event may start and still reach into it. */
const EVENT_LOOKBACK_SECONDS = DAY_SECONDS

export interface AggregationJobDependencies {
  events: EventRepository
  blocks: BlockRepository
  outbox: Pick<Outbox, 'enqueueBlocks'>
  retention: Pick<Retention, 'purge'>
  local: Pick<Browser.storage.StorageArea, 'get' | 'set'>
  rules: () => Promise<AnalyticsRules>
  catalog: RulesCatalog
  deviceId: string
  bucketId: string
}

function blockFloor(epochSeconds: number): number {
  return Math.floor(epochSeconds / BLOCK_SECONDS) * BLOCK_SECONDS
}

/** The part of `event` at or after `fromSeconds` (or `null` when none is). */
function clipFrom(event: ActivityEvent, fromSeconds: number): ActivityEvent | null {
  const start = epochSecondsOf(event.timestamp)
  const end = start + event.duration
  if (end <= fromSeconds) return null
  if (start >= fromSeconds) return event
  return { ...event, timestamp: utcInstantOf(fromSeconds), duration: end - fromSeconds }
}

/**
 * Turns raw events into 5-minute blocks with the analytics core (`categorise`
 * then `toBlocks`) and keeps them in the block store; changed blocks go to
 * the outbox; raw events past retention are purged. Each run recomputes the
 * blocks from one block before the last run's watermark up to now, so heartbeats that
 * extended an event after the previous run are counted, and a second run
 * over the same events writes the same blocks. Runs never overlap.
 */
export class AggregationJob {
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly deps: AggregationJobDependencies) {}

  run(nowMs: number): Promise<void> {
    const run = this.queue.then(() => this.aggregate(nowMs))
    this.queue = run.catch(() => undefined)
    return run
  }

  private async aggregate(nowMs: number): Promise<void> {
    const { deps } = this
    const now = instantOf(nowMs)
    const nowSeconds = epochSecondsOf(now)
    const stored = (await deps.local.get(AGGREGATED_THROUGH_STORAGE_NAME))[
      AGGREGATED_THROUGH_STORAGE_NAME
    ]
    const watermark = typeof stored === 'string' ? epochSecondsOf(stored) - BLOCK_SECONDS : null
    const fromSeconds = blockFloor(
      Math.min(watermark ?? nowSeconds - RAW_EVENT_RETENTION_DAYS * DAY_SECONDS, nowSeconds)
    )
    const toSeconds = blockFloor(nowSeconds) + BLOCK_SECONDS

    const rules = await deps.rules()
    const events = await deps.events.between(
      deps.bucketId,
      utcInstantOf(fromSeconds - EVENT_LOOKBACK_SECONDS),
      utcInstantOf(toSeconds)
    )
    const attributed = events.flatMap((event) => {
      const clipped = clipFrom(event, fromSeconds)
      const result = clipped && attributeEvent(clipped, rules.categories, deps.catalog)
      return result ? [result] : []
    })
    const blocks = toBlocks(attributed, { deviceId: deps.deviceId, syncActivityKey: true })
    const changed = await deps.blocks.replaceRange(
      deps.deviceId,
      utcInstantOf(fromSeconds),
      utcInstantOf(toSeconds),
      blocks
    )
    await deps.outbox.enqueueBlocks(changed, now)
    await deps.local.set({
      [AGGREGATED_THROUGH_STORAGE_NAME]: utcInstantOf(blockFloor(nowSeconds)),
    })
    await deps.retention.purge(now)
  }
}
