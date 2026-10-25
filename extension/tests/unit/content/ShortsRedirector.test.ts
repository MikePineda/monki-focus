// SPDX-License-Identifier: AGPL-3.0-or-later
import { ENGINE_ERROR_DECISION } from '@monki-focus/engine'
import { describe, expect, it, vi } from 'vitest'
import { redirectShorts } from '../../../src/content/ShortsRedirector'
import type { FeedDecision } from '../../../src/shared/messages'
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
