// SPDX-License-Identifier: AGPL-3.0-or-later
import { decide, type RulesCatalog } from '@monki-focus/engine'
import type { DecisionState, Instant, Rule, Ruleset } from '@monki-focus/rules/pure'

const QUIET_STATE: DecisionState = {
  escalation: [],
  usage: null,
  unlocks: [],
  guardianLinked: false,
}

/**
 * The rules that take part in a page's friction (SEMANTICS.md §7.4: the
 * matching friction candidates whose escalation is shared), found by asking
 * the engine rather than matching targets here: a rule is a friction
 * candidate when, alone in the rule set (no bedtime, no usage, no state),
 * `decide` gates the page with it. That covers schedules, path globs and the
 * unknown-path promotion of §5.5 exactly as the engine applies them.
 */
export function frictionCandidates(
  ruleset: Ruleset,
  url: string,
  now: Instant,
  catalog: RulesCatalog
): Rule[] {
  const bedtime = { ...ruleset.bedtime, enabled: false }
  return ruleset.rules.filter((rule) => {
    if (!rule.enabled || rule.mode === 'allow') return false
    const alone: Ruleset = { ...ruleset, rules: [rule], bedtime }
    const decision = decide(alone, { kind: 'site', urlText: url }, QUIET_STATE, now, catalog)
    return decision.access === 'gate' && decision.ruleId === rule.id
  })
}
