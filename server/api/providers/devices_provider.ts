// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApplicationService } from '@adonisjs/core/types'
// Safe to load before the app boots: the module only holds the port and a no-op.
import { BypassAlerts, StoredOnlyBypassAlerts } from '#services/devices/bypass_alerts'

/**
 * Binds `BypassAlerts`, the port new bypass events go through to reach the
 * guardian (app/services/devices/bypass_alerts.ts). Until the notification
 * package (S6) rebinds it, events are only stored. Tests swap it for a
 * recording fake.
 */
export default class DevicesProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(BypassAlerts, () => new StoredOnlyBypassAlerts())
  }
}
