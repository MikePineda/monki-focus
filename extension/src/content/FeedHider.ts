// SPDX-License-Identifier: AGPL-3.0-or-later
import type { GuardAttributes } from '../shared/GuardAttributes'

/** The surface tokens set on `<html>`. */
export interface HideState {
  hide: readonly string[]
  restrict: readonly string[]
}

function tokensOf(list: readonly string[]): string {
  return [...new Set(list)].sort().join(' ')
}

/**
 * Sets and clears the surface tokens on `<html>` that the feed stylesheet
 * keys on. Hiding is CSS only; this never touches the page's own nodes.
 * While watching, a MutationObserver puts the last applied tokens straight
 * back when the page removes or rewrites them (it runs before the next
 * paint, so the feed never shows).
 */
export class FeedHider {
  private last: { hide: string; restrict: string } = { hide: '', restrict: '' }
  private observer: MutationObserver | null = null

  constructor(
    private readonly root: Element,
    private readonly attributes: GuardAttributes
  ) {}

  apply(state: HideState): void {
    this.last = { hide: tokensOf(state.hide), restrict: tokensOf(state.restrict) }
    this.write()
  }

  current(): HideState {
    const tokens = (attribute: string) =>
      (this.root.getAttribute(attribute) ?? '').split(' ').filter(Boolean)
    return { hide: tokens(this.attributes.hide), restrict: tokens(this.attributes.restrict) }
  }

  watch(): void {
    if (this.observer) return
    const Observer = this.root.ownerDocument.defaultView?.MutationObserver ?? MutationObserver
    this.observer = new Observer(() => this.write())
    this.observer.observe(this.root, {
      attributes: true,
      attributeFilter: [this.attributes.hide, this.attributes.restrict],
    })
  }

  /** Stops watching and clears the tokens (orphaned content script). */
  clear(): void {
    this.observer?.disconnect()
    this.observer = null
    this.last = { hide: '', restrict: '' }
    this.write()
  }

  private write(): void {
    this.set(this.attributes.hide, this.last.hide)
    this.set(this.attributes.restrict, this.last.restrict)
  }

  private set(attribute: string, value: string): void {
    if (value === '') {
      if (this.root.hasAttribute(attribute)) this.root.removeAttribute(attribute)
    } else if (this.root.getAttribute(attribute) !== value) {
      this.root.setAttribute(attribute, value)
    }
  }
}
