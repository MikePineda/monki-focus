// SPDX-License-Identifier: AGPL-3.0-or-later
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Clock from '#services/clock'
import DeviceRegistry from '#services/devices/device_registry'
import EnrollmentCodeService from '#services/devices/enrollment_code_service'
import { publishedKeys } from '#services/devices/published_keys'
import { deviceResource } from '#transformers/device_transformer'
import { updateDeviceValidator } from '#validators/devices'

/**
 * The signed-in user's devices (dashboard, session + CSRF). Every `:uuid`
 * is looked up through the user: anyone else's device is a 404.
 */
@inject()
export default class DevicesController {
  constructor(
    protected devices: DeviceRegistry,
    protected codes: EnrollmentCodeService,
    protected clock: Clock
  ) {}

  /** GET /devices: active devices first, then revoked ones. */
  async index({ auth }: HttpContext) {
    const devices = await this.devices.list(auth.use('web').getUserOrFail())
    return { devices: devices.map(deviceResource) }
  }

  /**
   * POST /devices/enrollment-codes: 201 with the code (shown once, valid 10
   * minutes) and what the dashboard shows next to it and puts in the QR
   * code: the issuer and the kid of every published key, which the device
   * must find in its enrolment response before it pins anything.
   */
  async storeEnrollmentCode({ auth, response }: HttpContext) {
    const issued = await this.codes.create(auth.use('web').getUserOrFail(), this.clock.now())
    const keys = await publishedKeys()
    response.header('Cache-Control', 'no-store')
    return response.created({
      code: issued.code,
      expiresAt: issued.expiresAt.toUTC().toISO(),
      issuer: keys.keySet.issuer,
      kids: keys.kids,
    })
  }

  /** PATCH /devices/:uuid: `name`, `deadmanHours` (1-48). */
  async update({ auth, params, request }: HttpContext) {
    const changes = await request.validateUsing(updateDeviceValidator)
    const device = await this.devices.update(
      auth.use('web').getUserOrFail(),
      String(params.uuid),
      changes,
      this.clock.now()
    )
    return { device: deviceResource(device) }
  }

  /** DELETE /devices/:uuid: revokes it (its token stops working at once). */
  async destroy({ auth, params, response }: HttpContext) {
    await this.devices.revoke(
      auth.use('web').getUserOrFail(),
      String(params.uuid),
      this.clock.now()
    )
    return response.noContent()
  }
}
