// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The public `decide` (SEMANTICS.md §14): fail closed. Any exception or
 * invalid input while deciding (garbage URL text, an instant without an
 * offset, an unresolvable time zone, an internal error) blocks and hides the
 * feed with reason `engine_error` and no gate, so a bug can never open what
 * the user chose to restrict. `validUntil` is null: there is no instant at
 * which the same broken inputs would decide better. The error itself is not exposed: adapters log
 * the reason code only, never URLs or titles.
 */
import type { Decision, DecisionState, Instant, Observation, Ruleset } from '@monki-focus/rules'
import { decideOrThrow } from './DecisionEngine.ts'
import type { RulesCatalog } from './RulesCatalog.ts'

export const ENGINE_ERROR_DECISION: Readonly<Decision> = Object.freeze({
  access: 'block',
  content: 'hide-feed',
  ruleId: null,
  reason: 'engine_error',
  explanationKey: 'decision.engine_error',
  validUntil: null,
})

export function decide(
  ruleset: Ruleset,
  observation: Observation,
  state: DecisionState,
  now: Instant,
  catalog: RulesCatalog
): Decision {
  try {
    return decideOrThrow(ruleset, observation, state, now, catalog)
  } catch {
    return { ...ENGINE_ERROR_DECISION }
  }
}
