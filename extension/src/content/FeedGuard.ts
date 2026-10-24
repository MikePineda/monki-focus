// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RulesCatalog } from '@monki-focus/engine'
import type { FeedDecision } from '../shared/messages'
import type { SiteFeedProfile } from '../sites/SiteFeedProfile'
import { failClosedHideState } from './FailClosedHideState'
import { FeedHider, type HideState } from './FeedHider'
import { installFeedStylesheet } from './FeedStylesheet'
import { redirectShorts } from './ShortsRedirector'

/** How long the guard waits for the service worker before it settles closed. */
export const DECISION_TIMEOUT_MS = 1500

/** The slice of `PlaceholderMount` the guard drives. */
export interface PlaceholderSlot {
  show(surface: string | null): void
}

export interface FeedGuardOptions {
  window: Window
  catalog: RulesCatalog
  site: SiteFeedProfile
  requestDecision: (url: string) => Promise<FeedDecision>
  placeholder: PlaceholderSlot
  timeoutMs?: number
}

/** The hidden page surface the placeholder stands in for, if any. */
function placeholderSurfaceOf(state: HideState, surface: string | null): string | null {
  if (surface !== null && state.hide.includes(surface)) return surface
  return state.hide[0] ?? null
}

/**
 * Hides feeds on one page, driven only by the engine's decisions:
 *
 * 1. `start()` injects the attribute-scoped stylesheet at `document_start`.
 * 2. Every evaluation (load and each SPA navigation) first applies the
 *    fail-closed state (the page's surface when the catalog says it is a
 *    feed, and the site's feed entry points), so nothing flashes.
 * 3. It asks the service worker; the answer replaces that state, mounts the
 *    placeholder where a feed is hidden and redirects restricted Shorts.
 * 4. If no answer arrives within `DECISION_TIMEOUT_MS` (or the request
 *    fails) the page stays closed and the placeholder is shown; a late
 *    answer still applies. Answers for a URL the page already left are dropped.
 */
export class FeedGuard {
  private readonly hider: FeedHider
  private sequence = 0

  constructor(private readonly options: FeedGuardOptions) {
    this.hider = new FeedHider(options.window.document.documentElement)
  }

  start(): Promise<void> {
    installFeedStylesheet(this.options.window.document, this.options.site)
    return this.evaluate(this.options.window.location.href)
  }

  /** Re-evaluates the page; `url` is the page's current URL. */
  async evaluate(url: string): Promise<void> {
    const { catalog, placeholder, requestDecision, window } = this.options
    const sequence = ++this.sequence
    const isCurrent = () => sequence === this.sequence

    const closed = failClosedHideState(url, catalog)
    const closedSurface = placeholderSurfaceOf(closed, null)
    this.hider.apply(closed)
    placeholder.show(null)

    let answered = false
    const timer = setTimeout(() => {
      if (!answered && isCurrent()) placeholder.show(closedSurface)
    }, this.options.timeoutMs ?? DECISION_TIMEOUT_MS)

    let answer: FeedDecision
    try {
      answer = await requestDecision(url)
    } catch {
      clearTimeout(timer)
      // No answer at all: keep the fail-closed state.
      if (isCurrent()) placeholder.show(closedSurface)
      return
    } finally {
      answered = true
    }
    clearTimeout(timer)
    if (!isCurrent()) return

    if (redirectShorts(answer, window.location)) return
    const state: HideState = { hide: answer.hide, restrict: answer.restrict }
    this.hider.apply(state)
    placeholder.show(placeholderSurfaceOf(state, answer.surface))
  }
}
