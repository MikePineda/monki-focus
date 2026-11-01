// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import { formatRfc3339Utc, UUID_PATTERN } from '@monki-focus/protocol'
import Clock from '#services/clock'
import { DeviceApiError } from '#exceptions/device_api_error'
import { checkUnlockScope } from '#domain/unlock/unlock_scope'
import UnlockRequestCreation from '#services/unlock/unlock_request_creation'
import DeviceUnlockRequests, { serverTime } from '#services/unlock/device_unlock_requests'
import {
  createUnlockRequestValidator,
  pollUnlockRequestValidator,
} from '#validators/unlock_requests'

/**
 * The device's unlock requests (packages/protocol/openapi.yaml `unlocks`):
 * Bearer device token, contract errors `{ code, fields? }`, every lookup
 * scoped to the calling device (404 otherwise). Responses carrying a
 * token are `no-store`; tokens, scopes and reasons are never logged.
 */
@inject()
export default class DeviceUnlockRequestsController {
  constructor(
    protected clock: Clock,
    protected requests: DeviceUnlockRequests
  ) {}

  /** POST /device/unlock-requests (`createUnlockRequest`). */
  @inject()
  async store({ auth, request, response }: HttpContext, creation: UnlockRequestCreation) {
    const device = auth.use('device').getUserOrFail()
    const body = await request.validateUsing(createUnlockRequestValidator)
    const scope = checkUnlockScope(body.scope)
    if (!scope.ok) throw new DeviceApiError('validation_failed', 422, { scope: scope.reason })

    const created = await creation.create(
      device,
      { ruleId: body.ruleId, scope: scope.value, minutes: body.minutes, reason: body.reason },
      this.clock.now()
    )
    return response.created({
      uuid: created.uuid,
      status: created.status,
      requestedMinutes: created.requestedMinutes,
      createdAt: formatRfc3339Utc(Math.floor(created.createdAt.toSeconds())),
      expiresAt: formatRfc3339Utc(Math.floor(created.expiresAt.toSeconds())),
    })
  }

  /** GET /device/unlock-requests/:uuid (`pollUnlockRequest`), `?wait=` up to 25 s. */
  async show({ auth, params, request, response }: HttpContext) {
    const device = auth.use('device').getUserOrFail()
    const query = await request.validateUsing(pollUnlockRequestValidator, { data: request.qs() })
    const answer = await this.requests.poll(device, params.uuid, query.wait ?? 0, () =>
      this.clock.now()
    )
    const now = this.clock.now()
    let timeToken: string | undefined
    if (query.nonce && query.boot) {
      const issuance = await app.container.make('tokenIssuance')
      const issued = await issuance.issueTime({
        deviceUuid: device.uuid,
        nonce: query.nonce,
        boot: query.boot,
      })
      if (issued.ok) timeToken = issued.value.token
    }
    response.header('Cache-Control', 'no-store')
    return { ...answer, serverTime: serverTime(now), ...(timeToken ? { timeToken } : {}) }
  }

  /** DELETE /device/unlock-requests/:uuid (`cancelUnlockRequest`): 204, decided or not. */
  async destroy({ auth, params, response }: HttpContext) {
    const device = auth.use('device').getUserOrFail()
    await this.requests.cancel(device, params.uuid, this.clock.now())
    return response.noContent()
  }

  /** POST /device/unlock-tokens/:jti/consumed (`reportUnlockTokenConsumed`): 204; 404 if not its own. */
  async consumed({ auth, params, response }: HttpContext) {
    const device = auth.use('device').getUserOrFail()
    if (!UUID_PATTERN.test(params.jti)) throw new DeviceApiError('not_found', 404)
    const owned = await this.requests.markConsumed(device, params.jti, this.clock.now())
    if (!owned) throw new DeviceApiError('not_found', 404)
    return response.noContent()
  }
}
