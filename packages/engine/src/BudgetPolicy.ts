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
      (usage.secondsByRule[rule.id] ?? 0) >= rule.dailyBudgetMinutes * 60
  )
  return mostSpecific(exhausted, catalog)
}
