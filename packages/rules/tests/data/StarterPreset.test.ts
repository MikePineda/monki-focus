// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { loadStarterPreset, loadSurfaceRegistry } from '../../src/index.ts'
import type { Rule } from '../../src/index.ts'

const preset = loadStarterPreset()

function rulesFor(mode: Rule['mode']): string[] {
  return preset.rules
    .filter((rule) => rule.mode === mode && rule.enabled)
    .map((rule) => {
      const target = rule.target
      if (target.kind === 'surface') return target.surface
      if (target.kind === 'site') return target.path ? target.domain + target.path : target.domain
      return target.package
    })
    .sort()
}

describe('starter preset', () => {
  it('starter_hides_the_feed_surfaces_of_reddit_x_and_youtube', () => {
    expect(rulesFor('hide-feed')).toEqual(
      expect.arrayContaining([
        'reddit.feed',
        'x.home',
        'x.explore',
        'youtube.home',
        'youtube.explore',
      ])
    )
  })

  it('starter_keeps_subscriptions_and_user_pages_visible', () => {
    const hidden = rulesFor('hide-feed')
    expect(hidden).not.toContain('youtube.subscriptions')
    expect(hidden).not.toContain('reddit.user_feed')
  })

  it('starter_pins_utc_until_the_client_sets_the_device_zone_at_install', () => {
    expect(preset.timeZone).toBe('UTC')
  })

  it('starter_hides_instagram_reels_and_explore_but_not_home', () => {
    const hidden = rulesFor('hide-feed')
    expect(hidden).toEqual(expect.arrayContaining(['instagram.reels', 'instagram.explore']))
    expect(hidden).not.toContain('instagram.home')
  })

  it('starter_adds_friction_to_reddit_and_x', () => {
    expect(rulesFor('friction')).toEqual(['reddit.com', 'x.com'])
  })

  it('starter_blocks_youtube_shorts', () => {
    expect(rulesFor('block')).toEqual(['youtube.shorts'])
  })

  it('starter_rules_are_always_active', () => {
    for (const rule of preset.rules) expect(rule.schedules, rule.id).toEqual([])
  })

  it('starter_bedtime_runs_2230_to_0700_with_warning_at_2200', () => {
    expect(preset.bedtime).toEqual({
      enabled: true,
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      start: '22:30',
      end: '07:00',
      warnMinutesBefore: 30,
    })
  })

  it('starter_work_hours_are_mon_fri_0900_1730', () => {
    expect(preset.workHours).toEqual({
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      start: '09:00',
      end: '17:30',
    })
  })

  it('starter_rule_ids_are_unique', () => {
    const ids = preset.rules.map((rule) => rule.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('starter_rules_reference_registered_surfaces', () => {
    const registered = new Set(loadSurfaceRegistry().surfaces.map((surface) => surface.id))
    for (const rule of preset.rules) {
      if (rule.target.kind === 'surface') expect(registered.has(rule.target.surface)).toBe(true)
    }
  })

  it('starter_relies_on_default_categories', () => {
    expect(preset.categories).toEqual([])
  })
})
