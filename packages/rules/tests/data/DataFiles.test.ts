// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { loadSiteProfiles, loadSurfaceRegistry, schemaValidator } from '../../src/index.ts'
import { listDataFiles } from '../../src/DataFiles.ts'
import { packageRoot } from '../../src/PackageRoot.ts'

function jsonFilesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) return jsonFilesUnder(path)
    return entry.endsWith('.json') ? [path] : []
  })
}

describe('data files', () => {
  it('every_data_file_has_a_schema', () => {
    const mapped = new Set(listDataFiles().map((file) => file.path))
    const present = [
      ...jsonFilesUnder(join(packageRoot, 'data')),
      ...jsonFilesUnder(join(packageRoot, 'detectors')),
    ]
    expect(
      present.filter((path) => !mapped.has(path)).map((p) => relative(packageRoot, p))
    ).toEqual([])
  })

  it.each(listDataFiles().map((file) => [file.relativePath, file] as const))(
    'every_data_file_validates_against_its_schema %s',
    (_name, file) => {
      const result = schemaValidator().validateDocument(
        file.schema,
        readFileSync(file.path, 'utf8')
      )
      expect(result).toEqual({ valid: true })
    }
  )

  it('surface_ids_are_unique', () => {
    const ids = loadSurfaceRegistry().surfaces.map((surface) => surface.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('surface_family_matches_its_id_prefix', () => {
    for (const surface of loadSurfaceRegistry().surfaces) {
      expect(surface.id.split('.')[0]).toBe(surface.family)
    }
  })

  it('registry_lists_the_initial_surfaces', () => {
    const ids = new Set(loadSurfaceRegistry().surfaces.map((surface) => surface.id))
    for (const id of [
      'instagram.home',
      'instagram.reels',
      'instagram.reel_from_dm',
      'instagram.reel_permalink',
      'instagram.stories',
      'instagram.direct',
      'instagram.explore',
      'youtube.home',
      'youtube.shorts',
      'youtube.watch',
      'reddit.feed',
      'reddit.permalink',
      'x.home',
      'x.status',
    ]) {
      expect(ids.has(id), id).toBe(true)
    }
  })

  it('search_and_messages_surfaces_are_utility', () => {
    const kinds = new Map(loadSurfaceRegistry().surfaces.map((s) => [s.id, s.kind]))
    for (const id of [
      'reddit.search',
      'reddit.messages',
      'x.search',
      'x.messages',
      'youtube.search',
      'instagram.direct',
    ]) {
      expect(kinds.get(id), id).toBe('utility')
    }
  })

  it('site_profile_file_name_matches_its_domain', () => {
    for (const { fileName, profile } of loadSiteProfiles()) {
      expect(fileName).toBe(`${profile.domain}.json`)
    }
  })

  it('site_profiles_cover_reddit_x_youtube_and_instagram', () => {
    const domains = loadSiteProfiles().map(({ profile }) => profile.domain)
    expect(domains.sort()).toEqual(['instagram.com', 'reddit.com', 'x.com', 'youtube.com'])
  })

  it('site_profiles_only_use_registered_surfaces_of_their_family', () => {
    const registry = new Map(loadSurfaceRegistry().surfaces.map((s) => [s.id, s]))
    for (const { profile } of loadSiteProfiles()) {
      const families = new Set<string>()
      for (const surfaceId of Object.keys(profile.surfaces)) {
        const surface = registry.get(surfaceId)
        expect(surface, surfaceId).toBeDefined()
        families.add(surface?.family ?? '')
      }
      expect(families.size).toBe(1)
    }
  })

  it('no_glob_maps_to_two_surfaces_in_a_profile', () => {
    for (const { profile } of loadSiteProfiles()) {
      const globs = Object.values(profile.surfaces).flat()
      expect(new Set(globs).size, profile.domain).toBe(globs.length)
    }
  })

  it('x_profile_rewrites_twitter_com', () => {
    const x = loadSiteProfiles().find(({ profile }) => profile.domain === 'x.com')
    expect(x?.profile.aliases).toContain('twitter.com')
  })

  it('reddit_permalinks_search_and_messages_are_never_feed', () => {
    const reddit = loadSiteProfiles().find(({ profile }) => profile.domain === 'reddit.com')
    expect(reddit?.profile.surfaces['reddit.permalink']).toContain('/r/*/comments/**')
    expect(reddit?.profile.surfaces['reddit.search']).toContain('/search/**')
    expect(reddit?.profile.surfaces['reddit.messages']).toContain('/message/**')
  })

  it('instagram_reels_tab_and_single_reel_are_different_surfaces', () => {
    const instagram = loadSiteProfiles().find(({ profile }) => profile.domain === 'instagram.com')
    expect(instagram?.profile.surfaces['instagram.reels']).toContain('/reels/**')
    expect(instagram?.profile.surfaces['instagram.reel_permalink']).toContain('/reel/*')
  })
})
