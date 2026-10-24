// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '@monki-focus/rules/pure'

/** The escalation group of bedtime (SEMANTICS.md §7: reserved, never a rule id). */
export const BEDTIME_GROUP = 'bedtime'

/**
 * The escalation group a decision's restriction belongs to: its rule id, or
 * `bedtime` for a bedtime block (and for the emergency override that lifts
 * it). Null when the decision names no restriction (no rule, an engine
 * error).
 */
export function groupOf(decision: Decision): string | null {
  if (decision.ruleId !== null) return decision.ruleId
  return decision.reason === 'schedule_bedtime' || decision.reason === 'emergency_active'
    ? BEDTIME_GROUP
    : null
}
