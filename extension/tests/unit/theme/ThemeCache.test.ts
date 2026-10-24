// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { cacheTheme, readCachedTheme } from '../../../src/theme/ThemeCache'

const blockedStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('ThemeCache', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('cached_theme_round_trips_through_local_storage', () => {
    cacheTheme('dark', localStorage)
    expect(readCachedTheme(localStorage)).toBe('dark')
  })

  it('empty_cache_follows_the_system', () => {
    expect(readCachedTheme(localStorage)).toBe('system')
  })

  it('blocked_storage_never_throws_and_follows_the_system', () => {
    expect(() => cacheTheme('dark', blockedStorage)).not.toThrow()
    expect(readCachedTheme(blockedStorage)).toBe('system')
  })
})
