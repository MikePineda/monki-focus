// SPDX-License-Identifier: AGPL-3.0-or-later
import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { CommandRouter } from '../background/commands/CommandRouter'
import { createCommandHandlers, type FeedDecisions } from '../background/commands/commands'
import { DecisionService } from '../background/decisions/DecisionService'
import { delayedFeedDecisions } from '../background/e2e/DecisionDelay'
import { deviceTimeZone } from '../background/rules/DeviceTimeZone'
import { RulesetStore } from '../background/rules/RulesetStore'
import { ShortsRedirectSync } from '../background/shorts/ShortsRedirectSync'
import { bundledRulesCatalog } from '../shared/bundledRulesCatalog'
import { systemClock } from '../shared/clock'

// Wiring only: every behaviour lives in a module under src/background.
export default defineBackground(() => {
  const catalog = bundledRulesCatalog()
  const rulesets = new RulesetStore({ storage: browser.storage.local, deviceTimeZone })
  const decisionService = new DecisionService({ catalog, rulesets, clock: systemClock })
  const shortsRedirect = new ShortsRedirectSync(decisionService, browser.declarativeNetRequest)
  // Reason codes only, never URLs: a failed toggle leaves the manifest default (on).
  const syncShorts = () => void shortsRedirect.sync().catch(() => undefined)

  let decisions: FeedDecisions = decisionService
  if (import.meta.env.MODE === 'e2e') {
    decisions = delayedFeedDecisions(decisionService, browser.storage.local)
  }

  const router = new CommandRouter(
    browser.runtime.id,
    createCommandHandlers({ clock: systemClock, catalog, decisions, shortsRedirect })
  )
  router.listen(browser.runtime.onMessage)

  browser.runtime.onInstalled.addListener(({ reason }) => {
    // Pins the device time zone into the starter rule set at install.
    if (reason === 'install') void rulesets.ensureCreated().catch(() => undefined)
  })
  rulesets.watch(browser.storage.onChanged, syncShorts)
  syncShorts()
})
