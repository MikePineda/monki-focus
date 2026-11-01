// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '@monki-focus/rules/pure'

/** The escalation group of bedtime (SEMANTICS.md §7: reserved, never a rule id). */
export const BEDTIME_GROUP = 'bedtime'

/**
 * The escalation group a decision's restriction belongs to: its rule id, or
 * `bedtime` for a bedtime block, the relaxed-weekend bedtime gate and its
 * intention (no rule, SEMANTICS.md §6.4) and the emergency override that
 * lifts bedtime. Null when the decision names no restriction (no rule, an
 * engine error).
 */
const BEDTIME_REASONS: ReadonlySet<Decision['reason']> = new Set([
  'schedule_bedtime',
  'emergency_active',
  'intention_required',
  'intention_active',
])

export function groupOf(decision: Decision): string | null {
  if (decision.ruleId !== null) return decision.ruleId
  return BEDTIME_REASONS.has(decision.reason) ? BEDTIME_GROUP : null
}
