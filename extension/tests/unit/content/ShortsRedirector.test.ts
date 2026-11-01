// SPDX-License-Identifier: AGPL-3.0-or-later
import { ENGINE_ERROR_DECISION } from '@monki-focus/engine'
import { describe, expect, it, vi } from 'vitest'
import { redirectShorts } from '../../../src/content/ShortsRedirector'
import type { FeedDecision } from '../../../src/shared/messages'
import { reelWatchUrl } from '../../../src/sites/facebook'
import { shortsWatchUrl } from '../../../src/sites/youtube'

function answer(surface: string | null, restrict: string[]): FeedDecision {
  return { surface, decision: { ...ENGINE_ERROR_DECISION }, hide: [], restrict, validUntil: null }
}

function locationAt(href: string) {
  return { href, replace: vi.fn<(url: string) => void>() }
}

describe('redirectShorts', () => {
  it('restricted_shorts_page_is_replaced_by_its_watch_page', () => {
    const location = locationAt('https://www.youtube.com/shorts/abc_DEF-123?feature=share')

    expect(redirectShorts(answer('youtube.shorts', ['youtube.shorts']), location)).toBe(true)
    expect(location.replace).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc_DEF-123')
  })

  it('allowed_shorts_stay', () => {
    const location = locationAt('https://www.youtube.com/shorts/abcdefghijk')

    expect(redirectShorts(answer('youtube.shorts', []), location)).toBe(false)
    expect(location.replace).not.toHaveBeenCalled()
  })

  it('other_surfaces_never_redirect', () => {
    const location = locationAt('https://www.youtube.com/')

    expect(redirectShorts(answer('youtube.home', ['youtube.shorts']), location)).toBe(false)
  })
})

describe('shortsWatchUrl', () => {
  it.each([
    ['https://www.youtube.com/shorts/abcdefghijk', 'https://www.youtube.com/watch?v=abcdefghijk'],
    ['https://m.youtube.com/shorts/abcdefghijk/', 'https://www.youtube.com/watch?v=abcdefghijk'],
  ])('%s_maps_to_%s', (url, watch) => {
    expect(shortsWatchUrl(url)).toBe(watch)
  })

  it.each([
    'https://www.youtube.com/shorts/',
    'https://www.youtube.com/shorts/short',
    'https://www.youtube.com/shorts/abcdefghijkl',
    'https://www.youtube.com/shorts/abc%22defghi',
    'not a url',
  ])('%s_has_no_watch_page', (url) => {
    expect(shortsWatchUrl(url)).toBeNull()
  })
})

describe('redirectShorts on Facebook', () => {
  it('restricted_facebook_reel_is_replaced_by_its_single_video_page', () => {
    const location = locationAt('https://www.facebook.com/reel/1234567890123456/?s=ifu')

    expect(redirectShorts(answer('facebook.reels', ['facebook.reels']), location)).toBe(true)
    expect(location.replace).toHaveBeenCalledWith(
      'https://www.facebook.com/watch/?v=1234567890123456'
    )
  })

  it('allowed_facebook_reels_stay', () => {
    const location = locationAt('https://www.facebook.com/reel/1234567890123456')

    expect(redirectShorts(answer('facebook.reels', []), location)).toBe(false)
    expect(location.replace).not.toHaveBeenCalled()
  })

  it('the_reels_tab_without_an_id_is_left_to_the_block', () => {
    const location = locationAt('https://www.facebook.com/reels/')

    expect(redirectShorts(answer('facebook.reels', ['facebook.reels']), location)).toBe(false)
  })
})

describe('reelWatchUrl', () => {
  it.each([
    ['https://www.facebook.com/reel/123456', 'https://www.facebook.com/watch/?v=123456'],
    ['https://m.facebook.com/reel/123456/', 'https://www.facebook.com/watch/?v=123456'],
  ])('%s_maps_to_%s', (url, watch) => {
    expect(reelWatchUrl(url)).toBe(watch)
  })

  it.each([
    'https://www.facebook.com/reel/',
    'https://www.facebook.com/reels/',
    'https://www.facebook.com/reel/abc',
    'not a url',
  ])('%s_has_no_single_video_page', (url) => {
    expect(reelWatchUrl(url)).toBeNull()
  })
})
