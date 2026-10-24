// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TrackingBrowser } from './TrackingBrowser'

/**
 * Creates a periodic alarm unless one with the same period exists: creating
 * it on every service-worker start would restart its countdown, and a worker
 * woken more often than the period would then never see it fire.
 */
export async function ensureAlarm(
  alarms: Pick<TrackingBrowser['alarms'], 'get' | 'create'>,
  name: string,
  periodInMinutes: number
): Promise<void> {
  const existing = await alarms.get(name)
  if (existing?.periodInMinutes === periodInMinutes) return
  await alarms.create(name, { periodInMinutes })
}
