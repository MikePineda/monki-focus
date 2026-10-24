// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Daily budgets (SEMANTICS.md §5.2.2): any candidate, on either axis, whose
 * `dailyBudgetMinutes` is spent blocks (the most specific one names the
 * decision). Usage only counts when it is dated today in a pinned zone (either
 * zone while a zone change waits), so a budget block lasts until local
 * midnight and a move to a zone behind never grants an extra day.
 */
import type { DailyUsage, Rule } from '@monki-focus/rules'
import type { RulesCatalog } from './RulesCatalog.ts'
import { mostSpecific } from './Specificity.ts'

/** Seconds used by a rule today; rule ids are data, so only own keys count (§14). */
function usedSeconds(usage: DailyUsage, ruleId: string): number {
  return Object.hasOwn(usage.secondsByRule, ruleId) ? (usage.secondsByRule[ruleId] ?? 0) : 0
}

export function exhaustedBudgetRule(
  candidates: readonly Rule[],
  usage: DailyUsage | null,
  todayDates: readonly string[],
  catalog: RulesCatalog
): Rule | null {
  if (usage === null || !todayDates.includes(usage.localDate)) return null
  const exhausted = candidates.filter(
    (rule) =>
      rule.dailyBudgetMinutes !== undefined &&
      usedSeconds(usage, rule.id) >= rule.dailyBudgetMinutes * 60
  )
  return mostSpecific(exhausted, catalog)
}
