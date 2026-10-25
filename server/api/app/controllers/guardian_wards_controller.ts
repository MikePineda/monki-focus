// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Clock from '#services/clock'
import GuardianSummaryService from '#services/guardians/guardian_summary_service'

/** What a guardian reads of a ward: the summary DTO, only through an active link. */
@inject()
export default class GuardianWardsController {
  constructor(
    protected summaries: GuardianSummaryService,
    protected clock: Clock
  ) {}

  /** GET /guardian/wards/:wardUserId/summary: score, unlocks and bypasses; 404 without a link. */
  async summary({ auth, params, response }: HttpContext) {
    const summary = await this.summaries.build(
      auth.use('web').getUserOrFail(),
      Number(params.wardUserId),
      this.clock.now()
    )
    response.header('Cache-Control', 'no-store')
    return summary
  }
}
