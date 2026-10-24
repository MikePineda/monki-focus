// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest'
import { UserStylesheetInjector } from '../../../../src/background/feeds/UserStylesheetInjector'
import { bundledRulesCatalog } from '../../../../src/shared/bundledRulesCatalog'
import { feedStylesheetText } from '../../../../src/shared/FeedStylesheet'
import { x } from '../../../../src/sites/x'

const ATTRIBUTES = { hide: 'data-aaaaaaaaaaaa', restrict: 'data-bbbbbbbbbbbb' }

function makeInjector() {
  const insertCSS = vi.fn(() => Promise.resolve())
  return { injector: new UserStylesheetInjector(bundledRulesCatalog(), { insertCSS }), insertCSS }
}

describe('UserStylesheetInjector', () => {
  it('injects_the_site_stylesheet_into_the_top_frame_with_the_user_origin', async () => {
    const { injector, insertCSS } = makeInjector()

    expect(await injector.inject(7, 'https://twitter.com/home', ATTRIBUTES)).toBe(true)
    expect(insertCSS).toHaveBeenCalledWith({
      target: { tabId: 7, allFrames: false },
      css: feedStylesheetText(x, ATTRIBUTES),
      origin: 'USER',
    })
  })

  it('a_tab_outside_the_sites_gets_nothing', async () => {
    const { injector, insertCSS } = makeInjector()

    expect(await injector.inject(7, 'https://news.example/', ATTRIBUTES)).toBe(false)
    expect(insertCSS).not.toHaveBeenCalled()
  })
})
