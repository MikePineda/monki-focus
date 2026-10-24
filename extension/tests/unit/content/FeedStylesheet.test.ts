// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { FeedHider } from '../../../src/content/FeedHider'
import {
  feedStylesheetText,
  installFeedStylesheet,
  STYLESHEET_ID,
} from '../../../src/content/FeedStylesheet'
import { reddit } from '../../../src/sites/reddit'
import { youtube } from '../../../src/sites/youtube'

describe('feedStylesheetText', () => {
  it('scopes_every_page_selector_to_its_surface_token', () => {
    expect(feedStylesheetText(reddit)).toContain(
      'html[data-mf-hide~="reddit.feed"] shreddit-feed{display:none!important}'
    )
  })

  it('scopes_entry_points_to_the_restrict_token', () => {
    expect(feedStylesheetText(youtube)).toContain(
      'html[data-mf-restrict~="youtube.shorts"] ytd-rich-shelf-renderer[is-shorts]{display:none!important}'
    )
  })
})

describe('installFeedStylesheet', () => {
  beforeEach(() => {
    document.getElementById(STYLESHEET_ID)?.remove()
  })

  it('injects_the_stylesheet_once', () => {
    installFeedStylesheet(document, reddit)
    installFeedStylesheet(document, reddit)

    const styles = document.querySelectorAll(`#${STYLESHEET_ID}`)
    expect(styles).toHaveLength(1)
    expect(styles[0]?.textContent).toBe(feedStylesheetText(reddit))
  })

  it('works_before_the_head_exists', () => {
    const early = document.implementation.createHTMLDocument('')
    early.head.remove()

    installFeedStylesheet(early, reddit)

    expect(early.documentElement.lastElementChild?.id).toBe(STYLESHEET_ID)
  })

  it('hides_the_feed_only_while_the_surface_token_is_set', () => {
    installFeedStylesheet(document, reddit)
    const feed = document.createElement('shreddit-feed')
    document.body.append(feed)
    const hider = new FeedHider(document.documentElement)

    hider.apply({ hide: ['reddit.feed'], restrict: [] })
    expect(getComputedStyle(feed).display).toBe('none')

    hider.apply({ hide: [], restrict: [] })
    expect(getComputedStyle(feed).display).not.toBe('none')
    feed.remove()
  })
})

describe('FeedHider', () => {
  it('sets_sorted_unique_tokens_and_clears_empty_lists', () => {
    const root = document.createElement('html')
    const hider = new FeedHider(root)

    hider.apply({ hide: ['x.home', 'x.home'], restrict: ['x.home', 'x.explore'] })
    expect(root.getAttribute('data-mf-hide')).toBe('x.home')
    expect(root.getAttribute('data-mf-restrict')).toBe('x.explore x.home')
    expect(hider.current()).toEqual({ hide: ['x.home'], restrict: ['x.explore', 'x.home'] })

    hider.apply({ hide: [], restrict: [] })
    expect(root.hasAttribute('data-mf-hide')).toBe(false)
    expect(root.hasAttribute('data-mf-restrict')).toBe(false)
  })
})
