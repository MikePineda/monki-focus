// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { loadDefaultCategories, loadSurfaceRegistry } from '../../src/index.ts'
import type { CategoryAssignment } from '../../src/index.ts'

const assignments = loadDefaultCategories().assignments

function keyOf(assignment: CategoryAssignment): string {
  const target = assignment.target
  if (target.kind === 'app') return `app:${target.package}`
  if (target.kind === 'surface') return `surface:${target.surface}`
  return `site:${target.domain}${target.path ?? ''}`
}

function levelOf(key: string): number | undefined {
  return assignments.find((assignment) => keyOf(assignment) === key)?.level
}

describe('default categories', () => {
  it.each([
    'app:com.microsoft.VSCode',
    'app:com.apple.Terminal',
    'site:github.com',
    'site:stackoverflow.com',
  ])('developer_tools_are_very_productive %s', (key) => {
    expect(levelOf(key)).toBe(100)
  })

  it.each([
    'site:reddit.com',
    'site:x.com',
    'site:instagram.com',
    'site:tiktok.com',
    'surface:youtube.shorts',
    'app:com.instagram.android',
    'app:com.zhiliaoapp.musically',
  ])('social_and_short_video_are_very_distracting %s', (key) => {
    expect(levelOf(key)).toBe(0)
  })

  it('youtube_watch_is_neutral', () => {
    expect(levelOf('surface:youtube.watch')).toBe(50)
  })

  it('youtube_feed_surfaces_are_categorised', () => {
    expect(levelOf('surface:youtube.explore')).toBe(25)
    expect(levelOf('surface:youtube.subscriptions')).toBe(50)
    expect(levelOf('surface:reddit.user_feed')).toBe(0)
  })

  it('default_targets_are_unique', () => {
    const keys = assignments.map(keyOf)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('default_surfaces_are_registered', () => {
    const registered = new Set(loadSurfaceRegistry().surfaces.map((surface) => surface.id))
    for (const assignment of assignments) {
      if (assignment.target.kind === 'surface') {
        expect(registered.has(assignment.target.surface)).toBe(true)
      }
    }
  })

  it('reserved_category_paths_are_not_assigned', () => {
    for (const assignment of assignments) {
      expect(['uncategorised', 'browser-unknown']).not.toContain(assignment.category)
    }
  })
})
