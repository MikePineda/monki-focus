// SPDX-License-Identifier: AGPL-3.0-or-later
import db from '@adonisjs/lucid/services/db'
import type { DateTime } from 'luxon'
import type { CategoryLevel, ActivitySource } from '@monki-focus/analytics'
import type Device from '#models/device'
import { consumeActivityBatch } from '#services/devices/device_throttles'

export const ACTIVITY_BLOCKS_TABLE = 'activity_blocks'

/** openapi.yaml `ActivityBlock` without the device (the token names it). */
export interface ReportedActivityBlock {
  readonly blockStart: string
  readonly activityKey: string | null
  readonly categoryPath: string
  readonly level: CategoryLevel
  readonly source: ActivitySource
  readonly seconds: number
}

function identity(block: ReportedActivityBlock) {
  return JSON.stringify([block.blockStart, block.source, block.activityKey, block.categoryPath])
}

/**
 * `POST /device/activity-blocks`: upserts a device's blocks by
 * (device, block start, source, key, category). A re-sent block replaces
 * its level and seconds (a device re-sends the block it is still filling),
 * so the same batch twice adds no rows. Within a batch the last copy of a
 * block wins. `accepted` counts new rows, `updated` the rows replaced.
 * Activity keys are never logged.
 */
export default class ActivityBlockIngest {
  async ingest(device: Device, blocks: readonly ReportedActivityBlock[], now: DateTime) {
    await consumeActivityBatch(device.id)

    const unique = new Map<string, ReportedActivityBlock>()
    for (const block of blocks) unique.set(identity(block), block)

    const stamp = now.toJSDate()
    const rows = [...unique.values()].map((block) => ({
      user_id: device.userId,
      device_id: device.id,
      block_start: new Date(block.blockStart),
      source: block.source,
      activity_key: block.activityKey,
      category_path: block.categoryPath,
      level: block.level,
      seconds: block.seconds,
      created_at: stamp,
      updated_at: stamp,
    }))

    const result = (await db
      .table(ACTIVITY_BLOCKS_TABLE)
      .insert(rows)
      // Infers activity_blocks_identity_unique (NULLS NOT DISTINCT, so a null key conflicts too).
      .onConflict(['device_id', 'block_start', 'source', 'activity_key', 'category_path'])
      .merge(['level', 'seconds', 'updated_at'])
      // Postgres: xmax is 0 on a freshly inserted row, non-zero on an updated one.
      .returning(db.connection().knexRawQuery('(xmax = 0) AS inserted') as never)) as unknown as {
      inserted: boolean
    }[]

    const accepted = result.filter((row) => row.inserted).length
    return { accepted, updated: result.length - accepted }
  }
}
