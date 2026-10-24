// SPDX-License-Identifier: AGPL-3.0-or-later
import { decide, instantOf, type RulesCatalog } from '@monki-focus/engine'
import type { EscalationState, Ruleset } from '@monki-focus/rules/pure'

const PHASES = new Set([
  'idle',
  'pausing',
  'asking',
  'active',
  'timed_out',
  'override_waiting',
  'override_active',
])
const FRICTION_TYPES = new Set(['countdown', 'breath', 'reflect', 'type-intention'])
const INSTANT_FIELDS = [
  'lastAttemptAt',
  'lastActivityAt',
  'pauseEndsAt',
  'intentionExpiresAt',
  'overrideReadyAt',
  'overrideEndsAt',
] as const
const STATE_FIELDS = new Set([
  'targetGroup',
  'phase',
  'attemptCount',
  'brokenCount',
  'lastFrictionType',
  'gate',
  'pendingExtension',
  ...INSTANT_FIELDS,
])
/** The schema's caps (`escalation.schema.json#state`). */
const MAX_ATTEMPTS = 1000
const MAX_BROKEN = 16
const MAX_PAUSE_SECONDS = 60
const MAX_PROVEN = 2000
/** Any page: the probe only makes `decide` run its input guard over the entry. */
const PROBE_URL = 'https://example.com/'

function isCount(value: unknown, max: number): boolean {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max
}

function isGate(value: unknown): boolean {
  if (value === null) return true
  if (typeof value !== 'object') return false
  const gate = value as Record<string, unknown>
  return (
    Object.keys(gate).length === 5 &&
    isCount(gate.level, 3) &&
    isCount(gate.pauseSeconds, MAX_PAUSE_SECONDS) &&
    FRICTION_TYPES.has(gate.frictionType as string) &&
    typeof gate.requiresTypedIntention === 'boolean' &&
    typeof gate.requiresGuardianKey === 'boolean'
  )
}

/** The shape of one stored entry (the parts the engine's guard does not read). */
export function hasEscalationShape(value: unknown): value is EscalationState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const state = value as Record<string, unknown>
  return (
    Object.keys(state).every((key) => STATE_FIELDS.has(key)) &&
    typeof state.targetGroup === 'string' &&
    state.targetGroup.length > 0 &&
    PHASES.has(state.phase as string) &&
    isCount(state.attemptCount, MAX_ATTEMPTS) &&
    isCount(state.brokenCount, MAX_BROKEN) &&
    (state.lastFrictionType === null || FRICTION_TYPES.has(state.lastFrictionType as string)) &&
    isGate(state.gate) &&
    typeof state.pendingExtension === 'boolean' &&
    INSTANT_FIELDS.every((field) => state[field] === null || typeof state[field] === 'string')
  )
}

/**
 * Whether a stored escalation entry may reach `decide`. The rules schema
 * validator compiles with `new Function`, which an MV3 service worker's CSP
 * forbids, so the shape is checked here and the instants by the engine's
 * own input guard: an entry is valid when `decide`, given only that entry,
 * does not fail closed where it does not fail closed without it.
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
