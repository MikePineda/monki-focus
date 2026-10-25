// SPDX-License-Identifier: AGPL-3.0-or-later
import { decide, instantOf, type RulesCatalog } from '@monki-focus/engine'
import type { EscalationState, Ruleset } from '@monki-focus/rules/pure'
import { validateEscalationState } from 'virtual:monki-escalation-validator'

/** Entries proven valid before the cache starts over. */
const MAX_PROVEN = 2000
/** Any page: the probe only makes `decide` run its input guard over the entry. */
const PROBE_URL = 'https://example.com/'

/** One stored entry against `escalation.schema.json#/$defs/state` (precompiled at build time). */
export function hasEscalationShape(value: unknown): value is EscalationState {
  return validateEscalationState(value)
}

/**
 * Whether a stored escalation entry may reach `decide`. The shape is the
 * rules package's schema, compiled at build time like the rule set
 * validator (MV3 forbids Ajv's run-time `new Function`). The schema's
 * `date-time` format still admits instants the engine refuses (a leap
 * second), so an entry is then probed with the engine's own input guard:
 * it is valid when `decide`, given only that entry, does not fail closed
 * where it does not fail closed without it.
 */
export function escalationEntryGuard(
  catalog: RulesCatalog,
  rulesets: { load(): Promise<Ruleset> },
  now: () => number
): (entry: unknown) => Promise<boolean> {
  // Entries are read on every decision: remember the ones already proven valid.
  const proven = new Set<string>()
  return async (entry) => {
    if (!hasEscalationShape(entry)) return false
    const key = JSON.stringify(entry)
    if (proven.has(key)) return true
    const ruleset = await rulesets.load()
    const at = instantOf(now())
    const observation = { kind: 'site' as const, urlText: PROBE_URL }
    const empty = { escalation: [], usage: null, unlocks: [], guardianLinked: false }
    const base = decide(ruleset, observation, empty, at, catalog)
    if (base.reason === 'engine_error') return true
    const probed = decide(ruleset, observation, { ...empty, escalation: [entry] }, at, catalog)
    if (probed.reason === 'engine_error') return false
    if (proven.size >= MAX_PROVEN) proven.clear()
    proven.add(key)
    return true
  }
}
