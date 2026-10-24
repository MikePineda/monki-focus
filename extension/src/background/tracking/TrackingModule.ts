// SPDX-License-Identifier: AGPL-3.0-or-later
import { activityWatchBucketId } from '@monki-focus/analytics'
import type { RulesCatalog } from '@monki-focus/engine'
import type { Browser } from 'wxt/browser'
import type { Clock } from '../../shared/clock'
import type { IncognitoAccess, TodayStats, WeekStats } from '../../shared/StatsContract'
import { IncognitoAccessCheck, type IncognitoExtensionApi } from '../privacy/IncognitoAccessCheck'
import { deviceTimeZone } from '../rules/DeviceTimeZone'
import type { RulesetStore } from '../rules/RulesetStore'
import { IntentionStatsQuery } from '../stats/IntentionStatsQuery'
import { TodayStatsQuery } from '../stats/TodayStatsQuery'
import { WeekStatsQuery } from '../stats/WeekStatsQuery'
import { openMonkiDb, type MonkiDb } from '../storage/db'
import { IdbBlockRepository } from '../storage/IdbBlockRepository'
import { IdbEventRepository } from '../storage/IdbEventRepository'
import { IntentionLog } from '../storage/IntentionLog'
import { Outbox } from '../storage/Outbox'
import { Retention } from '../storage/Retention'
import { ActiveTabProbe } from './ActiveTabProbe'
import { ActivityTracker } from './ActivityTracker'
import { AGGREGATE_ALARM, AggregationJob } from './AggregationJob'
import { readAnalyticsRules } from './AnalyticsRules'
import { deviceId } from './DeviceIdentity'
import { HeartbeatRecorder } from './HeartbeatRecorder'
import { IdleWatcher } from './IdleWatcher'
import { ensureAlarm } from './PeriodicAlarm'
import { PulseScheduler, type Timer } from './PulseScheduler'
import type { TrackingBrowser } from './TrackingBrowser'
import { readTrackingSettings } from './TrackingSettings'
import type { TrackingTiming } from './TrackingTiming'
import { WindowFocusGrace } from './WindowFocusGrace'

type StorageArea = Pick<Browser.storage.StorageArea, 'get' | 'set' | 'remove'>

export interface TrackingModuleDependencies {
  browser: TrackingBrowser & {
    storage: { local: StorageArea; session: StorageArea }
    extension: IncognitoExtensionApi
  }
  clock: Clock
  timing: TrackingTiming
  /** The engine catalog over the bundled rules data (`bundledRulesCatalog`). */
  catalog: RulesCatalog
  /** The single owner of the active rule set (pinned zone, categories). */
  rulesets: Pick<RulesetStore, 'load'>
  openDb?: () => Promise<MonkiDb>
  setTimer?: Timer
  /** Zone for days if the stored rule set's zone does not resolve. */
  fallbackTimeZone?: string
}

/** The read side the command router exposes (`stats.*`, `privacy.*`). */
export interface TrackingCommands {
  today(): Promise<TodayStats>
  week(): Promise<WeekStats>
  incognitoAccess(): Promise<IncognitoAccess>
}

export interface TrackingModule {
  /** Adds every listener and alarm; call synchronously from the worker's first turn. */
  start(): void
  /** Resolves once the stores are open (tests and the first pulse wait on it). */
  ready(): Promise<unknown>
  commands: TrackingCommands
  /** Runs one aggregation now (the alarm does it every 5 minutes). */
  aggregate(): Promise<void>
  /** One immediate pulse, outside the scheduler. */
  pulse(closeAtMs?: number | null): Promise<void>
  /** Resolves once every pulse started so far has been recorded. */
  settled(): Promise<void>
}

/**
 * Composition root of tracking: probing (scheduler, probe, recorder),
 * storage (IndexedDB repositories, retention, outbox), aggregation and the
 * stats read API. The stores open lazily; listeners never wait for them.
 */
export function createTrackingModule(deps: TrackingModuleDependencies): TrackingModule {
  const { browser, clock, timing, catalog } = deps
  const local = browser.storage.local
  const fallbackTimeZone = deps.fallbackTimeZone ?? deviceTimeZone()
  const rules = () => readAnalyticsRules(deps.rulesets, fallbackTimeZone)
  const focus = new WindowFocusGrace(timing.focusGraceMs)
  const idle = new IdleWatcher(browser.idle, timing.assumeUserActive)
  const probe = new ActiveTabProbe({
    windows: browser.windows,
    tabs: browser.tabs,
    idle,
    focus,
    settings: () => readTrackingSettings(local),
    catalog,
  })

  const wired = (async () => {
    const db = await (deps.openDb ?? openMonkiDb)()
    const device = await deviceId(local)
    const bucketId = activityWatchBucketId('web.tab.current', device)
    const events = new IdbEventRepository(db)
    const blocks = new IdbBlockRepository(db)
    const recorder = new HeartbeatRecorder(
      browser.storage.session,
      events,
      bucketId,
      timing.pulsetimeSeconds
    )
    const job = new AggregationJob({
      events,
      blocks,
      outbox: new Outbox(db),
      retention: new Retention(events),
      local,
      rules,
      catalog,
      deviceId: device,
      bucketId,
    })
    return {
      tracker: new ActivityTracker(clock, probe, recorder),
      job,
      today: new TodayStatsQuery(blocks, new IntentionStatsQuery(new IntentionLog(db))),
      week: new WeekStatsQuery(blocks),
    }
  })()
  // Callers see a failure to open the stores; it is never an unhandled rejection.
  wired.catch(() => undefined)

  const pulse = async (closeAtMs: number | null = null) => {
    await (await wired).tracker.pulse({ closeAtMs })
  }
  const aggregate = async () => {
    await (await wired).job.run(clock.now())
  }
  const incognito = new IncognitoAccessCheck(browser.extension)

  return {
    start() {
      new PulseScheduler({
        browser,
        idle,
        focus,
        clock,
        timing,
        pulse: ({ closeAtMs }) => pulse(closeAtMs).catch(() => undefined),
        ...(deps.setTimer ? { setTimer: deps.setTimer } : {}),
      }).start()
      browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === AGGREGATE_ALARM) void aggregate().catch(() => undefined)
      })
      void ensureAlarm(browser.alarms, AGGREGATE_ALARM, timing.aggregateMinutes)
      void aggregate().catch(() => undefined)
    },
    ready: () => wired,
    settled: async () => (await wired).tracker.settled(),
    aggregate,
    pulse,
    commands: {
      // Fresh numbers: fold the latest heartbeats into blocks before reading.
      async today() {
        await aggregate()
        const { timeZone } = await rules()
        return (await wired).today.run(clock.now(), timeZone)
      },
      async week() {
        await aggregate()
        const { timeZone } = await rules()
        return (await wired).week.run(clock.now(), timeZone)
      },
      incognitoAccess: () => incognito.check(),
    },
  }
}
