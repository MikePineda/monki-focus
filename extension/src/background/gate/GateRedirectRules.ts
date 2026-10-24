// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RulesCatalog } from '@monki-focus/engine'
import type { Decision, Ruleset } from '@monki-focus/rules/pure'
import { groupOf } from './GateGroup'

/** Session rule ids of the per-group redirects: `[FIRST, FIRST + MAX_GROUPS)`. */
export const REDIRECT_RULE_FIRST_ID = 10_000
export const MAX_REDIRECT_GROUPS = 4_000

/** The slice of a DNR rule the gate writes. */
export interface GateDnrRule {
  id: number
  priority: number
  action: { type: 'redirect'; redirect: { regexSubstitution: string } } | { type: 'allow' }
  condition: {
    regexFilter?: string
    requestDomains?: string[]
    tabIds?: number[]
    resourceTypes: ['main_frame']
  }
}

/** The slice of `declarativeNetRequest` the gate uses (session rules only). */
export interface SessionRulesApi {
  getSessionRules(): Promise<{ id: number }[]>
  updateSessionRules(options: { removeRuleIds?: number[]; addRules?: GateDnrRule[] }): Promise<void>
}

export interface GateRedirectRulesOptions {
  dnr: SessionRulesApi
  catalog: RulesCatalog
  rulesets: { load(): Promise<Ruleset> }
  /** The engine's decision for a URL, with the stored escalation state. */
  decide: (url: string) => Promise<Decision>
  /** This browser session's ticket (`GateTicket`). */
  ticket: () => Promise<string>
  runtimeId: string
  /** Called when a sync is skipped because the engine failed closed. */
  onEngineError?: () => void
}

function isRedirectRuleId(id: number): boolean {
  return id >= REDIRECT_RULE_FIRST_ID && id < REDIRECT_RULE_FIRST_ID + MAX_REDIRECT_GROUPS
}

/** Every host name a request for `domain` may carry: the domain and its aliases (twitter.com for x.com). */
function requestDomainsOf(domain: string, catalog: RulesCatalog): string[] {
  const aliases = catalog.aliases
    .filter(([, canonical]) => canonical === domain)
    .map(([alias]) => alias)
  return [domain, ...aliases].sort()
}

/**
 * The domains whose whole-site decision is probed: every site profile's
 * domain (bedtime, budgets and surface rules land there) and every site
 * target of a friction or block rule, normalised like the engine does.
 */
function candidateDomains(ruleset: Ruleset, catalog: RulesCatalog): string[] {
  const domains = new Set(catalog.profiles.map((profile) => profile.domain))
  for (const rule of ruleset.rules) {
    if (rule.target.kind !== 'site') continue
    if (rule.mode !== 'friction' && rule.mode !== 'block') continue
    domains.add(catalog.normaliseDomain(rule.target.domain))
  }
  return [...domains].sort()
}

/**
 * Keeps one session DNR rule per gated escalation group: `main_frame`
 * requests to the group's domains redirect to
 * `chrome-extension://<id>/gate.html?t=<ticket>&to=\0` before the request
 * leaves (no flash, no race). Which domains are gated, and by which group,
 * is the engine's decision for the domain's root page (`decide` with the
 * stored escalation, so an active intention or override lifts the redirect
 * and an expired one restores it). A page the engine allows inside a gated
 * domain passes through the gate at once (`TabPasses`); a page the engine
 * gates inside an ungated domain is sent to the gate by the feed guard.
 * An `engine_error` for any domain never changes the installed rules: the
 * last good redirects stay (never "remove all"), and the feed guard fails
 * closed on its own by hiding every feed.
 *
 * `sync()` runs one at a time and only touches the browser when the
 * desired rules differ from the installed ones.
 */
export class GateRedirectRules {
  private queue: Promise<unknown> = Promise.resolve()
  private installed: string | null = null

  constructor(private readonly options: GateRedirectRulesOptions) {}

  /** Resolves to whether the installed rules changed. */
  sync(): Promise<boolean> {
    const run = this.queue.then(() => this.syncNow())
    this.queue = run.catch(() => undefined)
    return run
  }

  /** The redirect rules the decisions call for now, ordered by group. */
  /** Null when the engine failed closed for a domain (keep what is installed). */
  async desiredRules(): Promise<GateDnrRule[] | null> {
    const { catalog, rulesets, decide, ticket, runtimeId } = this.options
    const ruleset = await rulesets.load()
    const byGroup = new Map<string, Set<string>>()
    for (const domain of candidateDomains(ruleset, catalog)) {
      const decision = await decide(`https://${domain}/`)
      if (decision.reason === 'engine_error') return null
      if (decision.access === 'allow') continue
      const group = groupOf(decision)
      if (group === null) continue
      const domains = byGroup.get(group) ?? new Set<string>()
      for (const name of requestDomainsOf(domain, catalog)) domains.add(name)
      byGroup.set(group, domains)
    }
    const substitution = `chrome-extension://${runtimeId}/gate.html?t=${await ticket()}&to=\\0`
    return [...byGroup.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .slice(0, MAX_REDIRECT_GROUPS)
      .map(([, domains], index) => ({
        id: REDIRECT_RULE_FIRST_ID + index,
        priority: 1,
        action: { type: 'redirect', redirect: { regexSubstitution: substitution } },
        condition: {
          regexFilter: '^https?://.*$',
          requestDomains: [...domains].sort(),
          resourceTypes: ['main_frame'],
        },
      }))
  }

  private async syncNow(): Promise<boolean> {
    const { dnr } = this.options
    const desired = await this.desiredRules()
    if (desired === null) {
      this.options.onEngineError?.()
      return false
    }
    const fingerprint = JSON.stringify(desired)
    const existing = (await dnr.getSessionRules()).map(({ id }) => id).filter(isRedirectRuleId)
    if (fingerprint === this.installed && existing.length === desired.length) return false
    await dnr.updateSessionRules({ removeRuleIds: existing, addRules: desired })
    this.installed = fingerprint
    return true
  }
}
