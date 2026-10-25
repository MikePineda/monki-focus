// SPDX-License-Identifier: AGPL-3.0-or-later
import { starterPreset, type DailyUsage, type Ruleset } from '@monki-focus/rules/pure'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { DecisionService } from '../../src/background/decisions/DecisionService'
import { BypassRecorder } from '../../src/background/gate/BypassRecorder'
import { escalationEntryGuard } from '../../src/background/gate/EscalationEntryGuard'
import { EscalationStore } from '../../src/background/gate/EscalationStore'
import type { GateDiagnosticCode } from '../../src/background/gate/GateDiagnostics'
import { GateController } from '../../src/background/gate/GateController'
import { GateTabs } from '../../src/background/gate/GateTabs'
import { GateTicket } from '../../src/background/gate/GateTicket'
import { IntentionNotes } from '../../src/background/gate/IntentionNotes'
import { UnsavedOverrideGrants } from '../../src/background/gate/UnsavedOverrideGrants'
import { WallClockFloor } from '../../src/background/gate/WallClockFloor'
import { IntentionStatsQuery } from '../../src/background/stats/IntentionStatsQuery'
import type { BypassEventPayload, IntentionEntry } from '../../src/background/storage/db'
import { bundledRulesCatalog } from '../../src/shared/bundledRulesCatalog'
import { ManualClock } from './ManualClock'

export const REDDIT_POST = 'https://www.reddit.com/r/examplesub/comments/abc123/a_post/'
export const REDDIT_GROUP = 'starter-reddit-friction'
export const GATE_URL = 'chrome-extension://test-extension/gate.html'
export const TAB = 7

/** The starter rule set in UTC without bedtime: Reddit and X are gated. */
export function gatedRuleset(overrides: Partial<Ruleset> = {}): Ruleset {
  return {
    ...structuredClone(starterPreset),
    timeZone: 'UTC',
    bedtime: { ...starterPreset.bedtime, enabled: false },
    ...overrides,
  }
}

export interface GateHarnessOptions {
  ruleset?: Ruleset
  usage?: DailyUsage | null
  clock?: ManualClock
}

/**
 * A `GateController` over `fakeBrowser` storage, the real engine and catalog
 * and recording fakes for the browser effects (tabs, passes, outbox). Build
 * a second controller with `restart()` to simulate the service worker dying.
 */
export function gateHarness(options: GateHarnessOptions = {}) {
  const clock = options.clock ?? new ManualClock('2026-01-05T09:00:00Z')
  const catalog = bundledRulesCatalog()
  const state = {
    ruleset: options.ruleset ?? gatedRuleset(),
    usage: options.usage ?? null,
    log: [] as IntentionEntry[],
    bypasses: [] as BypassEventPayload[],
    passes: [] as { tabId: number; url: string }[],
    closed: [] as number[],
    navigations: [] as { tabId: number; url: string }[],
    openPages: [] as string[],
    openTabs: [] as { id: number; url: string }[],
    changes: 0,
    diagnostics: [] as GateDiagnosticCode[],
    /** Failure switches: the intention log, the outbox, escalation writes. */
    logFails: false,
    outboxFails: false,
    escalationWritesFail: false,
  }
  const diagnose = (code: GateDiagnosticCode) => {
    state.diagnostics.push(code)
  }
  const rulesets = { load: () => Promise.resolve(state.ruleset) }

  const build = () => {
    const store = new EscalationStore(fakeBrowser.storage.local, {
      isValid: escalationEntryGuard(catalog, rulesets, () => clock.now()),
      onInvalid: () => diagnose('escalation.invalidEntryDropped'),
    })
    const escalation = Object.assign(store, {
      put: (next: Parameters<EscalationStore['put']>[0]) =>
        state.escalationWritesFail
          ? Promise.reject(new Error('storage.full'))
          : EscalationStore.prototype.put.call(store, next),
    })
    const decisions = new DecisionService({
      catalog,
      rulesets,
      clock,
      states: async () => ({
        escalation: await escalation.all(),
        usage: state.usage,
        unlocks: [],
        guardianLinked: false,
      }),
    })
    const ticket = new GateTicket(fakeBrowser.storage.session)
    const controller = new GateController({
      catalog,
      rulesets,
      clock,
      decide: (url) => decisions.decide(url),
      escalation,
      tabs: new GateTabs(fakeBrowser.storage.session),
      ticket,
      notes: new IntentionNotes(fakeBrowser.storage.session),
      floor: new WallClockFloor(fakeBrowser.storage.local),
      grants: new UnsavedOverrideGrants(fakeBrowser.storage.session),
      log: {
        record: (entry) => {
          if (state.logFails) return Promise.reject(new Error('idb.unavailable'))
          state.log.push(entry)
          return Promise.resolve()
        },
      },
      day: () =>
        new IntentionStatsQuery({
          between: (from, to) =>
            Promise.resolve(state.log.filter((entry) => entry.at >= from && entry.at < to)),
        }).today(clock.now(), state.ruleset.timeZone),
      minutesToday: () => Promise.resolve(12),
      bypasses: new BypassRecorder(
        () =>
          state.outboxFails
            ? Promise.reject(new Error('idb.unavailable'))
            : Promise.resolve({
                enqueueBypass: (event) => {
                  state.bypasses.push(event)
                  return Promise.resolve()
                },
              }),
        fakeBrowser.storage.local,
        diagnose
      ),
      passes: {
        grant: (tabId, url) => {
          state.passes.push({ tabId, url })
          return Promise.resolve(url.length <= 1000)
        },
      },
      closer: {
        close: (tabId) => {
          state.closed.push(tabId)
          return Promise.resolve(true)
        },
      },
      navigate: (tabId, url) => {
        state.navigations.push({ tabId, url })
        return Promise.resolve()
      },
      openTabs: () =>
        Promise.resolve([
          ...state.openTabs,
          ...state.openPages.map((url, index) => ({ id: 100 + index, url })),
        ]),
      hasOverlay: (url) => url.includes('reddit.com'),
      diagnose,
      gateUrl: GATE_URL,
      onChange: () => {
        state.changes += 1
        return Promise.resolve()
      },
      randomId: () => 'bypass-1',
    })
    return { controller, escalation, decisions, ticket }
  }

  let built = build()
  return {
    clock,
    state,
    get controller() {
      return built.controller
    },
    get escalation() {
      return built.escalation
    },
    get decisions() {
      return built.decisions
    },
    /** A valid DNR hand-off for `url` with this session's ticket. */
    async handoff(url: string) {
      return { ticket: await built.ticket.current(), to: url }
    },
    /** A new service worker over the same storage (the old one died). */
    restart() {
      built = build()
    },
  }
}
