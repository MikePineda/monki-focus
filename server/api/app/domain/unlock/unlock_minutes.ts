// SPDX-License-Identifier: AGPL-3.0-or-later
import { UNLOCK_MAX_DURATION_SECONDS } from '@monki-focus/protocol'

/**
 * How long an approved unlock lasts. The guardian may grant less than the
 * device asked for, never more than the link's `max_unlock_minutes`, and
 * nothing goes past the ceiling: the protocol's 120-minute `dur_s` cap and
 * the instance's token lifetime (`dur_s` must fit in `exp - iat`).
 */
export function grantedMinutes(input: {
  readonly requested: number
  /** What the guardian chose when approving from the dashboard, if anything. */
  readonly approved?: number
  readonly linkMax: number
  readonly ceiling: number
}): number {
  const wanted = input.approved ?? input.requested
  return Math.max(1, Math.min(wanted, input.linkMax, input.ceiling))
}

/** The longest unlock (minutes) a token of `lifetimeCapSeconds` can carry. */
export function minutesCeiling(lifetimeCapSeconds: number): number {
  return Math.floor(Math.min(lifetimeCapSeconds, UNLOCK_MAX_DURATION_SECONDS) / 60)
}
