// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { errors as lucidErrors } from '@adonisjs/lucid'
import Clock from '#services/clock'
import { CodedError } from '#exceptions/coded_error'
import UnlockDecisions, { type DecisionOutcome } from '#services/unlock/unlock_decisions'
import UnlockRequestQueries from '#services/unlock/unlock_request_queries'
import {
  approveUnlockRequestValidator,
  listUnlockRequestsValidator,
} from '#validators/unlock_requests'

/**
 * A guardian's side of unlock requests (session + CSRF): the list, and
 * approve or deny from the dashboard (`decided_via: web`). Only through a
 * link that grants guardianship, with two-step verification on: anything
 * else is a 404, a request already decided or expired a 409.
 */
@inject()
export default class GuardianUnlockRequestsController {
  constructor(
    protected clock: Clock,
    protected decisions: UnlockDecisions,
    protected queries: UnlockRequestQueries
  ) {}

  /** GET /guardian/unlock-requests[?status=pending]. */
  async index({ auth, request, response }: HttpContext) {
    const { status } = await request.validateUsing(listUnlockRequestsValidator, {
      data: request.qs(),
    })
    const requests = await this.queries.forGuardian(
      auth.use('web').getUserOrFail(),
      status === 'pending',
      this.clock.now()
    )
    response.header('Cache-Control', 'no-store')
    return { requests }
  }

  /** POST /guardian/unlock-requests/:uuid/approve `{ minutes? }`, capped by the link. */
  async approve({ auth, params, request }: HttpContext) {
    const { minutes } = await request.validateUsing(approveUnlockRequestValidator)
    const outcome = await this.decisions.decideFromWeb(
      auth.use('web').getUserOrFail(),
      params.uuid,
      'approve',
      minutes,
      this.clock.now()
    )
    return answer(outcome)
  }

  /** POST /guardian/unlock-requests/:uuid/deny. */
  async deny({ auth, params }: HttpContext) {
    const outcome = await this.decisions.decideFromWeb(
      auth.use('web').getUserOrFail(),
      params.uuid,
      'deny',
      undefined,
      this.clock.now()
    )
    return answer(outcome)
  }
}

function answer(outcome: DecisionOutcome) {
  if (!outcome.ok) {
    if (outcome.reason === 'not_found') throw new lucidErrors.E_ROW_NOT_FOUND()
    throw new CodedError('E_UNLOCK_REQUEST_CLOSED', 409, 'The request was already decided')
  }
  return {
    request: {
      uuid: outcome.request.uuid,
      status: outcome.request.status,
      grantedMinutes: outcome.request.grantedMinutes,
      decidedVia: outcome.request.decidedVia,
    },
  }
}
