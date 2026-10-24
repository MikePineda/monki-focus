// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RulesCatalog } from '@monki-focus/engine'
import { feedStylesheetText } from '../shared/FeedStylesheet'
import type { GuardAttributes } from '../shared/GuardAttributes'
import type { FeedDecision } from '../shared/messages'
import type { SiteFeedProfile } from '../sites/SiteFeedProfile'
import { failClosedHideState } from './FailClosedHideState'
import { FeedHider, type HideState } from './FeedHider'
import { GuardStylesheet } from './GuardStylesheet'
import { redirectShorts } from './ShortsRedirector'

/** How long the guard waits for the service worker before it settles closed. */
export const DECISION_TIMEOUT_MS = 1500

/** The slice of `PlaceholderMount` the guard drives. */
export interface PlaceholderSlot {
  show(surface: string | null): void
  destroy(): void
}

export interface FeedGuardOptions {
  window: Window
  catalog: RulesCatalog
  site: SiteFeedProfile
  /** This page's random attribute names (`randomGuardAttributes`). */
  attributes: GuardAttributes
  requestDecision: (url: string) => Promise<FeedDecision>
  /** Asks the service worker to inject the stylesheet with the `USER` origin. */
  attachStylesheet?: () => Promise<unknown>
  placeholder: PlaceholderSlot
  timeoutMs?: number
  /** Called after each answer is applied (E2E builds mark the page). */
  onApplied?: () => void
  /**
   * Every applied answer for the page's URL, for the intention gate (E6):
   * gated pages go to the gate, running intentions show their pill.
   */
  onDecision?: (answer: FeedDecision, url: string) => void
}

/** The hidden page surface the placeholder stands in for, if any. */
function placeholderSurfaceOf(state: HideState, surface: string | null): string | null {
  if (surface !== null && state.hide.includes(surface)) return surface
  return state.hide[0] ?? null
}

/**
 * Hides feeds on one page, driven only by the engine's decisions:
 *
 * 1. `start()` puts the attribute-scoped stylesheet in the page at
 *    `document_start` (first paint) and asks the service worker for its
 *    `USER`-origin copy, which the page cannot remove or outrank; the
 *    in-page `<style>` and the `<html>` tokens are put back at once if the
 *    page removes them.
 * 2. Every evaluation of a new URL first applies the fail-closed state (the
 *    page's surface when the catalog says it is a feed, and the site's feed
 *    entry points), so nothing flashes.
 * 3. It asks the service worker; the answer replaces that state, mounts the
 *    placeholder where a feed is hidden and redirects restricted Shorts.
 * 4. If no answer arrives within `DECISION_TIMEOUT_MS` (or the request
 *    fails) the page stays closed and the placeholder is shown; a late
 *    answer still applies, unless the page has moved on to another URL.
 */
export class FeedGuard {
  private readonly hider: FeedHider
  private readonly stylesheet: GuardStylesheet
  private sequence = 0
  private currentUrl: string | null = null

  constructor(private readonly options: FeedGuardOptions) {
    const { document } = options.window
    this.hider = new FeedHider(document.documentElement, options.attributes)
    this.stylesheet = new GuardStylesheet(
      document,
      feedStylesheetText(options.site, options.attributes)
    )
  }

  start(): Promise<void> {
    this.stylesheet.install()
    this.hider.watch()
    void this.options.attachStylesheet?.().catch(() => undefined)
    return this.evaluate(this.options.window.location.href)
  }

  /**
   * Orphaned content script (the extension was updated or removed): drops
   * its tokens, `<style>` and placeholder so the fresh instance owns the page.
   */
  destroy(): void {
    this.sequence += 1
    this.hider.clear()
    this.stylesheet.remove()
    this.options.placeholder.destroy()
  }

  /**
   * Evaluates `url`, the page's current URL. A new URL starts from the
   * fail-closed state; the same URL again (a rule set change, a page
   * restored from the back/forward cache) keeps what is shown until the
   * new answer arrives.
   */
  async evaluate(url: string): Promise<void> {
    const { catalog, placeholder, requestDecision, window } = this.options
    const sequence = ++this.sequence
    const isCurrent = () => sequence === this.sequence && window.location.href === url

    const closed = failClosedHideState(url, catalog)
    const closedSurface = placeholderSurfaceOf(closed, null)
    if (url !== this.currentUrl) {
      this.currentUrl = url
      this.hider.apply(closed)
      placeholder.show(null)
    }

    let answered = false
    const timer = setTimeout(() => {
      if (!answered && isCurrent()) placeholder.show(closedSurface)
    }, this.options.timeoutMs ?? DECISION_TIMEOUT_MS)

    let answer: FeedDecision
    try {
      answer = await requestDecision(url)
    } catch {
      // No answer at all: keep the fail-closed state.
      if (isCurrent()) {
        this.hider.apply(closed)
        placeholder.show(closedSurface)
      }
      return
    } finally {
      answered = true
      clearTimeout(timer)
    }
    if (sequence !== this.sequence) return
    if (window.location.href !== url) {
      // The page moved on before the watcher noticed: decide the new URL.
      void this.evaluate(window.location.href)
      return
    }

    if (redirectShorts(answer, window.location)) return
    const state: HideState = { hide: answer.hide, restrict: answer.restrict }
    this.hider.apply(state)
    placeholder.show(placeholderSurfaceOf(state, answer.surface))
    this.options.onDecision?.(answer, url)
    this.options.onApplied?.()
  }
}
