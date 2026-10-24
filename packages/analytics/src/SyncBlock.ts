// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The only analytics record that leaves a device (SEMANTICS.md §10.6): a
 * 5-minute block with exactly seven fields. It never carries a title, a URL
 * or a path; `activityKey` is a normalised domain or an app id, or `null`
 * when the user turned key sync off. `toSyncBlock` is the single door every
 * block goes through: it copies the allowed fields only and rejects values
 * that do not fit the schema (a URL passed as a key, an unaligned start).
 */
import type { ActivityBlock } from '@monki-focus/rules'
import { compareCodeUnits, compareNullableCodeUnits } from './CodeUnitOrder.ts'

export type SyncBlock = ActivityBlock

/** Seconds in a block, and the cap on one block start. */
export const BLOCK_SECONDS = 300

export const SYNC_BLOCK_FIELDS = [
  'deviceId',
  'blockStart',
  'activityKey',
  'categoryPath',
  'level',
  'source',
  'seconds',
] as const satisfies readonly (keyof SyncBlock)[]

const DEVICE_ID = /^[A-Za-z0-9_-]{1,64}$/
const BLOCK_START = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-5][05]:00Z$/
const ACTIVITY_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/
const CATEGORY_PATH = /^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/
const LEVELS: readonly number[] = [0, 25, 50, 75, 100]
const SOURCES: readonly string[] = ['web', 'app', 'android']

/** Copies the seven block fields (nothing else) after checking each one. */
export function toSyncBlock(fields: SyncBlock): SyncBlock {
  const block: SyncBlock = {
    deviceId: fields.deviceId,
    blockStart: fields.blockStart,
    activityKey: fields.activityKey,
    categoryPath: fields.categoryPath,
    level: fields.level,
    source: fields.source,
    seconds: fields.seconds,
  }
  const checks: [keyof SyncBlock, boolean][] = [
    ['deviceId', DEVICE_ID.test(block.deviceId)],
    ['blockStart', BLOCK_START.test(block.blockStart)],
    ['activityKey', block.activityKey === null || ACTIVITY_KEY.test(block.activityKey)],
    ['categoryPath', block.categoryPath.length <= 96 && CATEGORY_PATH.test(block.categoryPath)],
    ['level', LEVELS.includes(block.level)],
    ['source', SOURCES.includes(block.source)],
    [
      'seconds',
      Number.isInteger(block.seconds) && block.seconds >= 1 && block.seconds <= BLOCK_SECONDS,
    ],
  ]
  const invalid = checks.find(([, valid]) => !valid)
  if (invalid !== undefined) throw new RangeError(`Invalid sync block ${invalid[0]}`)
  return block
}

/**
 * Canonical block order: `blockStart`, `deviceId`, `activityKey` (null
 * first), `categoryPath`, then `source` and `level` so the order is total.
 * Within one block start it is also the remainder tie order (§10.9).
 */
export function compareSyncBlocks(a: SyncBlock, b: SyncBlock): number {
  return (
    compareCodeUnits(a.blockStart, b.blockStart) ||
    compareCodeUnits(a.deviceId, b.deviceId) ||
    compareNullableCodeUnits(a.activityKey, b.activityKey) ||
    compareCodeUnits(a.categoryPath, b.categoryPath) ||
    compareCodeUnits(a.source, b.source) ||
    a.level - b.level
  )
}
