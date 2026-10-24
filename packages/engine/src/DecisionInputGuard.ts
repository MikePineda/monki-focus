// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Up-front checks of `decide`'s inputs (SEMANTICS.md §14): an invalid input
 * fails closed whichever path the decision would take, not only when a rule
 * happens to read it. Rule sets are schema-validated before they reach the
 * engine; this guards what changes at run time: the clock, the observation,
 * the escalation and unlock state, and the pinned zones.
 */
import type { DecisionState, Instant, Observation, Ruleset } from '@monki-focus/rules'
import { epochSecondsOf } from './Instant.ts'
import { zonesOf } from './PinnedTimeZones.ts'
import { assertResolvableTimeZone } from './ZonedTime.ts'

/** Observations arrive from adapters at run time, so their shape is checked, not assumed. */
function assertObservation(observation: Observation): void {
  const {
    kind,
    urlText,
    package: appPackage,
  } = observation as Partial<Record<'kind' | 'urlText' | 'package', unknown>>
  const valid =
    (kind === 'site' && typeof urlText === 'string') ||
    (kind === 'app' && typeof appPackage === 'string')
  if (!valid) throw new TypeError('Unknown or malformed observation')
}

function assertStateInstants(state: DecisionState): void {
  for (const unlock of state.unlocks) {
    epochSecondsOf(unlock.notBefore)
    epochSecondsOf(unlock.expiresAt)
  }
  for (const escalation of state.escalation) {
    const instants = [
      escalation.lastAttemptAt,
      escalation.lastActivityAt,
      escalation.pauseEndsAt,
      escalation.intentionExpiresAt,
      escalation.overrideReadyAt,
      escalation.overrideEndsAt,
    ]
    for (const instant of instants) if (instant !== null) epochSecondsOf(instant)
  }
}

/** Throws on the first invalid input; returns `now` in epoch seconds. */
export function guardDecisionInputs(
  ruleset: Ruleset,
  observation: Observation,
  state: DecisionState,
  now: Instant
): number {
  const nowSeconds = epochSecondsOf(now)
  for (const zone of zonesOf(ruleset)) assertResolvableTimeZone(zone)
  assertObservation(observation)
  assertStateInstants(state)
  return nowSeconds
}
