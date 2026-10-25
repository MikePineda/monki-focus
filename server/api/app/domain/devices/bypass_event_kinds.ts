// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * What a bypass event can say, as stable reason codes the dashboard and
 * the guardian's notifications translate. Devices report the client kinds
 * (openapi.yaml `BypassEvent.kind`); only the server raises the server
 * kinds, so a device can neither fake nor pre-empt them.
 */

/** Reported by devices through `POST /device/bypass-events`. */
export const CLIENT_BYPASS_KINDS = [
  /** The user took the emergency exit after the wait (always visible). */
  'emergency_override',
  /** Android: the accessibility service was turned off or unbound. */
  'accessibility_disabled',
  /** Android: device admin was turned off outside the exit flow. */
  'device_admin_disabled',
  /** Android: usage access was revoked. */
  'usage_access_revoked',
  /** macOS: the accessibility (AX) permission was revoked. */
  'accessibility_permission_revoked',
  /** "Exit and unlink" finished: a neutral notice, never a warning. */
  'protection_ended',
  /** The browser extension was removed or disabled. */
  'extension_removed',
  /** A browser the protection does not cover was used. */
  'browser_unsupported',
  /** The wall clock or the time zone was changed, or automatic time turned off. */
  'time_changed',
  'timezone_changed',
  'clock_changed',
  /** A signed time token lowered the trusted-time floor (unlock-tokens.md §6). */
  'time_floor_lowered',
  /** The local policy no longer matches the last signed one. */
  'policy_hash_mismatch',
] as const

/** Raised by the server itself. */
export const SERVER_BYPASS_KINDS = [
  /** Dead-man switch: no heartbeat for the device's threshold. */
  'heartbeat_missing',
  /** The device reported again after a `heartbeat_missing` (low priority). */
  'heartbeat_resumed',
  /**
   * A heartbeat turned protection off: from then on the dead-man switch no
   * longer watches the device, so the guardian hears of the switch itself.
   */
  'protection_disabled',
  /** The device pins a key this instance does not publish (unlock-tokens.md §2). */
  'key_pin_mismatch',
  /** A new device was enrolled on the account. */
  'device_enrolled',
  /** The user revoked a device from the dashboard. */
  'device_revoked',
] as const

export type ClientBypassKind = (typeof CLIENT_BYPASS_KINDS)[number]
export type ServerBypassKind = (typeof SERVER_BYPASS_KINDS)[number]
export type BypassKind = ClientBypassKind | ServerBypassKind

export type BypassSource = 'client' | 'server'

export function isClientBypassKind(value: unknown): value is ClientBypassKind {
  return typeof value === 'string' && (CLIENT_BYPASS_KINDS as readonly string[]).includes(value)
}
