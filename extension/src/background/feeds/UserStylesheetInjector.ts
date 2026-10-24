// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RulesCatalog } from '@monki-focus/engine'
import { pageSurfaceOf } from '../../shared/FeedSurfaces'
import { feedStylesheetText } from '../../shared/FeedStylesheet'
import type { GuardAttributes } from '../../shared/GuardAttributes'
import { siteFeedProfileFor } from '../../sites'

/** The slice of `scripting` the injector uses. */
export interface CssInjector {
  insertCSS(injection: {
    target: { tabId: number; allFrames?: boolean }
    css: string
    origin: 'USER' | 'AUTHOR'
  }): Promise<void>
}

/**
 * Injects the feed stylesheet into a tab's top frame with the `USER` origin:
 * the page can neither remove it nor outrank it (user `!important` beats
 * author `!important`), so deleting the guard's `<style>` reveals nothing.
 * The CSS is built here from the site profile of the tab's own URL and the
 * page's validated attribute names, never from text the page supplies.
 */
export class UserStylesheetInjector {
  constructor(
    private readonly catalog: RulesCatalog,
    private readonly scripting: CssInjector
  ) {}

  async inject(tabId: number, tabUrl: string, attributes: GuardAttributes): Promise<boolean> {
    const site = siteFeedProfileFor(pageSurfaceOf(tabUrl, this.catalog).host, this.catalog)
    if (!site) return false
    await this.scripting.insertCSS({
      target: { tabId, allFrames: false },
      css: feedStylesheetText(site, attributes),
      origin: 'USER',
    })
    return true
  }
}
