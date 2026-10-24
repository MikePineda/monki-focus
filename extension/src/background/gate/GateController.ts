// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  effectiveEscalationState,
  epochSecondsOf,
  instantOf,
  nextEscalation,
  normalizeUrl,
  type RulesCatalog,
} from '@monki-focus/engine'
import type {
  Decision,
  EscalationEvent,
  EscalationState,
  Instant,
  Ruleset,
} from '@monki-focus/rules/pure'
import type { Clock } from '../../shared/clock'
import type {
  ActiveSession,
  CommitResult,
  GateBlockReason,
  GateContext,
  GateView,
  IntentionMinutes,
} from '../../shared/GateContract'
import type { ClosedAnswer, GateHandoff } from '../../shared/messages'
import { siteFeedProfileFor } from '../../sites'
import { wordCount } from '../../ui/wordCount'
import type { IntentionDay } from '../stats/IntentionStatsQuery'
import type { BypassEventPayload, IntentionEntryKind } from '../storage/db'
import type { EscalationStore } from './EscalationStore'
import { frictionCandidates } from './FrictionCandidates'
import { groupOf } from './GateGroup'
import type { GateTabs } from './GateTabs'
import type { GateTicket } from './GateTicket'
import type { IntentionNotes } from './IntentionNotes'

/** A typed intention needs this many words (the engine checks the count it gets too). */
const MIN_TYPED_WORDS = 3
/** Sites whose gate offers a search box (`/search?q=`, never gated). */
const GATE_SEARCH_SITES: ReadonlySet<string> = new Set(['reddit.com', 'youtube.com'])
/** The group logged for a Close on a gate without a destination. */
const NO_GROUP = ''

export interface GateControllerOptions {
  catalog: RulesCatalog
  rulesets: { load(): Promise<Ruleset> }
  clock: Clock
  /** The engine's decision for a URL with the stored escalation, usage and unlocks. */
  decide: (url: string) => Promise<Decision>
  escalation: EscalationStore
  tabs: GateTabs
  ticket: GateTicket
  notes: IntentionNotes
  log: { record(entry: { at: string; kind: IntentionEntryKind; group: string }): Promise<void> }
  /** Today's intention facts in the pinned zone. */
  day: () => Promise<IntentionDay>
  /** Minutes tracked today on a normalised host (E7's `stats.today`). */
  minutesToday: (site: string) => Promise<number>
  outbox: { enqueueBypass(event: BypassEventPayload, enqueuedAt: string): Promise<void> }
  passes: { grant(tabId: number, url: string): Promise<void> }
  closer: { close(tabId: number): Promise<boolean> }
  /** Sends a tab to a URL (`tabs.update`). */
  navigate: (tabId: number, url: string) => Promise<void>
  /** The URLs of the open tabs (to tell whether a timed-out intention is still on screen). */
  openPageUrls: () => Promise<string[]>
  /** `chrome-extension://<id>/gate.html`. */
  gateUrl: string
  /** Escalation changed: re-sync the redirects and timers, tell the open pages. */
  onChange: () => Promise<void>
  randomId?: () => string
}

function epochMs(instant: string | null): number | null {
  return instant === null ? null : epochSecondsOf(instant) * 1000
}

function blockReasonOf(decision: Decision): GateBlockReason {
  switch (decision.reason) {
    case 'budget_exhausted':
    case 'schedule_bedtime':
    case 'engine_error':
      return decision.reason
    default:
      return 'rule_match'
  }
}

/**
 * The service worker's side of the intention gate. Every state and every
 * transition is the engine's: `decide` says whether a page is gated, blocked
 * or lifted and by which group, `effectiveEscalationState` + `nextEscalation`
 * move the group's state (SEMANTICS.md §7), and the controller only stores
 * what the engine returns, keeps the per-tab destination, records the day's
 * facts and the emergency bypass, and turns the state into the gate page's
 * view. The destination always comes from the tab's own record, never from
 * the gate page's URL.
 *
 * Every command runs one at a time.
 */
export class GateController {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly options: GateControllerOptions) {}

  // Gate page -------------------------------------------------------------

  /** The gate page loaded; a hand-off counts only with this session's ticket. */
  load(tabId: number, handoff: GateHandoff | null): Promise<GateView> {
    return this.serial(async () => {
      if (handoff !== null && (await this.options.ticket.verify(handoff.ticket))) {
        await this.options.tabs.setDestination(tabId, handoff.to)
      }
      return this.viewOf(tabId)
    })
  }

  pauseDone(tabId: number): Promise<GateView> {
    return this.serial(async () => {
      await this.stepTab(tabId, { type: 'pause_elapsed' })
      return this.viewOf(tabId)
    })
  }

  commit(tabId: number, minutes: IntentionMinutes, intention: string): Promise<CommitResult> {
    return this.serial(async (): Promise<CommitResult> => {
      const target = await this.targetOf(tabId)
      if (target === null) return { accepted: true, view: await this.viewOf(tabId) }
      const state = await this.options.escalation.get(target.group)
      const text = intention.trim()
      const typedWords = wordCount(text, 'en')
      if (state.gate?.requiresTypedIntention === true) {
        if (typedWords < MIN_TYPED_WORDS)
          return { accepted: false, rejection: 'intention.tooFewWords' }
        if (await this.options.notes.repeatsLast(text)) {
          return { accepted: false, rejection: 'intention.sameAsLast' }
        }
      }
      const changed = await this.step(target.group, {
        type: 'commit',
        minutes,
        typedWords,
        guardianKeyVerified: false,
      })
      if (changed?.phase === 'active') {
        await this.options.notes.save(target.group, { text, minutes })
        await this.record('committed', target.group)
        await this.options.onChange()
      }
      return { accepted: true, view: await this.viewOf(tabId) }
    })
  }

  close(tabId: number): Promise<ClosedAnswer> {
    return this.serial(async () => {
      const target = await this.targetOf(tabId)
      if (target !== null && (await this.step(target.group, { type: 'close' })) !== null) {
        await this.options.onChange()
      }
      await this.record('closed', target?.group ?? NO_GROUP)
      await this.options.tabs.forget(tabId)
      return { closed: await this.options.closer.close(tabId) }
    })
  }

  emergency(tabId: number): Promise<GateView> {
    return this.serial(async () => {
      await this.stepTab(tabId, { type: 'emergency_request' })
      return this.viewOf(tabId)
    })
  }

  emergencyDone(tabId: number): Promise<GateView> {
    return this.serial(async () => {
      const target = await this.targetOf(tabId)
      if (target === null) return this.viewOf(tabId)
      const before = await this.options.escalation.get(target.group)
      const result = nextEscalation(before, { type: 'emergency_wait_elapsed' }, this.now(), false)
      if (result.state !== before) {
        await this.options.escalation.put(result.state)
        if (result.effects.includes('record_bypass')) await this.recordBypass(before, result.state)
        await this.options.onChange()
      }
      return this.viewOf(tabId)
    })
  }

  emergencyCancel(tabId: number): Promise<GateView> {
    return this.serial(async () => {
      const target = await this.targetOf(tabId)
      if (target !== null) {
        const state = await this.options.escalation.get(target.group)
        if (
          state.phase === 'override_waiting' &&
          (await this.step(target.group, { type: 'close' }))
        ) {
          await this.options.onChange()
        }
      }
      return this.viewOf(tabId)
    })
  }

  leave(tabId: number): Promise<ClosedAnswer> {
    return this.serial(async () => {
      const target = await this.targetOf(tabId)
      if (target !== null) await this.leaveGroup(target.group)
      await this.options.tabs.forget(tabId)
      return { closed: await this.options.closer.close(tabId) }
    })
  }

  extend(tabId: number): Promise<GateView> {
    return this.serial(async () => {
      const target = await this.targetOf(tabId)
      if (target !== null) await this.extendGroup(target.group)
      return this.viewOf(tabId)
    })
  }

  /** The gate's search box: the site's own search, let through once and never gated in this tab. */
  search(tabId: number, query: string): Promise<GateView> {
    return this.serial(async (): Promise<GateView> => {
      const { destination } = await this.options.tabs.get(tabId)
      const url = destination === null ? null : this.searchUrlOf(destination, query)
      if (url === null) return this.viewOf(tabId)
      await this.options.tabs.setSearchPass(tabId, url)
      await this.options.passes.grant(tabId, url)
      return { kind: 'pass', url }
    })
  }

  // Site pages ------------------------------------------------------------

  /** A page whose decision gates or blocks it: send its tab to the gate. */
  open(tabId: number, url: string): Promise<{ opened: boolean }> {
    return this.serial(async () => {
      if ((await this.options.tabs.get(tabId)).searchPass === url) return { opened: false }
      const decision = await this.options.decide(url)
      if (decision.access === 'allow' || decision.reason === 'engine_error')
        return { opened: false }
      const group = groupOf(decision)
      if (group !== null && (await this.options.escalation.get(group)).phase === 'timed_out') {
        // The page shows the timeout overlay instead.
        return { opened: false }
      }
      await this.options.tabs.setDestination(tabId, url)
      await this.options.navigate(tabId, this.options.gateUrl)
      return { opened: true }
    })
  }

  /** The page's intention timer reached zero. */
  expired(url: string): Promise<{ session: ActiveSession | null }> {
    return this.serial(async () => {
      const decision = await this.options.decide(url)
      const group = groupOf(decision)
      if (group !== null && (await this.step(group, { type: 'intention_expired' })) !== null) {
        await this.options.onChange()
      }
      return { session: (await this.sessionFor(url, await this.options.decide(url))) ?? null }
    })
  }

  /** Timeout overlay: Leave. */
  leaveFromPage(tabId: number, url: string): Promise<ClosedAnswer> {
    return this.serial(async () => {
      const group = groupOf(await this.options.decide(url))
      if (group !== null) await this.leaveGroup(group)
      return { closed: await this.options.closer.close(tabId) }
    })
  }

  /** Timeout overlay: 5 more min, through the gate's doubled pause. */
  extendFromPage(tabId: number, url: string): Promise<{ opened: boolean }> {
    return this.serial(async () => {
      const group = groupOf(await this.options.decide(url))
      if (group === null || !(await this.extendGroup(group))) return { opened: false }
      await this.options.tabs.setDestination(tabId, url)
      await this.options.navigate(tabId, this.options.gateUrl)
      return { opened: true }
    })
  }

  /** The intention or override the page at `url` is inside, for its pill and overlay. */
  async sessionFor(url: string, decision: Decision): Promise<ActiveSession | undefined> {
    const group = groupOf(decision)
    if (group === null) return undefined
    const state = await this.options.escalation.get(group)
    const site = this.siteOf(url)
    const note = await this.options.notes.of(group)
    const base = {
      minutes: note?.minutes ?? null,
      intention: note?.text === '' ? null : (note?.text ?? null),
      nextPauseSeconds: this.extendPauseOf({ ...state, phase: 'timed_out' }),
      site,
    }
    if (decision.reason === 'intention_active' && state.phase === 'active') {
      return { ...base, phase: 'active', endsAtMs: epochMs(state.intentionExpiresAt) }
    }
    if (decision.reason === 'emergency_active' && state.phase === 'override_active') {
      return { ...base, phase: 'override_active', endsAtMs: epochMs(state.overrideEndsAt) }
    }
    if (decision.access === 'gate' && state.phase === 'timed_out') {
      return { ...base, phase: 'timed_out', endsAtMs: null }
    }
    return undefined
  }

  // Timers ----------------------------------------------------------------

  /** The next intention or override end of any group (epoch ms), for the alarm. */
  async nextTimerAt(): Promise<number | null> {
    let next: number | null = null
    for (const state of await this.options.escalation.all()) {
      const at =
        state.phase === 'active'
          ? epochMs(state.intentionExpiresAt)
          : state.phase === 'override_active'
            ? epochMs(state.overrideEndsAt)
            : null
      if (at !== null && (next === null || at < next)) next = at
    }
    return next
  }

  /**
   * The timer alarm: ends what is over. An intention that runs out while no
   * page of its group is open is kept (left in time); one on screen times out
   * and its page shows the overlay.
   */
  tick(): Promise<void> {
    return this.serial(async () => {
      let changed = false
      for (const state of await this.options.escalation.all()) {
        const group = state.targetGroup
        if (state.phase === 'active' && (await this.step(group, { type: 'intention_expired' }))) {
          changed = true
          if (!(await this.isOnScreen(group))) await this.leaveGroup(group)
        } else if (state.phase === 'override_active') {
          changed = (await this.step(group, { type: 'emergency_expired' })) !== null || changed
        }
      }
      if (changed) await this.options.onChange()
    })
  }

  // Internals -------------------------------------------------------------

  private now(): Instant {
    return instantOf(this.options.clock.now())
  }

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task)
    this.queue = run.catch(() => undefined)
    return run
  }

  private record(kind: IntentionEntryKind, group: string): Promise<void> {
    return this.options.log.record({ at: this.now(), kind, group })
  }

  /** Applies `event` to the group's stored state; answers the new state, or null when nothing changed. */
  private async step(group: string, event: EscalationEvent): Promise<EscalationState | null> {
    const state = await this.options.escalation.get(group)
    const { state: next } = nextEscalation(state, event, this.now(), false)
    if (next === state) return null
    await this.options.escalation.put(next)
    return next
  }

  private async stepTab(tabId: number, event: EscalationEvent): Promise<void> {
    const target = await this.targetOf(tabId)
    if (target !== null && (await this.step(target.group, event)) !== null) {
      await this.options.onChange()
    }
  }

  private async leaveGroup(group: string): Promise<void> {
    if ((await this.step(group, { type: 'leave' })) === null) return
    await this.record('kept', group)
    await this.options.onChange()
  }

  private async extendGroup(group: string): Promise<boolean> {
    if ((await this.step(group, { type: 'extend' })) === null) return false
    await this.record('broken', group)
    await this.options.onChange()
    return true
  }

  private async isOnScreen(group: string): Promise<boolean> {
    for (const url of await this.options.openPageUrls()) {
      if (groupOf(await this.options.decide(url)) === group) return true
    }
    return false
  }

  /** The tab's destination and the group whose restriction applies to it now. */
  private async targetOf(
    tabId: number
  ): Promise<{ destination: string; decision: Decision; group: string } | null> {
    const { destination } = await this.options.tabs.get(tabId)
    if (destination === null) return null
    const decision = await this.options.decide(destination)
    const group = groupOf(decision)
    return group === null ? null : { destination, decision, group }
  }

  private siteOf(url: string): string {
    const normalised = normalizeUrl(url, this.options.catalog)
    return 'rejected' in normalised ? '' : normalised.host
  }

  private searchUrlOf(destination: string, query: string): string | null {
    const host = this.siteOf(destination)
    if (!GATE_SEARCH_SITES.has(host)) return null
    const part = siteFeedProfileFor(host, this.options.catalog)?.placeholder.find(
      (candidate) => candidate.kind === 'search'
    )
    if (part?.kind !== 'search') return null
    const url = new URL(part.action, new URL(destination).origin)
    url.searchParams.set(part.param, query.trim())
    return url.href
  }

  /** The pause the engine's `extend` would cost from `state`. */
  private extendPauseOf(state: EscalationState): number {
    return (
      nextEscalation(state, { type: 'extend' }, this.now(), false).state.gate?.pauseSeconds ?? 0
    )
  }

  /** The pause the next attempt would get after closing now (the engine's `close` then `visit`). */
  private nextAttemptPauseOf(state: EscalationState): number {
    const now = this.now()
    const closed = nextEscalation(state, { type: 'close' }, now, false).state
    return nextEscalation(closed, { type: 'visit' }, now, false).state.gate?.pauseSeconds ?? 0
  }

  /** A `visit` on the effective state of every matching friction group (§7.4). */
  private async visit(destination: string, group: string): Promise<EscalationState> {
    const now = this.now()
    const ruleset = await this.options.rulesets.load()
    const winner = ruleset.rules.find((rule) => rule.id === group)
    const own = await this.options.escalation.get(group)
    if (!winner) return own
    const candidates = frictionCandidates(ruleset, destination, now, this.options.catalog)
    const effective = effectiveEscalationState(
      winner,
      candidates,
      await this.options.escalation.all(),
      epochSecondsOf(now)
    )
    const { state } = nextEscalation(effective, { type: 'visit' }, now, false)
    if (state === effective) return own
    await this.options.escalation.put(state)
    await this.record('visit', group)
    await this.options.onChange()
    return state
  }

  private async context(destination: string, group: string): Promise<GateContext> {
    const site = this.siteOf(destination)
    const day = await this.options.day()
    return {
      site,
      visitsToday: day.count('visit', group),
      minutesToday: await this.options.minutesToday(site).catch(() => 0),
    }
  }

  private async recordBypass(before: EscalationState, after: EscalationState): Promise<void> {
    const now = this.now()
    await this.options.outbox.enqueueBypass(
      {
        dedupeKey: (this.options.randomId ?? (() => crypto.randomUUID()))(),
        kind: 'emergency_override',
        occurredAt: now,
        details: {
          targetGroup: after.targetGroup,
          ...(before.overrideReadyAt ? { waitEndedAt: before.overrideReadyAt } : {}),
          grantedAt: now,
          ...(after.overrideEndsAt ? { endsAt: after.overrideEndsAt } : {}),
        },
      },
      now
    )
  }

  private async viewOf(tabId: number): Promise<GateView> {
    const { destination } = await this.options.tabs.get(tabId)
    if (destination === null) return { kind: 'none' }
    const decision = await this.options.decide(destination)
    if (decision.access === 'allow') {
      await this.options.passes.grant(tabId, destination)
      return { kind: 'pass', url: destination }
    }
    const group = groupOf(decision)
    if (group === null) {
      return {
        kind: 'blocked',
        context: { site: this.siteOf(destination), visitsToday: 0, minutesToday: 0 },
        reason: blockReasonOf(decision),
        emergencyAvailable: false,
      }
    }
    let state = await this.options.escalation.get(group)
    if (state.phase === 'override_waiting') {
      return {
        kind: 'waiting',
        context: await this.context(destination, group),
        readyAtMs: epochMs(state.overrideReadyAt) ?? this.options.clock.now(),
      }
    }
    if (decision.access === 'block') {
      return {
        kind: 'blocked',
        context: await this.context(destination, group),
        reason: blockReasonOf(decision),
        emergencyAvailable: true,
      }
    }
    if (state.phase === 'timed_out') {
      const note = await this.options.notes.of(group)
      return {
        kind: 'timed_out',
        context: await this.context(destination, group),
        minutes: note?.minutes ?? null,
        intention: note?.text ? note.text : null,
        nextPauseSeconds: this.extendPauseOf(state),
      }
    }
    if (state.phase !== 'pausing' && state.phase !== 'asking') {
      state = await this.visit(destination, group)
    }
    const gate = state.gate ?? decision.gate
    if (gate === undefined || (state.phase !== 'pausing' && state.phase !== 'asking')) {
      return {
        kind: 'blocked',
        context: await this.context(destination, group),
        reason: 'rule_match',
        emergencyAvailable: true,
      }
    }
    const day = await this.options.day()
    return {
      kind: 'friction',
      context: await this.context(destination, group),
      phase: state.phase,
      gate,
      pauseEndsAtMs: epochMs(state.pauseEndsAt) ?? this.options.clock.now(),
      extension: state.pendingExtension,
      level: {
        level: gate.level,
        brokenToday: day.count('broken'),
        nextPauseSeconds: this.nextAttemptPauseOf(state),
      },
      guardianLinked: false,
      searchAvailable: this.searchUrlOf(destination, 'q') !== null,
      exampleIndex: state.attemptCount,
    }
  }
}
