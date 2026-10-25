// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ServerBypassKind } from '#domain/devices/bypass_event_kinds'

/**
 * Dedupe keys of `bypass_events`, unique per user. A device's own keys are
 * namespaced by source and device (`c:<device uuid>:<key>`), the server's
 * by source and kind (`s:<kind>:...`): a device can never store a key the
 * server will use, so it cannot pre-empt (and silence) a dead-man or
 * key-pin alert, and two devices of the user never collide.
 */

/** What a device may send as `dedupeKey` (a uuid, a counter, a code). */
export const CLIENT_DEDUPE_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,96}$/

export function clientDedupeKey(deviceUuid: string, key: string): string {
  if (!CLIENT_DEDUPE_KEY_PATTERN.test(key)) throw new RangeError('Not a client dedupe key')
  return `c:${deviceUuid}:${key}`
}

export function serverDedupeKey(kind: ServerBypassKind, ...parts: Array<string | number>): string {
  return ['s', kind, ...parts].join(':')
}
