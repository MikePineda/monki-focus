// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Outcome } from '#domain/outcome'
import {
  checkDetails,
  type BypassDetails,
  type DetailRule,
  type DetailsProblem,
} from '#domain/devices/bypass_event_details'

/**
 * The server events a guardian link writes to the ward's bypass log
 * (`source = 'server'`, dedupe keys in the `s:` namespace), and the
 * `details` each may carry: the same strict per-kind allowlist as the
 * client kinds, enum values and bounded integers only, so no name, email,
 * topic or id of the other person can ever be stored there.
 */
export const GUARDIAN_EVENT_KINDS = [
  /** The ward confirmed a guardian: the link is active. */
  'guardian_linked',
  /** The ward asked to leave; the link ends after the cooldown. */
  'guardian_revocation_requested',
  /** The ward withdrew that request. */
  'guardian_revocation_cancelled',
  /** The link ended (the guardian left, the cooldown ran out, an account was deleted). */
  'guardian_unlinked',
  /** The ward rotated the link's ntfy topic (the guardian must subscribe again). */
  'guardian_topic_rotated',
] as const

export type GuardianEventKind = (typeof GUARDIAN_EVENT_KINDS)[number]

export const GUARDIAN_EVENT_DETAIL_RULES: Readonly<
  Record<GuardianEventKind, Readonly<Record<string, DetailRule>>>
> = {
  guardian_linked: {},
  guardian_revocation_requested: {
    /** The cooldown the request waits (WARD_REVOCATION_COOLDOWN_HOURS: 0-168). */
    cooldownHours: { type: 'integer', min: 0, max: 168 },
  },
  guardian_revocation_cancelled: {},
  guardian_unlinked: {
    endedBy: { type: 'enum', values: ['ward', 'guardian'] },
    reason: { type: 'enum', values: ['revoked', 'account_deleted'] },
  },
  guardian_topic_rotated: {},
}

export function checkGuardianEventDetails(
  kind: GuardianEventKind,
  value: unknown
): Outcome<BypassDetails, DetailsProblem> {
  return checkDetails(GUARDIAN_EVENT_DETAIL_RULES[kind], value)
}
