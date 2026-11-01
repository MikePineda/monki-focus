// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Clock from '#services/clock'
import UnlockRequestQueries from '#services/unlock/unlock_request_queries'
import { listUnlockRequestsValidator } from '#validators/unlock_requests'

/** The signed-in user's own unlock history (session + CSRF), newest first, paginated. */
@inject()
export default class UnlockRequestsController {
  constructor(
    protected clock: Clock,
    protected queries: UnlockRequestQueries
  ) {}

  /** GET /unlock-requests[?page=]. */
  async index({ auth, request, response }: HttpContext) {
    const { page } = await request.validateUsing(listUnlockRequestsValidator, {
      data: request.qs(),
    })
    response.header('Cache-Control', 'no-store')
    return this.queries.historyOf(auth.use('web').getUserOrFail(), page ?? 1, this.clock.now())
  }
}
