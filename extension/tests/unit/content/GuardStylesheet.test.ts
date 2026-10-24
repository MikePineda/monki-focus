// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest'
import { FeedHider } from '../../../src/content/FeedHider'
import { GuardStylesheet } from '../../../src/content/GuardStylesheet'
import { feedStylesheetText } from '../../../src/shared/FeedStylesheet'
import { reddit } from '../../../src/sites/reddit'

const ATTRIBUTES = { hide: 'data-aaaaaaaaaaaa', restrict: 'data-bbbbbbbbbbbb' }
const nextMutations = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('GuardStylesheet', () => {
  let stylesheet: GuardStylesheet | undefined

  afterEach(() => {
    stylesheet?.remove()
  })

  it('works_before_the_head_exists', () => {
    const early = document.implementation.createHTMLDocument('')
    early.head.remove()
    const guard = new GuardStylesheet(early, '.x{}')

    guard.install()

    expect(early.documentElement.lastElementChild).toBe(guard.element)
    guard.remove()
  })

  it('a_removed_guard_style_is_put_back', async () => {
    stylesheet = new GuardStylesheet(document, feedStylesheetText(reddit, ATTRIBUTES))
    stylesheet.install()

    stylesheet.element.remove()
    await nextMutations()

    expect(stylesheet.element.isConnected).toBe(true)
  })

  it('hides_the_feed_only_while_the_surface_token_is_set', () => {
    stylesheet = new GuardStylesheet(document, feedStylesheetText(reddit, ATTRIBUTES))
    stylesheet.install()
    const feed = document.createElement('shreddit-feed')
    document.body.append(feed)
    const hider = new FeedHider(document.documentElement, ATTRIBUTES)

    hider.apply({ hide: ['reddit.feed'], restrict: [] })
    expect(getComputedStyle(feed).display).toBe('none')

    hider.apply({ hide: [], restrict: [] })
    expect(getComputedStyle(feed).display).not.toBe('none')
    feed.remove()
  })

  it('remove_stops_guarding', async () => {
    const guard = new GuardStylesheet(document, '.x{}')
    guard.install()

    guard.remove()
    await nextMutations()

    expect(guard.element.isConnected).toBe(false)
  })
})

describe('FeedHider', () => {
  it('sets_sorted_unique_tokens_and_clears_empty_lists', () => {
    const root = document.createElement('html')
    const hider = new FeedHider(root, ATTRIBUTES)

    hider.apply({ hide: ['x.home', 'x.home'], restrict: ['x.home', 'x.explore'] })
    expect(root.getAttribute(ATTRIBUTES.hide)).toBe('x.home')
    expect(root.getAttribute(ATTRIBUTES.restrict)).toBe('x.explore x.home')
    expect(hider.current()).toEqual({ hide: ['x.home'], restrict: ['x.explore', 'x.home'] })

    hider.apply({ hide: [], restrict: [] })
    expect(root.hasAttribute(ATTRIBUTES.hide)).toBe(false)
    expect(root.hasAttribute(ATTRIBUTES.restrict)).toBe(false)
  })

  it('a_page_removing_or_rewriting_the_tokens_is_reverted', async () => {
    const root = document.createElement('html')
    const hider = new FeedHider(root, ATTRIBUTES)
    hider.apply({ hide: ['reddit.feed'], restrict: ['reddit.feed'] })
    hider.watch()

    root.removeAttribute(ATTRIBUTES.hide)
    root.setAttribute(ATTRIBUTES.restrict, '')
    await nextMutations()

    expect(hider.current()).toEqual({ hide: ['reddit.feed'], restrict: ['reddit.feed'] })
    hider.clear()
  })

  it('clear_drops_the_tokens_and_stops_watching', async () => {
    const root = document.createElement('html')
    const hider = new FeedHider(root, ATTRIBUTES)
    hider.apply({ hide: ['reddit.feed'], restrict: [] })
    hider.watch()

    hider.clear()
    root.setAttribute(ATTRIBUTES.hide, 'reddit.feed')
    root.removeAttribute(ATTRIBUTES.hide)
    await nextMutations()

    expect(root.hasAttribute(ATTRIBUTES.hide)).toBe(false)
  })
})
