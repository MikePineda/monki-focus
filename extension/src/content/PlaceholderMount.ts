// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SiteFeedProfile } from '../sites/SiteFeedProfile'

/** Tag of the shadow host the placeholder lives in. */
export const PLACEHOLDER_TAG = 'monki-focus-placeholder'
/** Coalesces DOM mutations before re-checking where the feed is. */
const RECONCILE_DELAY_MS = 50

/** Renders the placeholder into its shadow root; returns the unmount. */
export type PlaceholderRenderer = (container: HTMLElement, host: HTMLElement) => () => void

export interface PlaceholderMountOptions {
  document: Document
  site: SiteFeedProfile
  /** Stylesheet text for the shadow root (tokens + UI kit), from the bundle. */
  css: string
  render: PlaceholderRenderer
}

/**
 * Keeps the feed placeholder right before the hidden feed. Hiding itself is
 * CSS; this only places the placeholder, and since feed containers arrive
 * late and SPAs re-render them, a MutationObserver re-checks (coalesced)
 * while a surface is hidden. The placeholder lives in a shadow root so the
 * page's CSS and the UI kit's never meet.
 */
export class PlaceholderMount {
  private surface: string | null = null
  private host: HTMLElement | null = null
  private unmount: (() => void) | null = null
  private observer: MutationObserver | null = null
  private pending: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly options: PlaceholderMountOptions) {}

  /** Shows the placeholder for the hidden page surface, or removes it (null). */
  show(surface: string | null): void {
    this.surface = surface && this.selectorsOf(surface).length > 0 ? surface : null
    if (this.surface === null) {
      this.stopObserving()
      this.remove()
      return
    }
    this.reconcile()
    this.startObserving()
  }

  /** Removes the placeholder and stops observing (content script invalidated). */
  destroy(): void {
    this.show(null)
  }

  /** The shadow host currently in the page, if any (tests, E2E). */
  get element(): HTMLElement | null {
    return this.host
  }

  private selectorsOf(surface: string): readonly string[] {
    return this.options.site.hide[surface] ?? []
  }

  private anchor(): Element | null {
    if (this.surface === null) return null
    for (const selector of this.selectorsOf(this.surface)) {
      const found = this.options.document.querySelector(selector)
      if (found) return found
    }
    return null
  }

  private reconcile(): void {
    const anchor = this.anchor()
    if (!anchor || !anchor.parentNode) {
      this.remove()
      return
    }
    const host = this.host ?? this.create()
    if (host.nextElementSibling !== anchor) anchor.parentNode.insertBefore(host, anchor)
  }

  private create(): HTMLElement {
    const { document, css, render } = this.options
    const host = document.createElement(PLACEHOLDER_TAG)
    const shadow = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = css
    const container = document.createElement('div')
    shadow.append(style, container)
    this.host = host
    this.unmount = render(container, host)
    return host
  }

  private remove(): void {
    this.unmount?.()
    this.unmount = null
    this.host?.remove()
    this.host = null
  }

  private startObserving(): void {
    if (this.observer) return
    const { document } = this.options
    const Observer = document.defaultView?.MutationObserver ?? MutationObserver
    this.observer = new Observer(() => this.schedule())
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      // X switches "For you" / "Following" through aria-selected.
      attributeFilter: ['aria-selected'],
    })
  }

  private stopObserving(): void {
    this.observer?.disconnect()
    this.observer = null
    if (this.pending !== undefined) clearTimeout(this.pending)
    this.pending = undefined
  }

  private schedule(): void {
    if (this.pending !== undefined) return
    this.pending = setTimeout(() => {
      this.pending = undefined
      if (this.surface !== null) this.reconcile()
    }, RECONCILE_DELAY_MS)
  }
}
