// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `nextEscalation(state, event, now, guardianLinked) → {state, effects}`
 * (SEMANTICS.md §7.3). One state per target group. An event that does not
 * apply in the current phase leaves the state unchanged; every event that
 * changes it sets `lastActivityAt = now`.
 */
import type {
  EscalationEffect,
  EscalationEvent,
  EscalationState,
  Gate,
  Instant,
  UtcInstant,
} from '@monki-focus/rules'
import { sessionCounters } from './EscalationSession.ts'
import {
  MAX_ATTEMPT_COUNT,
  MAX_BROKEN_COUNT,
  extensionGate,
  fullGate,
  nextFrictionType,
} from './GateCalculator.ts'
import { epochSecondsOf, utcInstantOf } from './Instant.ts'

export interface EscalationResult {
  state: EscalationState
  effects: EscalationEffect[]
}

/** An intention of an extension (§7.3 `pause_elapsed` with `pendingExtension`). */
const EXTENSION_SECONDS = 300
/** Emergency override: wait, then grant (§7.3). */
const OVERRIDE_WAIT_SECONDS = 120
const OVERRIDE_SECONDS = 15 * 60
/** A typed intention needs at least this many words (§7.3 `commit`). */
const MIN_TYPED_WORDS = 3

/** Whether a timer has run out at `now` (a missing timer counts as run out). */
function hasPassed(timer: UtcInstant | null, nowSeconds: number): boolean {
  return timer === null || nowSeconds >= epochSecondsOf(timer)
}

function toIdle(state: EscalationState): EscalationState {
  return {
    ...state,
    phase: 'idle',
    gate: null,
    pauseEndsAt: null,
    pendingExtension: false,
    intentionExpiresAt: null,
    overrideReadyAt: null,
    overrideEndsAt: null,
  }
}

interface VisitOutcome {
  attemptCount: number
  brokenCount: number
  gate: Gate
}

/** Session check, one more attempt and the next gate: what a `visit` counts (§7.2, §7.3). */
export function visitOutcome(
  state: EscalationState,
  nowSeconds: number,
  guardianLinked: boolean
): VisitOutcome {
  const counters = sessionCounters(state, nowSeconds)
  const attemptCount = Math.min(counters.attemptCount + 1, MAX_ATTEMPT_COUNT)
  const frictionType = nextFrictionType(state.lastFrictionType)
  const gate = fullGate(attemptCount, counters.brokenCount, frictionType, guardianLinked)
  return { attemptCount, brokenCount: counters.brokenCount, gate }
}

/** The state a `visit` produces in a phase that accepts one (§7.3 `visit`). */
function visitedState(
  state: EscalationState,
  nowSeconds: number,
  guardianLinked: boolean
): EscalationState {
  const { attemptCount, brokenCount, gate } = visitOutcome(state, nowSeconds, guardianLinked)
  return {
    ...toIdle(state),
    phase: 'pausing',
    attemptCount,
    brokenCount,
    lastAttemptAt: utcInstantOf(nowSeconds),
    lastFrictionType: gate.frictionType,
    gate,
    pauseEndsAt: utcInstantOf(nowSeconds + gate.pauseSeconds),
  }
}

/** Whether a `visit` starts a new attempt in this state (§7.3: reloading never resets a pause). */
export function acceptsVisit(state: EscalationState, nowSeconds: number): boolean {
  switch (state.phase) {
    case 'idle':
      return true
    case 'active':
      return hasPassed(state.intentionExpiresAt, nowSeconds)
    case 'override_active':
      return hasPassed(state.overrideEndsAt, nowSeconds)
    default:
      return false
  }
}

function extended(
  state: EscalationState,
  nowSeconds: number,
  guardianLinked: boolean
): EscalationState {
  const brokenCount = Math.min(state.brokenCount + 1, MAX_BROKEN_COUNT)
  const frictionType = nextFrictionType(state.lastFrictionType)
  const short = state.brokenCount < 2
  const gate = (short ? extensionGate : fullGate)(
    state.attemptCount,
    brokenCount,
    frictionType,
    guardianLinked
  )
  return {
    ...state,
    phase: 'pausing',
    brokenCount,
    lastFrictionType: frictionType,
    gate,
    pauseEndsAt: utcInstantOf(nowSeconds + gate.pauseSeconds),
    pendingExtension: short,
    intentionExpiresAt: null,
  }
}

function committed(
  state: EscalationState,
  event: Extract<EscalationEvent, { type: 'commit' }>,
  nowSeconds: number
): EscalationState | null {
  if (state.gate?.requiresTypedIntention === true && event.typedWords < MIN_TYPED_WORDS) return null
  if (state.gate?.requiresGuardianKey === true && !event.guardianKeyVerified) return null
  return {
    ...state,
    phase: 'active',
    gate: null,
    pauseEndsAt: null,
    intentionExpiresAt: utcInstantOf(nowSeconds + event.minutes * 60),
  }
}

/** The next state, or null when the event does not apply in the current phase. */
function transition(
  state: EscalationState,
  event: EscalationEvent,
  nowSeconds: number,
  guardianLinked: boolean
): EscalationState | null {
  const { phase } = state
  switch (event.type) {
    case 'visit':
      return acceptsVisit(state, nowSeconds)
        ? visitedState(state, nowSeconds, guardianLinked)
        : null
    case 'pause_elapsed':
      if (phase !== 'pausing' || !hasPassed(state.pauseEndsAt, nowSeconds)) return null
      return state.pendingExtension
        ? {
            ...state,
            phase: 'active',
            gate: null,
            pauseEndsAt: null,
            pendingExtension: false,
            intentionExpiresAt: utcInstantOf(nowSeconds + EXTENSION_SECONDS),
          }
        : { ...state, phase: 'asking' }
    case 'close':
      return ['pausing', 'asking', 'override_waiting'].includes(phase) ? toIdle(state) : null
    case 'commit':
      return phase === 'asking' ? committed(state, event, nowSeconds) : null
    case 'intention_expired':
      return phase === 'active' && hasPassed(state.intentionExpiresAt, nowSeconds)
        ? { ...state, phase: 'timed_out' }
        : null
    case 'leave':
      return phase === 'active' || phase === 'timed_out' ? toIdle(state) : null
    case 'extend':
      return phase === 'timed_out' ? extended(state, nowSeconds, guardianLinked) : null
    case 'emergency_request':
      return ['idle', 'pausing', 'asking', 'timed_out'].includes(phase)
        ? {
            ...state,
            phase: 'override_waiting',
            overrideReadyAt: utcInstantOf(nowSeconds + OVERRIDE_WAIT_SECONDS),
          }
        : null
    case 'emergency_wait_elapsed':
      return phase === 'override_waiting' && hasPassed(state.overrideReadyAt, nowSeconds)
        ? {
            ...state,
            phase: 'override_active',
            overrideEndsAt: utcInstantOf(nowSeconds + OVERRIDE_SECONDS),
          }
        : null
    case 'emergency_expired':
      return phase === 'override_active' && hasPassed(state.overrideEndsAt, nowSeconds)
        ? toIdle(state)
        : null
  }
}

export function nextEscalation(
  state: EscalationState,
  event: EscalationEvent,
  now: Instant,
  guardianLinked: boolean
): EscalationResult {
  const nowSeconds = epochSecondsOf(now)
  const next = transition(state, event, nowSeconds, guardianLinked)
  if (next === null) return { state, effects: [] }
  return {
    state: { ...next, lastActivityAt: utcInstantOf(nowSeconds) },
    effects: event.type === 'emergency_wait_elapsed' ? ['record_bypass'] : [],
  }
}
