// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { formatRfc3339Utc } from '@monki-focus/protocol'
import Clock from '#services/clock'
import { clientIp } from '#http/client_ip'
import DeviceEnrollment from '#services/devices/device_enrollment'
import HeartbeatService from '#services/devices/heartbeat_service'
import BypassEventReports from '#services/devices/bypass_event_reports'
import DeviceTokens from '#services/devices/device_tokens'
import { consumeTokenRotation } from '#services/devices/device_throttles'
import { checkBypassDetails } from '#domain/devices/bypass_event_details'
import { DeviceApiError } from '#exceptions/device_api_error'
import { bypassEventsValidator, enrollValidator, heartbeatValidator } from '#validators/device_api'

/**
 * The device API (packages/protocol/openapi.yaml): Bearer `mfd_…` tokens
 * through the `device` guard, no session, no cookie, no CSRF. Errors are
 * the contract's `{ code, fields? }`. Tokens, codes and nonces are never
 * logged; responses carrying a token are `no-store`.
 */
@inject()
export default class DeviceApiController {
  constructor(protected clock: Clock) {}

  /** POST /device/enroll (`enrollDevice`): 201, the token returned this once. */
  @inject()
  async enroll(ctx: HttpContext, enrollment: DeviceEnrollment) {
    const { request, response } = ctx
    const body = await request.validateUsing(enrollValidator)
    const now = this.clock.now()
    const enrolled = await enrollment.enroll(body, clientIp(ctx), now)
    response.header('Cache-Control', 'no-store')
    return response.created({
      deviceUuid: enrolled.device.uuid,
      token: enrolled.token,
      keys: enrolled.keys,
      serverTime: formatRfc3339Utc(Math.floor(now.toSeconds())),
    })
  }

  /** POST /device/heartbeat (`sendHeartbeat`). */
  @inject()
  async heartbeat({ auth, request, response }: HttpContext, heartbeats: HeartbeatService) {
    const device = auth.use('device').getUserOrFail()
    const body = await request.validateUsing(heartbeatValidator)
    const answer = await heartbeats.record(
      device,
      device.currentAccessToken!,
      body,
      this.clock.now()
    )
    response.header('Cache-Control', 'no-store')
    return answer
  }

  /** POST /device/bypass-events (`reportBypassEvents`): idempotent per dedupeKey. */
  @inject()
  async bypassEvents({ auth, request }: HttpContext, reports: BypassEventReports) {
    const device = auth.use('device').getUserOrFail()
    const { events } = await request.validateUsing(bypassEventsValidator)
    const checked = events.map((event, index) => {
      const details = checkBypassDetails(event.details)
      if (!details.ok) {
        throw new DeviceApiError('validation_failed', 422, {
          [`events.${index}.details`]: 'details',
        })
      }
      return { ...event, details: details.value }
    })
    return reports.report(device, checked, this.clock.now())
  }

  /** POST /device/token/rotate (`rotateDeviceToken`): 201, the new token returned this once. */
  @inject()
  async rotateToken({ auth, response }: HttpContext, tokens: DeviceTokens) {
    const device = auth.use('device').getUserOrFail()
    await consumeTokenRotation(device.id)
    const token = await tokens.rotate(device, device.currentAccessToken!, this.clock.now())
    response.header('Cache-Control', 'no-store')
    return response.created({ token })
  }
}
