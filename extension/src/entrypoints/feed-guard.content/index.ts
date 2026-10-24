// SPDX-License-Identifier: AGPL-3.0-or-later
import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'
import { SITE_HOST_PERMISSIONS } from '../../../config/extensionManifest'
import { requestFeedDecision } from '../../content/DecisionClient'
import { FeedGuard } from '../../content/FeedGuard'
import { feedPlaceholderRenderer } from '../../content/FeedPlaceholderRenderer'
import { PlaceholderMount } from '../../content/PlaceholderMount'
import { PLACEHOLDER_CSS } from '../../content/placeholderStyles'
import { SpaNavigationWatcher } from '../../content/SpaNavigationWatcher'
import { bundledRulesCatalog } from '../../shared/bundledRulesCatalog'
import { pageSurfaceOf } from '../../shared/FeedSurfaces'
import { siteFeedProfileFor } from '../../sites'

// Wiring only: the behaviour lives in src/content and src/sites.
export default defineContentScript({
  matches: [...SITE_HOST_PERMISSIONS],
  runAt: 'document_start',
  // The UI kit CSS only exists inside the placeholder's shadow root.
  cssInjectionMode: 'manual',
  main(ctx) {
    const catalog = bundledRulesCatalog()
    const site = siteFeedProfileFor(pageSurfaceOf(location.href, catalog).host, catalog)
    if (!site) return

    const placeholder = new PlaceholderMount({
      document,
      site,
      css: PLACEHOLDER_CSS,
      render: feedPlaceholderRenderer({ site, window, storage: browser.storage.local }),
    })
    const guard = new FeedGuard({
      window,
      catalog,
      site,
      placeholder,
      requestDecision: (url) =>
        requestFeedDecision((message) => browser.runtime.sendMessage(message), url),
    })
    const watcher = new SpaNavigationWatcher({
      window,
      onNavigate: (url) => void guard.evaluate(url),
    })
    void guard.start()
    watcher.start()
    ctx.onInvalidated(() => {
      watcher.stop()
      placeholder.destroy()
    })
  },
})
