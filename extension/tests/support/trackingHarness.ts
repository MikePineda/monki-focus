// SPDX-License-Identifier: AGPL-3.0-or-later
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { MonkiDb } from '../../src/background/storage/db'
import { IdbBlockRepository } from '../../src/background/storage/IdbBlockRepository'
import { IdbEventRepository } from '../../src/background/storage/IdbEventRepository'
import { RulesetStore } from '../../src/background/rules/RulesetStore'
import { DEVICE_ID_STORAGE_NAME } from '../../src/background/tracking/DeviceIdentity'
import { bundledRulesCatalog } from '../../src/shared/bundledRulesCatalog'
import { PRODUCTION_TIMING } from '../../src/background/tracking/TrackingTiming'
import type * as TrackingModuleExports from '../../src/background/tracking/TrackingModule'
import { FakeTrackingBrowser, type FakeTabState } from './FakeTrackingBrowser'
import { ManualClock } from './ManualClock'
import { ManualTimer } from './ManualTimer'
import { freshDb } from './testDb'

export const DEVICE_ID = 'device-a'
export const BUCKET = `monki-web-chrome_${DEVICE_ID}`

export interface TrackingHarness {
  browser: FakeTrackingBrowser
  clock: ManualClock
  timer: ManualTimer
  db: MonkiDb
  module: TrackingModuleExports.TrackingModule
  events: IdbEventRepository
  blocks: IdbBlockRepository
  /** The `pulse` alarm fires after `seconds` more seconds. */
  alarmPulseAfter(seconds: number): Promise<void>
  /** Waits for every queued pulse. */
  settle(): Promise<void>
}

/**
 * A started tracking module over `fakeBrowser` storage, a fresh database, a
 * scripted browser and a manual clock (`fakeBrowser.reset()` first). Pass
 * `load` to build it from a freshly imported module graph (a restarted
 * service worker) and `db` to reuse the database.
 */
export async function startTracking(options: {
  now: string
  timeZone?: string
  db?: MonkiDb
  clock?: ManualClock
  /** Already open in the focused window when the worker starts. */
  activeTab?: FakeTabState
  load?: () => Promise<typeof TrackingModuleExports>
  /** The native bridge hooks (`NativeBridgeModule`). */
  onHeartbeat?: TrackingModuleExports.TrackingModuleDependencies['onHeartbeat']
  syncBlocks?: TrackingModuleExports.TrackingModuleDependencies['syncBlocks']
}): Promise<TrackingHarness> {
  const { createTrackingModule } = await (
    options.load ?? (() => import('../../src/background/tracking/TrackingModule'))
  )()
  await fakeBrowser.storage.local.set({ [DEVICE_ID_STORAGE_NAME]: DEVICE_ID })
  const browser = new FakeTrackingBrowser()
  if (options.activeTab) browser.preset(options.activeTab)
  const clock = options.clock ?? new ManualClock(options.now)
  const timer = new ManualTimer()
  const db = options.db ?? (await freshDb())
  const module = createTrackingModule({
    browser: browser.api,
    clock,
    timing: PRODUCTION_TIMING,
    catalog: bundledRulesCatalog(),
    rulesets: new RulesetStore({
      storage: fakeBrowser.storage.local,
      deviceTimeZone: () => options.timeZone ?? 'UTC',
    }),
    openDb: async () => db,
    setTimer: timer.set,
    fallbackTimeZone: options.timeZone ?? 'UTC',
    ...(options.onHeartbeat ? { onHeartbeat: options.onHeartbeat } : {}),
    ...(options.syncBlocks ? { syncBlocks: options.syncBlocks } : {}),
  })
  module.start()
  await module.ready()
  const settle = () => module.settled()
  await settle()
  return {
    browser,
    clock,
    timer,
    db,
    module,
    events: new IdbEventRepository(db),
    blocks: new IdbBlockRepository(db),
    async alarmPulseAfter(seconds) {
      clock.advanceSeconds(seconds)
      await fakeBrowser.alarms.onAlarm.trigger({
        name: 'pulse',
        scheduledTime: clock.now(),
        persistAcrossSessions: false,
      })
      await settle()
    },
    settle,
  }
}
