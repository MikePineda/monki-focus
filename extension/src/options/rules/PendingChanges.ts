// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Rule, Ruleset, Target } from '@monki-focus/rules/pure'

/** One part of the configured rule set that does not apply yet. */
export type PendingChange =
  | { kind: 'rule_added' | 'rule_removed' | 'rule_changed'; ruleId: string; target: Target }
  | { kind: 'bedtime' | 'work_hours' | 'categories' | 'time_zone' }

/** JSON with object keys sorted at every depth: key order carries no meaning. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function same(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b)
}

function canonicalRule(rule: Rule): string {
  return canonical(rule)
}

/** Category assignments compare as a set: the engine may reorder them. */
function sameSet(a: readonly unknown[], b: readonly unknown[]): boolean {
  return same(a.map(canonical).sort(), b.map(canonical).sort())
}

/**
 * What still waits: every part where the configured (pending) set differs
 * from the effective one. Revision, `updatedAt` and `pendingTimeZone` are
 * bookkeeping, not changes.
 */
export function pendingChanges(effective: Ruleset, configured: Ruleset): PendingChange[] {
  const changes: PendingChange[] = []
  const before = new Map(effective.rules.map((rule) => [rule.id, rule]))
  const after = new Map(configured.rules.map((rule) => [rule.id, rule]))
  for (const [id, rule] of after) {
    const previous = before.get(id)
    if (!previous) changes.push({ kind: 'rule_added', ruleId: id, target: rule.target })
    else if (canonicalRule(previous) !== canonicalRule(rule)) {
      changes.push({ kind: 'rule_changed', ruleId: id, target: rule.target })
    }
  }
  for (const [id, rule] of before) {
    if (!after.has(id)) changes.push({ kind: 'rule_removed', ruleId: id, target: rule.target })
  }
  if (!same(effective.bedtime, configured.bedtime)) changes.push({ kind: 'bedtime' })
  if (!same(effective.workHours, configured.workHours)) changes.push({ kind: 'work_hours' })
  if (!sameSet(effective.categories, configured.categories)) changes.push({ kind: 'categories' })
  if (effective.timeZone !== configured.timeZone || effective.pendingTimeZone !== undefined) {
    changes.push({ kind: 'time_zone' })
  }
  return changes
}

/** Rule ids whose configured version does not apply yet (added, changed or removed). */
export function pendingRuleIds(changes: readonly PendingChange[]): Set<string> {
  return new Set(changes.flatMap((change) => ('ruleId' in change ? [change.ruleId] : [])))
}
