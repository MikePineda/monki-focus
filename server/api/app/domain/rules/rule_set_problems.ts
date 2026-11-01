// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ValidationResult } from '@monki-focus/rules/pure'

/** At most this many paths are reported for one refused document. */
export const MAX_RULE_SET_PROBLEMS = 20

const SAFE_SEGMENT = /^[A-Za-z0-9_]{1,64}$/

/**
 * The 422 `fields` of a refused rule set: `<dotted path>: <rejection code>`
 * (`ruleSet.rules.0.target.domain: invalid_domain`). Only the JSON pointer
 * of each schema error is kept, never its message or a value, and a path
 * segment outside the schema's own alphabet is masked as `*`, so a domain
 * or a note never comes back in an error.
 */
export function ruleSetProblems(result: ValidationResult): Record<string, string> {
  if (result.valid) return {}
  const problems: Record<string, string> = {}
  for (const error of result.errors) {
    const pointer = error.startsWith('/') ? error.split(' ', 1)[0] : '/'
    const segments = pointer
      .split('/')
      .slice(1)
      .filter((segment) => segment !== '')
      .map((segment) => (SAFE_SEGMENT.test(segment) ? segment : '*'))
    const path = ['ruleSet', ...segments].join('.')
    if (!(path in problems)) problems[path] = result.code
    if (Object.keys(problems).length >= MAX_RULE_SET_PROBLEMS) break
  }
  if (Object.keys(problems).length === 0) problems.ruleSet = result.code
  return problems
}
