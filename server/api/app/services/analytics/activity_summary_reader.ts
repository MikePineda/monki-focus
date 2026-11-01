// SPDX-License-Identifier: AGPL-3.0-or-later
import db from '@adonisjs/lucid/services/db'
import type { SyncBlock } from '@monki-focus/analytics'
import type User from '#models/user'
import { summariseActivity } from '#domain/analytics/activity_summary'
import { localDateRange } from '#domain/analytics/local_date_range'
import { ACTIVITY_BLOCKS_TABLE } from '#services/analytics/activity_block_ingest'

interface BlockRow {
  device_id: number
  block_start: Date
  activity_key: string | null
  category_path: string
  level: SyncBlock['level']
  source: SyncBlock['source']
  seconds: number
}

/**
 * The signed-in user's activity over `days` local dates from `start`, in
 * the user's time zone, across all their devices. Rows are read through the
 * owner only (`user_id`), so another user's blocks never reach a summary.
 */
export default class ActivitySummaryReader {
  async summary(user: User, start: string, days: number) {
    const range = localDateRange(start, days, user.timeZone)
    const rows = (await db
      .from(ACTIVITY_BLOCKS_TABLE)
      .where('user_id', user.id)
      .where('block_start', '>=', range.from.toJSDate())
      .where('block_start', '<', range.to.toJSDate())
      .select(
        'device_id',
        'block_start',
        'activity_key',
        'category_path',
        'level',
        'source',
        'seconds'
      )) as BlockRow[]

    const blocks: SyncBlock[] = rows.map((row) => ({
      deviceId: String(row.device_id),
      blockStart: row.block_start.toISOString().replace('.000Z', 'Z'),
      activityKey: row.activity_key,
      categoryPath: row.category_path,
      level: row.level,
      source: row.source,
      seconds: row.seconds,
    }))
    return {
      timeZone: user.timeZone,
      ...summariseActivity(blocks, range.dates, user.timeZone),
    }
  }
}
