// SPDX-License-Identifier: AGPL-3.0-or-later
import { HIDE_ATTRIBUTE, RESTRICT_ATTRIBUTE } from './FeedStylesheet'

/** The surface tokens set on `<html>`. */
export interface HideState {
  hide: readonly string[]
  restrict: readonly string[]
}

function setTokens(root: Element, attribute: string, tokens: readonly string[]): void {
  const value = [...new Set(tokens)].sort().join(' ')
  if (value === '') root.removeAttribute(attribute)
  else if (root.getAttribute(attribute) !== value) root.setAttribute(attribute, value)
}

/**
 * Sets and clears the surface tokens on `<html>` that the feed stylesheet
 * keys on. Hiding is CSS only; this never touches the page's own nodes.
 */
export class FeedHider {
  constructor(private readonly root: Element) {}

  apply(state: HideState): void {
    setTokens(this.root, HIDE_ATTRIBUTE, state.hide)
    setTokens(this.root, RESTRICT_ATTRIBUTE, state.restrict)
  }

  current(): HideState {
    const tokens = (attribute: string) =>
      (this.root.getAttribute(attribute) ?? '').split(' ').filter(Boolean)
    return { hide: tokens(HIDE_ATTRIBUTE), restrict: tokens(RESTRICT_ATTRIBUTE) }
  }
}
