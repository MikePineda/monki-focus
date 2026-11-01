// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApplicationService } from '@adonisjs/core/types'
// Safe to load before the app boots: the modules only hold the ports.
import { BypassAlerts } from '#services/devices/bypass_alerts'
import { NtfyPublisher } from '#services/notify/ntfy_publisher'

/**
 * Binds the notification ports:
 *
 * - `BypassAlerts` (new bypass events to the guardian): the ntfy outbox
 *   (app/services/notify/outbox_bypass_alerts.ts).
 * - `NtfyPublisher`: the HTTP client to NTFY_BASE_URL with
 *   NTFY_PUBLISH_TOKEN. Under Japa it is an unconfigured one, so no test
 *   ever reaches a real ntfy by accident; tests swap in a recording fake
 *   (and the one integration test builds the HTTP client itself).
 */
export default class DevicesProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(BypassAlerts, async () => {
      const { OutboxBypassAlerts } = await import('#services/notify/outbox_bypass_alerts')
      return new OutboxBypassAlerts()
    })
    this.app.container.singleton(NtfyPublisher, async () => {
      const { default: env } = await import('#start/env')
      const { HttpNtfyPublisher } = await import('#services/notify/ntfy_publisher')
      if (this.app.inTest) return new HttpNtfyPublisher(undefined, undefined)
      return new HttpNtfyPublisher(
        env.get('NTFY_BASE_URL'),
        env.get('NTFY_PUBLISH_TOKEN')?.release()
      )
    })
  }
}
