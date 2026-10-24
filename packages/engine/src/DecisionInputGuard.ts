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

/** `decision-context.schema.json#/$defs/siteObservation`: `urlText` of 1…2048 characters. */
const MAX_URL_TEXT_LENGTH = 2048
/** `target.schema.json#/$defs/appPackage`: reverse-DNS package or bundle id. */
const APP_PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_][A-Za-z0-9_-]*)+$/
const MAX_APP_PACKAGE_LENGTH = 255
/** `target.schema.json#/$defs/surfaceId`. */
const SURFACE_ID = /^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/
const MAX_SURFACE_ID_LENGTH = 64

type ObservationFields = Partial<Record<'kind' | 'urlText' | 'package' | 'surface', unknown>>

function hasOnlyKeys(observation: object, keys: readonly string[]): boolean {
  return Object.keys(observation).every((key) => keys.includes(key))
}

function isSiteObservation(observation: ObservationFields): boolean {
  const { urlText } = observation
  return (
    hasOnlyKeys(observation, ['kind', 'urlText']) &&
    typeof urlText === 'string' &&
    urlText.length >= 1 &&
    urlText.length <= MAX_URL_TEXT_LENGTH
  )
}

function isAppObservation(observation: ObservationFields): boolean {
  const { package: appPackage, surface } = observation
  return (
    hasOnlyKeys(observation, ['kind', 'package', 'surface']) &&
    typeof appPackage === 'string' &&
    appPackage.length <= MAX_APP_PACKAGE_LENGTH &&
    APP_PACKAGE.test(appPackage) &&
    (surface === null ||
      (typeof surface === 'string' &&
        surface.length <= MAX_SURFACE_ID_LENGTH &&
        SURFACE_ID.test(surface)))
  )
}

/**
 * Observations arrive from adapters at run time, so they are checked against
 * their schema shape (§14): a schema-invalid observation fails closed.
 */
function assertObservation(observation: Observation): void {
  const fields = observation as ObservationFields
  const valid =
    (fields.kind === 'site' && isSiteObservation(fields)) ||
    (fields.kind === 'app' && isAppObservation(fields))
  if (!valid) throw new TypeError('Schema-invalid observation')
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
