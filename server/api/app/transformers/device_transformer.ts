// SPDX-License-Identifier: AGPL-3.0-or-later
import type Device from '#models/device'

/**
 * A device as its user sees it in the dashboard. An allowlist: never a
 * token, a token hash, the internal id or the boot id. `pinnedKids` (what
 * the device reports) and `enrolledKids` (what it was given) are shown so
 * the user and, later, the guardian can compare them with the instance's
 * keys (`keyPinMismatch` flags a difference).
 */
export function deviceResource(device: Device) {
  return {
    uuid: device.uuid,
    name: device.name,
    platform: device.platform,
    clientVersion: device.clientVersion,
    status: device.revokedAt === null ? ('active' as const) : ('revoked' as const),
    protectionActive: device.protectionActive,
    a11yEnabled: device.a11yEnabled,
    riskState: device.riskState,
    deadmanHours: device.deadmanHours,
    enrolledKids: device.enrolledKids,
    pinnedKids: device.pinnedKids,
    keyPinMismatch: device.keyPinMismatch,
    clockOffsetMs: device.clockOffsetMs,
    lastSeenAt: device.lastSeenAt.toUTC().toISO(),
    announcedOfflineAt: device.announcedOfflineAt?.toUTC().toISO() ?? null,
    revokedAt: device.revokedAt?.toUTC().toISO() ?? null,
    createdAt: device.createdAt.toUTC().toISO(),
  }
}
