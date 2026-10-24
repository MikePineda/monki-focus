// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import {
  isGuardAttributeName,
  isGuardAttributes,
  randomGuardAttributes,
} from '../../../src/shared/GuardAttributes'
import { feedStylesheetText } from '../../../src/shared/FeedStylesheet'
import { reddit } from '../../../src/sites/reddit'
import { youtube } from '../../../src/sites/youtube'

const ATTRIBUTES = { hide: 'data-aaaaaaaaaaaa', restrict: 'data-bbbbbbbbbbbb' }

describe('randomGuardAttributes', () => {
  it('names_are_random_per_page_and_never_fixed', () => {
    const first = randomGuardAttributes()
    const second = randomGuardAttributes()

    expect(isGuardAttributes(first)).toBe(true)
    expect(first).not.toEqual(second)
    expect(first.hide).not.toMatch(/^data-mf-/)
  })

  it('the_two_names_never_collide', () => {
    let calls = 0
    // The first two draws are equal; the third differs.
    const attributes = randomGuardAttributes((size) =>
      new Uint8Array(size).fill(calls++ < 2 ? 0 : 1)
    )

    expect(attributes.hide).not.toBe(attributes.restrict)
  })

  it.each(['data-mf-hide', 'data-AAAAAAAAAAAA', 'data-aaaaaaaaaaaa"]{}', 'style', 42])(
    '%j_is_not_a_guard_attribute_name',
    (name) => {
      expect(isGuardAttributeName(name)).toBe(false)
    }
  )

  it('equal_names_are_rejected', () => {
    expect(isGuardAttributes({ hide: ATTRIBUTES.hide, restrict: ATTRIBUTES.hide })).toBe(false)
  })
})

describe('feedStylesheetText', () => {
  it('scopes_every_page_selector_to_the_hide_attribute', () => {
    expect(feedStylesheetText(reddit, ATTRIBUTES)).toContain(
      'html[data-aaaaaaaaaaaa~="reddit.feed"] shreddit-feed{display:none!important}'
    )
  })

  it('scopes_page_containers_and_entry_points_to_the_restrict_attribute', () => {
    const css = feedStylesheetText(youtube, ATTRIBUTES)

    expect(css).toContain(
      'html[data-bbbbbbbbbbbb~="youtube.home"] ytd-browse[page-subtype="home"] ytd-rich-grid-renderer{display:none!important}'
    )
    expect(css).toContain(
      'html[data-bbbbbbbbbbbb~="youtube.shorts"] ytm-reel-shelf-renderer{display:none!important}'
    )
    expect(css).toContain(
      'html[data-aaaaaaaaaaaa~="youtube.home"] ytm-browse ytm-rich-grid-renderer{display:none!important}'
    )
  })
})
