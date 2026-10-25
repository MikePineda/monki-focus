// SPDX-License-Identifier: AGPL-3.0-or-later
import { refuse, succeed, type Outcome } from '#domain/outcome'
import type { ClientBypassKind } from '#domain/devices/bypass_event_kinds'

/**
 * The `details` a device may attach to a bypass event. The guardian may see
 * them, so they are a strict **allowlist per kind**: only the keys listed
 * for the event's kind, each an enum value or a bounded integer. There is
 * no free string at all, so no domain, path, title, slug or sentence can be
 * smuggled in, whatever a modified client sends (anti-stalkerware rule,
 * SECURITY.md). Anything else is refused with the contract's validation
 * error; packages/protocol/openapi.yaml (`BypassEvent`) carries the same
 * table (tests/unit/devices/bypass_details_contract.spec.ts).
 */

export type DetailRule =
  | { readonly type: 'enum'; readonly values: readonly string[] }
  | { readonly type: 'integer'; readonly min: number; readonly max: number }

const YEAR_SECONDS = 365 * 24 * 3600

const DELTA_SECONDS: DetailRule = { type: 'integer', min: -YEAR_SECONDS, max: YEAR_SECONDS }

export const BYPASS_DETAIL_RULES: Readonly<
  Record<ClientBypassKind, Readonly<Record<string, DetailRule>>>
> = {
  emergency_override: {
    /** What was lifted: a rule's block or the bedtime lock, never which site. */
    scope: { type: 'enum', values: ['rule', 'bedtime'] },
    /** How long the user waited before the override was granted. */
    waitSeconds: { type: 'integer', min: 0, max: 3600 },
    /** How long the override lasts. */
    durationSeconds: { type: 'integer', min: 0, max: 86_400 },
  },
  accessibility_disabled: {},
  device_admin_disabled: {},
  usage_access_revoked: {},
  accessibility_permission_revoked: {},
  protection_ended: {},
  extension_removed: {},
  browser_unsupported: {},
  /** How far the wall clock jumped (positive: forward). */
  time_changed: { deltaSeconds: DELTA_SECONDS },
  timezone_changed: {},
  clock_changed: { deltaSeconds: DELTA_SECONDS },
  /** How far a signed time token lowered the trusted-time floor. */
  time_floor_lowered: { loweredBySeconds: { type: 'integer', min: 0, max: YEAR_SECONDS } },
  policy_hash_mismatch: {},
}

export type DetailValue = string | number
export type BypassDetails = Readonly<Record<string, DetailValue | boolean>>

export type DetailsProblem = 'not_an_object' | 'not_allowed' | 'bad_value'

export function checkBypassDetails(
  kind: ClientBypassKind,
  value: unknown
): Outcome<BypassDetails, DetailsProblem> {
  return checkDetails(BYPASS_DETAIL_RULES[kind], value)
}

/**
 * The allowlist check itself, for any table of per-key rules (the client
 * kinds above, the server's guardian-link kinds in
 * app/domain/guardians/guardian_event_details.ts): only listed keys, each
 * an enum value or a bounded integer.
 */
export function checkDetails(
  rules: Readonly<Record<string, DetailRule>>,
  value: unknown
): Outcome<BypassDetails, DetailsProblem> {
  if (value === undefined || value === null) return succeed({})
  if (typeof value !== 'object' || Array.isArray(value)) return refuse('not_an_object')

  const details: Record<string, DetailValue> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const rule = Object.hasOwn(rules, key) ? rules[key] : undefined
    if (rule === undefined) return refuse('not_allowed')
    if (!fits(rule, child)) return refuse('bad_value')
    details[key] = child as DetailValue
  }
  return succeed(details)
}

function fits(rule: DetailRule, value: unknown): boolean {
  if (rule.type === 'enum') return typeof value === 'string' && rule.values.includes(value)
  return (
    Number.isSafeInteger(value) && (value as number) >= rule.min && (value as number) <= rule.max
  )
}
