// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The feed stylesheet as a `<style>` in the page: the first-paint guard at
 * `document_start`, before the service worker's `USER`-origin copy lands.
 * The page can remove it, so a MutationObserver puts it straight back
 * (the `USER` copy keeps hiding meanwhile).
 */
export class GuardStylesheet {
  private readonly style: HTMLStyleElement
  private observer: MutationObserver | null = null

  constructor(
    private readonly document: Document,
    cssText: string
  ) {
    this.style = document.createElement('style')
    this.style.textContent = cssText
  }

  /** Appends the `<style>` (to `<html>` when `<head>` does not exist yet) and guards it. */
  install(): void {
    this.reinsert()
    const Observer = this.document.defaultView?.MutationObserver ?? MutationObserver
    this.observer = new Observer(() => {
      if (!this.style.isConnected) this.reinsert()
    })
    this.observer.observe(this.document.documentElement, { childList: true, subtree: true })
  }

  /** Removes the `<style>` and stops guarding it (orphaned content script). */
  remove(): void {
    this.observer?.disconnect()
    this.observer = null
    this.style.remove()
  }

  get element(): HTMLStyleElement {
    return this.style
  }

  private reinsert(): void {
    if (this.style.isConnected) return
    ;(this.document.head ?? this.document.documentElement).append(this.style)
  }
}
