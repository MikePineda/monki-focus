// SPDX-License-Identifier: AGPL-3.0-or-later
import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { CommandRouter } from '../background/commands/CommandRouter'
import { createCommandHandlers, type FeedDecisions } from '../background/commands/commands'
import { DecisionService } from '../background/decisions/DecisionService'
import {
  RESTRICTION_ALARM,
  RESTRICTION_CHECK_MINUTES,
  RestrictionWatcher,
} from '../background/decisions/RestrictionWatcher'
import { delayedFeedDecisions } from '../background/e2e/DecisionDelay'
import { SiteTabs } from '../background/feeds/SiteTabs'
import { UserStylesheetInjector } from '../background/feeds/UserStylesheetInjector'
import { deviceTimeZone } from '../background/rules/DeviceTimeZone'
import { RulesetStore } from '../background/rules/RulesetStore'
import { ShortsRedirectSync } from '../background/shorts/ShortsRedirectSync'
import { bundledRulesCatalog } from '../shared/bundledRulesCatalog'
import { systemClock } from '../shared/clock'
import { decisionChangedMessage } from '../shared/messages'

// Wiring only: every behaviour lives in a module under src/background.
// Failures are swallowed here on purpose (reason codes only, never URLs):
// each piece fails closed on its own.
export default defineBackground(() => {
  const catalog = bundledRulesCatalog()
  const rulesets = new RulesetStore({ storage: browser.storage.local, deviceTimeZone })
  const decisionService = new DecisionService({ catalog, rulesets, clock: systemClock })
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
    catalog,
    restriction: decisionService,
    storage: browser.storage.session,
    onChange: decisionsChanged,
  })

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
  })
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === RESTRICTION_ALARM) void restrictions.check().catch(() => undefined)
  })
  void browser.alarms.create(RESTRICTION_ALARM, { periodInMinutes: RESTRICTION_CHECK_MINUTES })
  void shortsRedirect.sync().catch(() => undefined)
  void restrictions.check().catch(() => undefined)
})
