// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Clock from '#services/clock'
import ActivityBlockIngest from '#services/analytics/activity_block_ingest'
import { activityBlocksValidator } from '#validators/activity_blocks'

/**
 * POST /device/activity-blocks (`reportActivityBlocks`): a device's
 * 5-minute blocks, upserted idempotently. Bearer device token only; the
 * device comes from the token, never from the body.
 */
@inject()
export default class DeviceActivityBlocksController {
  constructor(
    protected clock: Clock,
    protected ingest: ActivityBlockIngest
  ) {}

  async store({ auth, request }: HttpContext) {
    const device = auth.use('device').getUserOrFail()
    const { blocks } = await request.validateUsing(activityBlocksValidator)
    return this.ingest.ingest(device, blocks, this.clock.now())
  }
}
