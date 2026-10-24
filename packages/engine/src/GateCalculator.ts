// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Gates (SEMANTICS.md §7.1): `level = min(attemptCount − 1, 3)`; base pause
 * L0 5 s, L1 15 s, L2 15 s, L3 15 s with a linked guardian and 60 s without;
 * `pauseSeconds = min(base << min(brokenCount, 4), 60)`. A typed intention
 * from L2, the guardian key only at L3 with a guardian. The friction type
 * rotates `countdown → breath → reflect → type-intention → countdown` and is
 * always the successor of the previous one, so it never repeats.
 */
import type { EscalationLevel, FrictionType, Gate } from '@monki-focus/rules'

export const MAX_ATTEMPT_COUNT = 1000
export const MAX_BROKEN_COUNT = 16
const MAX_PAUSE_SECONDS = 60
const MAX_PAUSE_DOUBLINGS = 4

const SUCCESSOR: Readonly<Record<FrictionType, FrictionType>> = {
  'countdown': 'breath',
  'breath': 'reflect',
  'reflect': 'type-intention',
  'type-intention': 'countdown',
}

export function nextFrictionType(previous: FrictionType | null): FrictionType {
  return previous === null ? 'countdown' : SUCCESSOR[previous]
}

/** The level of the gate shown for the `attemptCount`-th attempt (0 attempts reads as L0). */
export function levelOf(attemptCount: number): EscalationLevel {
  return Math.min(Math.max(attemptCount - 1, 0), 3) as EscalationLevel
}

export function pauseSecondsOf(
  level: EscalationLevel,
  brokenCount: number,
  guardianLinked: boolean
): number {
  const base = level === 0 ? 5 : level === 3 && !guardianLinked ? 60 : 15
  return Math.min(base * 2 ** Math.min(brokenCount, MAX_PAUSE_DOUBLINGS), MAX_PAUSE_SECONDS)
}

/** A complete gate: pause, typing and guardian key as §7.1 requires at its level. */
export function fullGate(
  attemptCount: number,
  brokenCount: number,
  frictionType: FrictionType,
  guardianLinked: boolean
): Gate {
  const level = levelOf(attemptCount)
  return {
    level,
    pauseSeconds: pauseSecondsOf(level, brokenCount, guardianLinked),
    frictionType,
    requiresTypedIntention: level >= 2,
    requiresGuardianKey: level === 3 && guardianLinked,
  }
}

/** The short extension gate (§7.3 `extend`): the doubled pause, no typing and no key. */
export function extensionGate(
  attemptCount: number,
  brokenCount: number,
  frictionType: FrictionType,
  guardianLinked: boolean
): Gate {
  return {
    ...fullGate(attemptCount, brokenCount, frictionType, guardianLinked),
    requiresTypedIntention: false,
    requiresGuardianKey: false,
  }
}
