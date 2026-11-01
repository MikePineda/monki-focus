// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import ActivitySummaryReader from '#services/analytics/activity_summary_reader'
import { analyticsDayValidator, analyticsWeekValidator } from '#validators/activity_blocks'

/**
 * The signed-in user's own activity across all their devices, in their
 * time zone (session only; a guardian never reaches these routes for a
 * ward, and the guardian summary never carries activity keys).
 */
@inject()
export default class AnalyticsController {
  constructor(protected reader: ActivitySummaryReader) {}

  /** GET /analytics/day?date=YYYY-MM-DD. */
  async day({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { date } = await analyticsDayValidator.validate(request.qs())
    response.header('Cache-Control', 'no-store')
    return this.reader.summary(user, date, 1)
  }

  /** GET /analytics/week?start=YYYY-MM-DD. */
  async week({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { start } = await analyticsWeekValidator.validate(request.qs())
    response.header('Cache-Control', 'no-store')
    return this.reader.summary(user, start, 7)
  }
}
