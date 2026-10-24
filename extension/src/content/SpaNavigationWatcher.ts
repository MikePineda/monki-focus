// SPDX-License-Identifier: AGPL-3.0-or-later

/** YouTube's own event at the end of an in-app navigation. */
export const YT_NAVIGATE_FINISH = 'yt-navigate-finish'
/** Backstop poll for history changes no event reports (`pushState`). */
export const DEFAULT_POLL_MS = 1000

export interface SpaNavigationWatcherOptions {
  window: Window & typeof globalThis
  onNavigate: (url: string) => void
  pollMs?: number
}

/**
 * Reports in-app navigations of single-page sites without patching
 * `history` in the page's MAIN world: `popstate`, YouTube's
 * `yt-navigate-finish`, a MutationObserver on `<title>` (SPAs retitle on
 * every route) and a low-frequency URL poll as a backstop. Each signal only
 * triggers a check of `location.href`; the callback runs once per new URL.
 */
export class SpaNavigationWatcher {
  private lastUrl: string
  private timer: ReturnType<typeof setInterval> | undefined
  private titleObserver: MutationObserver | undefined
  private headObserver: MutationObserver | undefined
  private observedTitle: Element | null = null
  private readonly check = () => this.checkUrl()
  private readonly attachTitle = () => this.observeTitle()

  constructor(private readonly options: SpaNavigationWatcherOptions) {
    this.lastUrl = options.window.location.href
  }

  start(): void {
    const { window } = this.options
    window.addEventListener('popstate', this.check)
    window.document.addEventListener(YT_NAVIGATE_FINISH, this.check)
    this.timer = setInterval(this.check, this.options.pollMs ?? DEFAULT_POLL_MS)
    if (window.document.readyState === 'loading') {
      window.document.addEventListener('DOMContentLoaded', this.attachTitle, { once: true })
    } else {
      this.observeTitle()
    }
  }

  stop(): void {
    const { window } = this.options
    window.removeEventListener('popstate', this.check)
    window.document.removeEventListener(YT_NAVIGATE_FINISH, this.check)
    window.document.removeEventListener('DOMContentLoaded', this.attachTitle)
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = undefined
    this.titleObserver?.disconnect()
    this.headObserver?.disconnect()
  }

  /** Watches the current `<title>` and re-attaches when the page swaps it. */
  private observeTitle(): void {
    const { document, MutationObserver: Observer } = this.options.window
    const title = document.querySelector('title')
    if (title !== this.observedTitle) {
      this.titleObserver?.disconnect()
      this.observedTitle = title
      if (title) {
        this.titleObserver = new Observer(this.check)
        this.titleObserver.observe(title, { childList: true, characterData: true, subtree: true })
      }
    }
    if (!this.headObserver && document.head) {
      this.headObserver = new Observer(() => {
        this.observeTitle()
        this.check()
      })
      this.headObserver.observe(document.head, { childList: true })
    }
  }

  private checkUrl(): void {
    const url = this.options.window.location.href
    if (url === this.lastUrl) return
    this.lastUrl = url
    this.options.onNavigate(url)
  }
}
