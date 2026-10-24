// SPDX-License-Identifier: AGPL-3.0-or-later
import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { SITE_HOST_PERMISSIONS } from '../../../config/extensionManifest'
import { requestFeedDecision } from '../../content/DecisionClient'
import { FeedGuard } from '../../content/FeedGuard'
import { GateSessionGuard } from '../../content/GateSessionGuard'
import { SessionOverlayMount } from '../../content/SessionOverlayMount'
import { SESSION_OVERLAY_CSS } from '../../content/sessionOverlayStyles'
import { feedPlaceholderRenderer } from '../../content/FeedPlaceholderRenderer'
import { PlaceholderMount, randomPlaceholderTag } from '../../content/PlaceholderMount'
import { PLACEHOLDER_CSS } from '../../content/placeholderStyles'
import { watchReevaluationTriggers } from '../../content/ReevaluationTriggers'
import { SpaNavigationWatcher } from '../../content/SpaNavigationWatcher'
import { bundledRulesCatalog } from '../../shared/bundledRulesCatalog'
import { pageSurfaceOf } from '../../shared/FeedSurfaces'
import { randomGuardAttributes } from '../../shared/GuardAttributes'
import { readIntentionPillPreference } from '../../shared/IntentionPillPreference'
import { commandMessage, type CommandMessage } from '../../shared/messages'
import { runtimeClock } from '../../shared/RuntimeClock'
import { siteFeedProfileFor } from '../../sites'

const E2E = import.meta.env.MODE === 'e2e'
/** How often an orphaned instance (extension updated or removed) notices it. */
const ORPHAN_CHECK_MS = 1000
/** Marks the live guard in the extension's isolated world (the page cannot see it). */
const LIVE_GUARD = Symbol.for('monki-focus.feed-guard')

interface LiveGuard {
  alive(): boolean
}

// Wiring only: the behaviour lives in src/content and src/sites.
export default defineContentScript({
  matches: [...SITE_HOST_PERMISSIONS],
  runAt: 'document_start',
  // The UI kit CSS only exists inside the placeholder's shadow root.
  cssInjectionMode: 'manual',
  main() {
    // The manifest and `executeScript` (after an install or update) can both
    // run in a tab: only one live guard per page. An orphan's `alive()` is
    // false, so a fresh version always takes over.
    const scope = globalThis as unknown as Record<symbol, LiveGuard | undefined>
    if (scope[LIVE_GUARD]?.alive()) return
    scope[LIVE_GUARD] = { alive: () => Boolean(browser.runtime?.id) }

    const catalog = bundledRulesCatalog()
    const site = siteFeedProfileFor(pageSurfaceOf(location.href, catalog).host, catalog)
    if (!site) return
    const root = document.documentElement
    const attributes = randomGuardAttributes()
    // E2E builds name the random attributes so specs can find and tamper with them.
    if (E2E)
      root.setAttribute('data-mf-e2e-attributes', `${attributes.hide} ${attributes.restrict}`)

    const placeholder = new PlaceholderMount({
      document,
      site,
      css: PLACEHOLDER_CSS,
      tag: randomPlaceholderTag(),
      shadowMode: E2E ? 'open' : 'closed',
      render: feedPlaceholderRenderer({ site, window, storage: browser.storage.local }),
    })
    const send = (message: CommandMessage) => browser.runtime.sendMessage(message)
    const clock = runtimeClock()
    const overlay = new SessionOverlayMount({
      document,
      css: SESSION_OVERLAY_CSS,
      tag: randomPlaceholderTag(),
      shadowMode: E2E ? 'open' : 'closed',
      storage: browser.storage.local,
      navigatorLanguages: navigator.languages,
      clock,
      onLeave: () => void session.leave().catch(() => undefined),
      onExtend: () => void session.extend().catch(() => undefined),
    })
    const session = new GateSessionGuard({
      clock,
      send,
      overlay,
      // `guard` exists by the time a session ends.
      reevaluate: () => void guard.evaluate(location.href),
      pillEnabled: () => readIntentionPillPreference(browser.storage.local),
      currentUrl: () => location.href,
    })
    let applied = 0
    const guard = new FeedGuard({
      window,
      catalog,
      site,
      attributes,
      placeholder,
      requestDecision: (url) =>
        requestFeedDecision((message) => browser.runtime.sendMessage(message), url),
      attachStylesheet: () =>
        browser.runtime.sendMessage(
          commandMessage('feedGuard.attach', { url: location.href, attributes })
        ),
      onDecision: (answer, url) => session.apply(answer, url),
      ...(E2E
        ? { onApplied: () => root.setAttribute('data-mf-e2e-applied', String(++applied)) }
        : {}),
    })
    const reevaluate = () => void guard.evaluate(location.href)
    const watcher = new SpaNavigationWatcher({ window, onNavigate: reevaluate })

    const stopTriggers = watchReevaluationTriggers({
      window,
      onMessage: browser.runtime.onMessage,
      runtimeId: browser.runtime.id,
      reevaluate,
    })

    // No `ctx.onInvalidated`: a page can fake WXT's "newer script started"
    // event. Only a real orphan (no runtime id any more) tears down.
    const orphanCheck = setInterval(() => {
      if (browser.runtime?.id) return
      clearInterval(orphanCheck)
      watcher.stop()
      stopTriggers()
      session.destroy()
      guard.destroy()
    }, ORPHAN_CHECK_MS)

    void guard.start()
    watcher.start()
  },
})
