// SPDX-License-Identifier: AGPL-3.0-or-later
import vine from '@vinejs/vine'
import { BLOCK_SECONDS } from '@monki-focus/analytics'
import type { FieldContext } from '@vinejs/vine/types'
import { LOCAL_DATE_PATTERN, isLocalDate } from '#services/analytics/local_date_range'

/** At most 500 blocks per batch (openapi.yaml `ActivityBlockBatch`, the rules `BlockList`). */
export const MAX_ACTIVITY_BATCH = 500

/** UTC, minutes a multiple of 5, no seconds (SEMANTICS.md §10.6). */
const BLOCK_START = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-5][05]:00Z$/
/** A normalised domain or an app id: never a URL, a path or a title. */
const ACTIVITY_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/
const CATEGORY_PATH = /^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/

/**
 * POST /device/activity-blocks (`ActivityBlockBatch`). The device id comes
 * from the token, never from the body. Failures answer 422 with field paths
 * and rule names only, never the values (activity keys stay out of errors).
 */
export const activityBlocksValidator = vine.create({
  blocks: vine
    .array(
      vine.object({
        blockStart: vine.string().regex(BLOCK_START),
        activityKey: vine.string().regex(ACTIVITY_KEY).nullable(),
        categoryPath: vine.string().maxLength(96).regex(CATEGORY_PATH),
        level: vine.enum([0, 25, 50, 75, 100] as const),
        source: vine.enum(['web', 'app', 'android'] as const),
        seconds: vine.number({ strict: true }).withoutDecimals().min(1).max(BLOCK_SECONDS),
      })
    )
    .minLength(1)
    .maxLength(MAX_ACTIVITY_BATCH),
})

const realDate = vine.createRule((value: unknown, _: undefined, field: FieldContext) => {
  if (typeof value !== 'string' || !isLocalDate(value)) {
    field.report('The {{ field }} field must be a calendar date', 'date', field)
  }
})

function localDate() {
  return vine.string().regex(LOCAL_DATE_PATTERN).use(realDate())
}

/** GET /analytics/day?date=YYYY-MM-DD. */
export const analyticsDayValidator = vine.create({ date: localDate() })

/** GET /analytics/week?start=YYYY-MM-DD (seven local dates from `start`). */
export const analyticsWeekValidator = vine.create({ start: localDate() })
