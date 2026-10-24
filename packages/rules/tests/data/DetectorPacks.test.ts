// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadSurfaceRegistry } from '../../src/index.ts'
import { listDataFiles } from '../../src/DataFiles.ts'
import type { DetectorPack } from '../../src/generated/SchemaTypes.ts'

const packs = new Map(
  listDataFiles()
    .filter((file) => file.schema === 'detector-pack')
    .map((file) => {
      const pack = JSON.parse(readFileSync(file.path, 'utf8')) as DetectorPack
      return [pack.packId, pack] as const
    })
)

function pack(id: string): DetectorPack {
  const found = packs.get(id)
  if (!found) throw new Error(`missing pack ${id}`)
  return found
}

function priorityOf(packId: string, surface: string): number {
  return Math.max(
    ...pack(packId)
      .surfaces.filter((s) => s.surface === surface)
      .map((s) => s.priority)
  )
}

describe('android detector packs', () => {
  it('ships_the_instagram_youtube_browsers_and_settings_packs', () => {
    expect([...packs.keys()].sort()).toEqual(['browsers', 'instagram', 'settings', 'youtube'])
  })

  it('pack_file_name_matches_its_pack_id', () => {
    for (const file of listDataFiles().filter((f) => f.schema === 'detector-pack')) {
      const pack = JSON.parse(readFileSync(file.path, 'utf8')) as DetectorPack
      expect(file.relativePath).toBe(`detectors/android/${pack.packId}.pack.json`)
    }
  })

  it('app_packs_only_use_registered_surfaces_of_their_family', () => {
    const registered = new Set(loadSurfaceRegistry().surfaces.map((surface) => surface.id))
    for (const id of ['instagram', 'youtube']) {
      for (const detector of pack(id).surfaces) {
        expect(registered.has(detector.surface), detector.surface).toBe(true)
        expect(detector.surface.startsWith(`${id}.`), detector.surface).toBe(true)
      }
    }
  })

  it('settings_pack_only_classifies_guarded_screens_never_rule_surfaces', () => {
    const registered = new Set(loadSurfaceRegistry().surfaces.map((surface) => surface.id))
    for (const detector of pack('settings').surfaces) {
      expect(detector.surface.startsWith('guard.'), detector.surface).toBe(true)
      expect(registered.has(detector.surface), detector.surface).toBe(false)
    }
  })

  it('reel_from_dm_outranks_reels_which_outranks_stories_and_direct', () => {
    expect(priorityOf('instagram', 'instagram.reel_from_dm')).toBeGreaterThan(
      priorityOf('instagram', 'instagram.reels')
    )
    expect(priorityOf('instagram', 'instagram.reels')).toBeGreaterThan(
      priorityOf('instagram', 'instagram.stories')
    )
    expect(priorityOf('instagram', 'instagram.stories')).toBeGreaterThan(
      priorityOf('instagram', 'instagram.direct')
    )
  })

  it('reel_from_dm_is_never_recognised_with_a_suggested_title', () => {
    for (const detector of pack('instagram').surfaces.filter(
      (s) => s.surface === 'instagram.reel_from_dm'
    )) {
      expect(detector.none).toContainEqual({ viewId: 'suggested_title' })
    }
  })

  it('dm_reels_need_a_sender_and_a_reply_bar', () => {
    const detectors = pack('instagram').surfaces.filter(
      (s) => s.surface === 'instagram.reel_from_dm'
    )
    expect(detectors.length).toBeGreaterThan(0)
    for (const detector of detectors) {
      const all = (detector.all ?? []).map((predicate) => predicate.viewId)
      const any = (detector.any ?? []).map((predicate) => predicate.viewId)
      expect(
        all.some((id) => id === 'sender_username_or_fullname' || id === 'sender_timestamp')
      ).toBe(true)
      expect([...all, ...any].some((id) => id?.startsWith('reply_bar_'))).toBe(true)
    }
  })

  it('label_predicates_always_name_a_view_id', () => {
    for (const current of packs.values()) {
      for (const detector of current.surfaces) {
        for (const predicate of [
          ...(detector.all ?? []),
          ...(detector.any ?? []),
          ...(detector.none ?? []),
        ]) {
          const readsLabel = predicate.text ?? predicate.contentDesc ?? predicate.contentDescPrefix
          if (readsLabel !== undefined) expect(predicate.viewId, detector.surface).toBeDefined()
        }
      }
    }
  })

  it('instagram_and_youtube_keep_the_unclassified_safety_net', () => {
    expect(pack('instagram').unclassifiedCapMinutes).toBeGreaterThanOrEqual(5)
    expect(pack('youtube').unclassifiedCapMinutes).toBeGreaterThanOrEqual(5)
  })

  it('shorts_player_ids_need_most_of_the_screen', () => {
    const shorts = pack('youtube').surfaces.find(
      (s) => s.surface === 'youtube.shorts' && s.priority === 100
    )
    const viewIds = (shorts?.any ?? []).map((predicate) => predicate.viewId)
    expect(viewIds).toEqual(expect.arrayContaining(['reel_player_page_container', 'reel_recycler']))
    for (const predicate of shorts?.any ?? []) {
      expect(predicate.minHeightRatio ?? 0).toBeGreaterThanOrEqual(0.6)
    }
  })

  it('browser_pack_reads_url_bar_first_and_falls_back_to_omnibox_url_text', () => {
    const browsers = pack('browsers')
    expect(browsers.urlBarViewIds?.slice(0, 2)).toEqual(['url_bar', 'omnibox_url_text'])
    expect(browsers.packages).toEqual(
      expect.arrayContaining(['com.android.chrome', 'com.brave.browser'])
    )
    expect(browsers.surfaces).toEqual([])
  })

  it('only_browser_packs_declare_url_bars', () => {
    for (const id of ['instagram', 'youtube', 'settings']) {
      expect(pack(id).urlBarViewIds, id).toBeUndefined()
    }
  })
})
