// SPDX-License-Identifier: AGPL-3.0-or-later
import { activityWatchBucketId } from '@monki-focus/analytics'
import { instantOf, type RulesCatalog } from '@monki-focus/engine'
import type { Decision, DecisionState, Ruleset } from '@monki-focus/rules/pure'
import type { Clock } from '../../shared/clock'
import type { ActiveSession } from '../../shared/GateContract'
import { IntentionStatsQuery } from '../stats/IntentionStatsQuery'
import type { MonkiDb } from '../storage/db'
import { IdbEventRepository } from '../storage/IdbEventRepository'
import { IntentionLog } from '../storage/IntentionLog'
import { Outbox } from '../storage/Outbox'
import { DEVICE_ID_STORAGE_NAME } from '../tracking/DeviceIdentity'
import { DailyUsageQuery } from './DailyUsageQuery'
import { EscalationStore } from './EscalationStore'
import { GateCommands } from './GateCommands'
import { GateController } from './GateController'
import { GateRedirectRules, type SessionRulesApi } from './GateRedirectRules'
import { GateTabs } from './GateTabs'
import { GateTicket } from './GateTicket'
import { GATE_TIMER_ALARM, GateTimers, type TimerAlarmsApi } from './GateTimers'
import { IntentionNotes } from './IntentionNotes'
import { TabCloser, type ClosingTabsApi } from './TabCloser'
import { TabPasses } from './TabPasses'

/** Raw intention facts are kept as long as raw events (E7). */
const INTENTION_RETENTION_MS = 30 * 86_400_000

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

interface TabChangeEvent {
  addListener(
    listener: (
      tabId: number,
      changeInfo: { status?: string | undefined },
      tab: { url?: string | undefined }
    ) => void
  ): void
}

/** The slice of the browser the gate uses. */
export interface GateBrowser {
  runtime: { id: string }
  storage: { local: StorageArea; session: StorageArea }
  alarms: TimerAlarmsApi & {
    onAlarm: { addListener(listener: (alarm: { name: string }) => void): void }
  }
  tabs: ClosingTabsApi & {
    update(tabId: number, properties: { url: string }): Promise<unknown>
    queryAll(): Promise<{ url?: string | undefined }[]>
    onUpdated: TabChangeEvent
    onRemoved: { addListener(listener: (tabId: number) => void): void }
  }
  declarativeNetRequest: SessionRulesApi
}

export interface GateModuleDependencies {
  browser: GateBrowser
  clock: Clock
  catalog: RulesCatalog
  rulesets: { load(): Promise<Ruleset> }
  openDb: () => Promise<MonkiDb>
  /** The engine's decision for a URL (`DecisionService.decide`, fed by `decisionState`). */
  decide: (url: string) => Promise<Decision>
  /** Minutes tracked today on a normalised host (E7). */
  minutesToday: (site: string) => Promise<number>
  /** Tells the open site pages to ask for their decision again. */
  broadcast: () => Promise<void>
}

export interface GateModule {
  /** Adds the listeners; call from the worker's first turn. */
  start(): void
  /** Escalation, usage and unlocks for `decide` (the engine's `DecisionState`). */
  decisionState(): Promise<DecisionState>
  /** Re-syncs the redirects after a rule set change or a schedule edge. */
  refresh(): Promise<void>
  commands: GateCommands
  sessionFor(url: string, decision: Decision): Promise<ActiveSession | undefined>
}

function isWebPage(url: string | undefined): url is string {
  return url !== undefined && /^https?:\/\//.test(url)
}

/** Composition root of the intention gate (E6). */
export function createGateModule(deps: GateModuleDependencies): GateModule {
  const { browser, clock, catalog, rulesets, decide } = deps
  const escalation = new EscalationStore(browser.storage.local)
  const tabs = new GateTabs(browser.storage.session)
  const ticket = new GateTicket(browser.storage.session)
  const notes = new IntentionNotes(browser.storage.session)
  const passes = new TabPasses(browser.declarativeNetRequest, browser.storage.session, () =>
    clock.now()
  )
  const db = deps.openDb()
  db.catch(() => undefined)
  const log = db.then((opened) => new IntentionLog(opened))
  log.catch(() => undefined)

  const usage = new DailyUsageQuery({
    catalog,
    rulesets,
    events: async (from, to) => {
      const stored = (await browser.storage.local.get(DEVICE_ID_STORAGE_NAME))[
        DEVICE_ID_STORAGE_NAME
      ]
      // Only read: the tracker owns creating the device id.
      if (typeof stored !== 'string') return []
      const bucketId = activityWatchBucketId('web.tab.current', stored)
      return new IdbEventRepository(await db).between(bucketId, from, to)
    },
  })

  const redirects = new GateRedirectRules({
    dnr: browser.declarativeNetRequest,
    catalog,
    rulesets,
    decide,
    ticket: () => ticket.current(),
    runtimeId: browser.runtime.id,
  })

  const gateUrl = `chrome-extension://${browser.runtime.id}/gate.html`
  // `controller` exists by the time a timer is scheduled.
  const timers = new GateTimers(browser.alarms, clock, () => controller.nextTimerAt())
  const onChange = async () => {
    await redirects.sync().catch(() => undefined)
    await timers.schedule().catch(() => undefined)
    await deps.broadcast().catch(() => undefined)
  }

  const controller = new GateController({
    catalog,
    rulesets,
    clock,
    decide,
    escalation,
    tabs,
    ticket,
    notes,
    log: { record: async (entry) => (await log).record(entry) },
    day: async () =>
      new IntentionStatsQuery(await log).today(clock.now(), (await rulesets.load()).timeZone),
    minutesToday: deps.minutesToday,
    outbox: { enqueueBypass: async (event, at) => new Outbox(await db).enqueueBypass(event, at) },
    passes,
    closer: new TabCloser(browser.tabs),
    navigate: async (tabId, url) => {
      await browser.tabs.update(tabId, { url })
    },
    openPageUrls: async () =>
      (await browser.tabs.queryAll()).map((tab) => tab.url).filter(isWebPage),
    gateUrl,
    onChange,
  })

  return {
    start() {
      browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === GATE_TIMER_ALARM) void controller.tick().catch(() => undefined)
      })
      browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        // A pass is spent once the tab has loaded a web page.
        if (changeInfo.status === 'complete' && isWebPage(tab.url)) {
          void passes.revoke(tabId).catch(() => undefined)
        }
      })
      browser.tabs.onRemoved.addListener((tabId) => {
        void passes.revoke(tabId).catch(() => undefined)
        void tabs.forget(tabId).catch(() => undefined)
      })
      void redirects.sync().catch(() => undefined)
      void timers.schedule().catch(() => undefined)
      void log
        .then((opened) => opened.deleteBefore(instantOf(clock.now() - INTENTION_RETENTION_MS)))
        .catch(() => undefined)
    },
    async decisionState() {
      return {
        escalation: await escalation.all(),
        // Usage only adds budget blocks; if it cannot be read, decide without it.
        usage: await usage.usageAt(clock.now()).catch(() => null),
        unlocks: [],
        guardianLinked: false,
      }
    },
    async refresh() {
      if (await redirects.sync()) await deps.broadcast().catch(() => undefined)
    },
    commands: new GateCommands(controller),
    sessionFor: (url, decision) => controller.sessionFor(url, decision),
  }
}
