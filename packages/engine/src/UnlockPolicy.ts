// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Verified unlocks (SEMANTICS.md §5.2): an unlock whose target matches the
 * observation and with `notBefore ≤ now < expiresAt` lifts any restriction,
 * bedtime included. Adapters verify signature, device and replay before an
 * unlock reaches the engine; the engine only checks time and target.
 */
import type { VerifiedUnlock } from '@monki-focus/rules'
import { epochSecondsOf } from './Instant.ts'
import type { ResolvedObservation } from './ResolvedObservation.ts'
import type { RulesCatalog } from './RulesCatalog.ts'
import { matchesTarget } from './TargetMatcher.ts'

export function hasActiveUnlock(
  unlocks: readonly VerifiedUnlock[],
  observation: ResolvedObservation,
  nowSeconds: number,
  catalog: RulesCatalog
): boolean {
  return unlocks.some(
    (unlock) =>
      epochSecondsOf(unlock.notBefore) <= nowSeconds &&
      nowSeconds < epochSecondsOf(unlock.expiresAt) &&
      matchesTarget(unlock.target, observation, catalog)
  )
}
