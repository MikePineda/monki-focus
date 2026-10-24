// SPDX-License-Identifier: AGPL-3.0-or-later
import type {
  Bedtime,
  CategoryAssignment,
  CategoryLevel,
  Rule,
  RuleMode,
  Ruleset,
  Schedule,
} from '@monki-focus/rules/pure'
import { defaultCategories, normaliseDomain } from '@monki-focus/rules/pure'

/**
 * Pure edits of a rule set, as the options page makes them. Each returns a
 * new rule set; the service worker judges it (tighten now, loosen later)
 * and assigns the revision.
 */

export const RULE_MODES: readonly RuleMode[] = ['allow', 'hide-feed', 'friction', 'block']

/** The domain a reddit community rule targets (aliases and `www.` are normalised by the engine). */
export const REDDIT_DOMAIN = 'reddit.com'
const SUBREDDIT_NAME = /^[A-Za-z0-9_]{2,21}$/
const SUBREDDIT_PATH = /^\/r\/([A-Za-z0-9_]{2,21})\/\*\*$/

/** `r/AskHistorians`, `/r/AskHistorians/` or `AskHistorians` → `AskHistorians`; else null. */
export function parseSubredditName(input: string): string | null {
  const name = input
    .trim()
    .replace(/^\/?r\//i, '')
    .replace(/\/+$/, '')
  return SUBREDDIT_NAME.test(name) ? name : null
}

/** A domain the user typed (`https://www.example.com/x` → `example.com`), or null. */
export function parseDomainInput(input: string): string | null {
  let text = input.trim().toLowerCase()
  if (text === '') return null
  if (!/^[a-z]+:\/\//.test(text)) text = `https://${text}`
  let host: string
  try {
    host = new URL(text).hostname
  } catch {
    return null
  }
  host = host.replace(/^www\./, '')
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function uniqueId(ruleset: Ruleset, base: string): string {
  const taken = new Set(ruleset.rules.map((rule) => rule.id))
  if (!taken.has(base)) return base
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`
    if (!taken.has(candidate)) return candidate
  }
}

/** The subreddit an `allow` rule lets through, or null for any other rule. */
export function allowedSubredditOf(rule: Rule): string | null {
  if (rule.mode !== 'allow' || rule.target.kind !== 'site') return null
  if (normaliseDomain(rule.target.domain) !== REDDIT_DOMAIN) return null
  return SUBREDDIT_PATH.exec(rule.target.path ?? '')?.[1] ?? null
}

export function allowedSubreddits(ruleset: Ruleset): { rule: Rule; name: string }[] {
  return ruleset.rules.flatMap((rule) => {
    const name = allowedSubredditOf(rule)
    return name === null ? [] : [{ rule, name }]
  })
}

/** Adds an always-on `allow` rule on `reddit.com/r/<name>/**` (no-op when it exists). */
export function allowSubreddit(ruleset: Ruleset, name: string): Ruleset {
  const exists = allowedSubreddits(ruleset).some(
    (entry) => entry.name.toLowerCase() === name.toLowerCase()
  )
  if (exists) return ruleset
  const rule: Rule = {
    id: uniqueId(ruleset, `allow-reddit-r-${slug(name)}`),
    target: { kind: 'site', domain: REDDIT_DOMAIN, path: `/r/${name}/**` },
    mode: 'allow',
    schedules: [],
    enabled: true,
  }
  return { ...ruleset, rules: [...ruleset.rules, rule] }
}

/** Adds an always-on rule for `domain` with `mode`. */
export function addSiteRule(ruleset: Ruleset, domain: string, mode: RuleMode): Ruleset {
  const rule: Rule = {
    id: uniqueId(ruleset, `site-${slug(domain)}`),
    target: { kind: 'site', domain },
    mode,
    schedules: [],
    enabled: true,
  }
  return { ...ruleset, rules: [...ruleset.rules, rule] }
}

export function replaceRule(ruleset: Ruleset, rule: Rule): Ruleset {
  return {
    ...ruleset,
    rules: ruleset.rules.map((current) => (current.id === rule.id ? rule : current)),
  }
}

export function removeRule(ruleset: Ruleset, id: string): Ruleset {
  return { ...ruleset, rules: ruleset.rules.filter((rule) => rule.id !== id) }
}

export function setBedtime(ruleset: Ruleset, bedtime: Bedtime): Ruleset {
  return { ...ruleset, bedtime }
}

export function setWorkHours(ruleset: Ruleset, workHours: Schedule): Ruleset {
  return { ...ruleset, workHours }
}

/** Level indices 0..4 of the UI kit and the category levels they stand for. */
export const CATEGORY_LEVELS: readonly CategoryLevel[] = [0, 25, 50, 75, 100]
const LEVEL_SLUGS: Record<CategoryLevel, string> = {
  0: 'distracting',
  25: 'personal',
  50: 'neutral',
  75: 'other-work',
  100: 'focus',
}

function sameDomainTarget(assignment: CategoryAssignment, domain: string): boolean {
  return (
    assignment.target.kind === 'site' &&
    assignment.target.path === undefined &&
    normaliseDomain(assignment.target.domain) === normaliseDomain(domain)
  )
}

/** The user's category level for a whole domain (replacing an earlier one). */
export function setDomainCategory(ruleset: Ruleset, domain: string, level: CategoryLevel): Ruleset {
  // Keep the factory category name when the domain has one; otherwise name it by level.
  const factory = defaultCategories.assignments.find((assignment) =>
    sameDomainTarget(assignment, domain)
  )
  const assignment: CategoryAssignment = {
    target: { kind: 'site', domain },
    level,
    category: factory?.category ?? LEVEL_SLUGS[level],
  }
  const others = ruleset.categories.filter((current) => !sameDomainTarget(current, domain))
  return { ...ruleset, categories: [...others, assignment] }
}

export function removeCategory(ruleset: Ruleset, index: number): Ruleset {
  return { ...ruleset, categories: ruleset.categories.filter((_entry, at) => at !== index) }
}
