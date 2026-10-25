// SPDX-License-Identifier: AGPL-3.0-or-later
import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { CommandRouter } from '../background/commands/CommandRouter'
import { createCommandHandlers, type FeedDecisions } from '../background/commands/commands'
import { DecisionService, EMPTY_DECISION_STATE } from '../background/decisions/DecisionService'
import {
  RESTRICTION_ALARM,
  RESTRICTION_CHECK_MINUTES,
  RestrictionWatcher,
} from '../background/decisions/RestrictionWatcher'
import { VALIDITY_ALARM, ValidityAlarm } from '../background/decisions/ValidityAlarm'
import { delayedFeedDecisions } from '../background/e2e/DecisionDelay'
import { SiteTabs } from '../background/feeds/SiteTabs'
import { browserKind } from '../background/native/BrowserKind'
import { extensionVersion } from '../background/native/ExtensionVersion'
import { createNativeBridgeModule } from '../background/native/NativeBridgeModule'
import { UserStylesheetInjector } from '../background/feeds/UserStylesheetInjector'
import { createGateModule, type GateModule } from '../background/gate/GateModule'
import { PreferenceService } from '../background/preferences/PreferenceService'
import { deviceTimeZone } from '../background/rules/DeviceTimeZone'
import { PendingRuleChangeStore } from '../background/rules/PendingRuleChangeStore'
import {
  PENDING_RULES_ALARM,
  RuleChangeService,
  pendingRulesAlarm,
} from '../background/rules/RuleChangeService'
import { RulesetStore } from '../background/rules/RulesetStore'
import { ShortsRedirectSync } from '../background/shorts/ShortsRedirectSync'
import { openMonkiDb } from '../background/storage/db'
import { DbConnection } from '../background/storage/DbConnection'
import { createTrackingModule } from '../background/tracking/TrackingModule'
import { trackingTimingFor } from '../background/tracking/TrackingTiming'
import { bundledRulesCatalog } from '../shared/bundledRulesCatalog'
import { systemClock } from '../shared/clock'
import { decisionChangedMessage } from '../shared/messages'
import { runtimeClock } from '../shared/RuntimeClock'

// Wiring only: every behaviour lives in a module under src/background.
// Failures are swallowed here on purpose (reason codes only, never URLs):
// each piece fails closed on its own.
export default defineBackground(() => {
  const catalog = bundledRulesCatalog()
  const rulesets = new RulesetStore({ storage: browser.storage.local, deviceTimeZone })
  // The gate and the decisions share one clock (shifted by specs in the e2e build).
  const gateClock = runtimeClock()
  // The decisions read the gate's state; the gate decides with them.
  const gateHolder: { module?: GateModule } = {}
  // One alarm at the earliest `validUntil` of every decision the worker makes.
  const validity = new ValidityAlarm(browser.alarms, gateClock)
  const decisionService = new DecisionService({
    catalog,
    rulesets,
    clock: gateClock,
    states: () => gateHolder.module?.decisionState() ?? EMPTY_DECISION_STATE,
    onValidity: (validUntil) => void validity.offer(validUntil),
  })
  const ruleChanges = new RuleChangeService({
    rulesets,
    pending: new PendingRuleChangeStore(browser.storage.local),
    catalog,
    clock: gateClock,
    onPendingChanged: pendingRulesAlarm(browser.alarms),
  })
  const shortsRedirect = new ShortsRedirectSync(decisionService, browser.declarativeNetRequest)
  const siteTabs = new SiteTabs({
    query: (query) => browser.tabs.query(query),
    sendMessage: (tabId, message) => browser.tabs.sendMessage(tabId, message),
    executeScript: (injection) => browser.scripting.executeScript(injection),
  })
  const decisionsChanged = async () => {
    await shortsRedirect.sync().catch(() => undefined)
    await siteTabs.broadcast(decisionChangedMessage()).catch(() => undefined)
  }
  const restrictions = new RestrictionWatcher({
    rulesets,
    clock: gateClock,
    usage: async () => (await gateHolder.module?.decisionState())?.usage ?? null,
    storage: browser.storage.session,
    onChange: decisionsChanged,
  })

  // The bridge to the macOS app (when installed): it mirrors heartbeats to
  // the app and, while the app aggregates this device, stops block sync.
  const bridge = createNativeBridgeModule({
    connectNative: (hostName) => browser.runtime.connectNative(hostName),
    readLastError: () => browser.runtime.lastError,
    permissions: browser.permissions,
    extensionVersion: extensionVersion(browser.runtime),
    browserKind: browserKind(navigator),
    session: browser.storage.session,
    windows: browser.windows,
    alarms: browser.alarms,
    clock: systemClock,
  })

  // One connection for tracking and the gate; a failed open is retried, never cached.
  const db = new DbConnection(() => openMonkiDb())
  const tracking = createTrackingModule({
    browser,
    clock: systemClock,
    timing: trackingTimingFor(import.meta.env.MODE),
    catalog,
    rulesets,
    openDb: () => db.get(),
    onHeartbeat: (next, closeAt) => {
      bridge.onHeartbeat(next, closeAt)
    },
    syncBlocks: () => bridge.syncBlocks(),
  })

  const gate = createGateModule({
    browser: {
      ...browser,
      tabs: {
        get: (tabId) => browser.tabs.get(tabId),
        query: (query) => browser.tabs.query(query),
        queryAll: () => browser.tabs.query({}),
        create: (properties) => browser.tabs.create(properties),
        remove: (tabId) => browser.tabs.remove(tabId),
        update: (tabId, properties) => browser.tabs.update(tabId, properties),
        onUpdated: browser.tabs.onUpdated,
        onRemoved: browser.tabs.onRemoved,
      },
    },
    clock: gateClock,
    catalog,
    rulesets,
    openDb: () => db.get(),
    decide: (url) => decisionService.decide(url),
    minutesToday: async (site) => {
      const today = await tracking.commands.today()
      const seconds = today.topActivities.find((top) => top.activityKey === site)?.seconds ?? 0
      return Math.floor(seconds / 60)
    },
    broadcast: async () => {
      await siteTabs.broadcast(decisionChangedMessage())
    },
  })
  gateHolder.module = gate

  let decisions: FeedDecisions = decisionService
  if (import.meta.env.MODE === 'e2e') {
    decisions = delayedFeedDecisions(decisionService, browser.storage.local)
  }

  const router = new CommandRouter(
    browser.runtime.id,
    createCommandHandlers({
      clock: systemClock,
      catalog,
      decisions,
      stylesheets: new UserStylesheetInjector(catalog, browser.scripting),
      shortsRedirect,
      tracking: tracking.commands,
      gate,
      intentions: gate.intentions,
      rules: ruleChanges,
      preferences: new PreferenceService(browser.storage.local),
      localData: tracking.localData,
    })
  )
  router.listen(browser.runtime.onMessage)

  browser.runtime.onInstalled.addListener(({ reason }) => {
    // Pins the device time zone into the starter rule set at install.
    if (reason === 'install') void rulesets.ensureCreated().catch(() => undefined)
    // Tabs opened before this version have no (or an orphaned) feed guard.
    if (reason === 'install' || reason === 'update') {
      void siteTabs.injectFeedGuard().catch(() => undefined)
    }
  })
  rulesets.watch(browser.storage.onChanged, () => {
    void decisionsChanged()
    void restrictions.check().catch(() => undefined)
    void gate.refresh().catch(() => undefined)
  })
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === PENDING_RULES_ALARM) void ruleChanges.promoteIfDue().catch(() => undefined)
    if (alarm.name === VALIDITY_ALARM) {
      // A decision ran out: decide the redirects and the open pages again.
      validity.rang()
      void decisionsChanged()
      void restrictions.check().catch(() => undefined)
      void gate.refresh().catch(() => undefined)
      return
    }
    if (alarm.name !== RESTRICTION_ALARM) return
    // The coarse backstop: a lost alarm, a changed clock, usage that kept accruing.
    void restrictions.check().catch(() => undefined)
    // Schedule edges and spent budgets change which sites the gate redirects.
    void gate.refresh().catch(() => undefined)
    // The per-minute check also catches a pending change whose alarm was lost.
    void ruleChanges.promoteIfDue().catch(() => undefined)
  })
  void browser.alarms.create(RESTRICTION_ALARM, { periodInMinutes: RESTRICTION_CHECK_MINUTES })
  void ruleChanges.promoteIfDue().catch(() => undefined)
  void shortsRedirect.sync().catch(() => undefined)
  void restrictions.check().catch(() => undefined)
  tracking.start()
  gate.start()
  bridge.start()
})
