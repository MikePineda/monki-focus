// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  decide,
  ENGINE_ERROR_DECISION,
  epochSecondsOf,
  instantOf,
  type RulesCatalog,
} from '@monki-focus/engine'
import type { Decision, DecisionState, Ruleset, UtcInstant } from '@monki-focus/rules/pure'
import type { Clock } from '../../shared/clock'
import { feedSurfacesOfHost, pageSurfaceOf } from '../../shared/FeedSurfaces'
import type { FeedDecision } from '../../shared/messages'
import { probeUrlFor } from './SurfaceProbe'

/** Where the service worker reads the user's rule set (`RulesetStore`). */
export interface RulesetSource {
  load(): Promise<Ruleset>
}

/** Escalation, usage and unlock state; empty until E6/E7 store it. */
export type DecisionStateSource = () => Promise<DecisionState> | DecisionState

export const EMPTY_DECISION_STATE: Readonly<DecisionState> = Object.freeze({
  escalation: [],
  usage: null,
  unlocks: [],
  guardianLinked: false,
})

export interface DecisionServiceOptions {
  catalog: RulesCatalog
  rulesets: RulesetSource
  clock: Clock
  states?: DecisionStateSource
  /**
   * Every decision's `validUntil` (null for `engine_error`), for the alarm
   * that re-decides at the earliest one (`ValidityAlarm`). Never throws.
   */
  onValidity?: (validUntil: UtcInstant | null) => void
}

/** A surface counts as restricted when the rule set blocks it or hides it. */
export function restrictsSurface(decision: Decision): boolean {
  return decision.access === 'block' || decision.content === 'hide-feed'
}

function engineError(): Decision {
  return { ...ENGINE_ERROR_DECISION }
}

/** The earliest of the decisions' `validUntil`; null when none has one. */
export function earliestValidUntil(decisions: readonly Decision[]): UtcInstant | null {
  let earliest: UtcInstant | null = null
  for (const { validUntil } of decisions) {
    if (validUntil === null) continue
    if (earliest === null || epochSecondsOf(validUntil) < epochSecondsOf(earliest)) {
      earliest = validUntil
    }
  }
  return earliest
}

/**
 * The service worker's adapter over `@monki-focus/engine`: one catalog for
 * the worker's lifetime, the stored rule set, `instantOf(clock.now())` as
 * `now`. Fail closed: whatever throws in the adapter (storage, the clock,
 * the catalog) answers the engine's own `engine_error` decision (block and
 * hide the feed), exactly what `decide` returns for a failure inside it.
 */
export class DecisionService {
  private readonly states: DecisionStateSource

  constructor(private readonly options: DecisionServiceOptions) {
    this.states = options.states ?? (() => EMPTY_DECISION_STATE)
  }

  /** `decide` for a page URL; never throws. */
  async decide(url: string): Promise<Decision> {
    let decision: Decision
    try {
      const [ruleset, state] = await Promise.all([this.options.rulesets.load(), this.states()])
      const now = instantOf(this.options.clock.now())
      decision = decide(ruleset, { kind: 'site', urlText: url }, state, now, this.options.catalog)
    } catch {
      decision = engineError()
    }
    try {
      this.options.onValidity?.(decision.validUntil)
    } catch {
      // Scheduling is best-effort: the minute check is the backstop.
    }
    return decision
  }

  /**
   * Whether the rule set restricts `surface` right now, decided on a URL the
   * engine resolves to it (`probeUrlFor`). A surface without such a URL, or
   * any failure, counts as restricted (fail closed).
   */
  async restricts(surface: string): Promise<boolean> {
    const decision = await this.probe(surface)
    return decision === null || restrictsSurface(decision)
  }

  /** The decision on a URL the engine resolves to `surface`, or null without one. */
  private async probe(surface: string): Promise<Decision | null> {
    let url: string | null
    try {
      url = probeUrlFor(surface, this.options.catalog)
    } catch {
      url = null
    }
    return url === null ? null : this.decide(url)
  }

  /** What the feed guard of a page hides; never throws. */
  async feedDecisionFor(url: string): Promise<FeedDecision> {
    let surface: string | null = null
    let host: string | null = null
    try {
      ;({ surface, host } = pageSurfaceOf(url, this.options.catalog))
    } catch {
      // A URL the catalog cannot place: no surface, the decision fails closed.
    }
    const decision = await this.decide(url)
    let siteFeeds: string[]
    try {
      siteFeeds = feedSurfacesOfHost(host, this.options.catalog)
    } catch {
      siteFeeds = []
    }

    const hide = new Set<string>()
    if (decision.reason === 'engine_error') {
      // Fail closed: every feed of the site stays hidden, whatever the page is.
      for (const feed of siteFeeds) hide.add(feed)
    } else if (decision.content === 'hide-feed' && surface !== null) {
      hide.add(surface)
    }

    const restrict: string[] = []
    const decisions = [decision]
    for (const feed of siteFeeds) {
      const probed = hide.has(feed) ? null : await this.probe(feed)
      if (probed !== null) decisions.push(probed)
      if (hide.has(feed) || probed === null || restrictsSurface(probed)) restrict.push(feed)
    }
    return {
      surface,
      decision,
      hide: [...hide],
      restrict,
      validUntil: earliestValidUntil(decisions),
    }
  }
}
