// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import type { CategorisableActivity, CategoryAssignment } from '@monki-focus/rules'
import { UNCATEGORISED, categorise } from '../../src/index.ts'
import { bundledCatalog, catalogOf, makeSiteProfile } from '../factories/ActivityFactory.ts'

const catalog = catalogOf()

function categoriseWith(
  activity: CategorisableActivity,
  assignments: readonly CategoryAssignment[]
) {
  return categorise(activity, assignments, catalog)
}

function web(activityKey: string, path: string | null, surface: string | null = null) {
  return { source: 'web', activityKey, path, surface } satisfies CategorisableActivity
}

const app = {
  source: 'app',
  activityKey: 'org.example.Editor',
  path: null,
  surface: null,
} satisfies CategorisableActivity

function site(domain: string, level: CategoryAssignment['level'], category: string, path?: string) {
  const assignment: CategoryAssignment = { target: { kind: 'site', domain }, level, category }
  if (path !== undefined && assignment.target.kind === 'site') assignment.target.path = path
  return assignment
}

describe('Categoriser', () => {
  it('defaults_take_part_unless_they_are_excluded', () => {
    const bundled = bundledCatalog()
    expect(categorise(web('github.com', '/'), [], bundled)).toStrictEqual({
      level: 100,
      categoryPath: 'development',
    })
    expect(categorise(web('github.com', '/'), [], bundled, false)).toStrictEqual(UNCATEGORISED)
  })

  it('an_app_assignment_matches_its_package_only', () => {
    const assignments: CategoryAssignment[] = [
      { target: { kind: 'app', package: 'org.example.Editor' }, level: 100, category: 'writing' },
    ]
    expect(categoriseWith(app, assignments)).toStrictEqual({ level: 100, categoryPath: 'writing' })
    expect(categoriseWith(web('org.example.Editor', '/'), assignments)).toStrictEqual(UNCATEGORISED)
  })

  it('a_site_assignment_never_matches_an_app', () => {
    expect(categoriseWith(app, [site('example.org', 0, 'social')])).toStrictEqual(UNCATEGORISED)
  })

  it('a_surface_assignment_needs_a_resolved_surface', () => {
    const assignments: CategoryAssignment[] = [
      { target: { kind: 'surface', surface: 'example.feed' }, level: 0, category: 'social' },
    ]
    expect(categoriseWith(web('example.org', '/'), assignments)).toStrictEqual(UNCATEGORISED)
    expect(categoriseWith(web('example.org', '/', 'example.feed'), assignments)).toStrictEqual({
      level: 0,
      categoryPath: 'social',
    })
  })

  it('a_domain_assignment_covers_its_subdomains_but_not_lookalikes', () => {
    const assignments = [site('example.org', 75, 'reference')]
    expect(categoriseWith(web('docs.example.org', '/'), assignments).level).toBe(75)
    expect(categoriseWith(web('badexample.org', '/'), assignments)).toStrictEqual(UNCATEGORISED)
  })

  it('a_path_assignment_beats_its_domain_and_needs_a_known_path', () => {
    const assignments = [
      site('example.org', 0, 'social'),
      site('example.org', 100, 'study', '/learn/**'),
    ]
    expect(categoriseWith(web('example.org', '/learn/unit-1'), assignments).categoryPath).toBe(
      'study'
    )
    expect(categoriseWith(web('example.org', '/play'), assignments).categoryPath).toBe('social')
    expect(categoriseWith(web('example.org', null), assignments).categoryPath).toBe('social')
  })

  it('a_double_star_path_matches_an_unknown_path', () => {
    const assignments = [site('example.org', 25, 'video', '/**')]
    expect(categoriseWith(web('example.org', null), assignments).categoryPath).toBe('video')
  })

  it('more_domain_labels_win', () => {
    const assignments = [
      site('example.org', 0, 'social'),
      site('docs.example.org', 100, 'reference'),
    ]
    expect(categoriseWith(web('docs.example.org', '/'), assignments).categoryPath).toBe('reference')
  })

  it('fewer_wildcards_win_at_equal_literal_segments', () => {
    const assignments = [
      site('example.org', 0, 'social', '/r/*/comments/**'),
      site('example.org', 100, 'study', '/r/*/comments'),
    ]
    expect(categoriseWith(web('example.org', '/r/a/comments'), assignments).categoryPath).toBe(
      'study'
    )
  })

  it('on_a_full_tie_the_lower_level_then_list_order_wins', () => {
    expect(
      categoriseWith(web('example.org', '/'), [
        site('example.org', 75, 'b'),
        site('example.org', 25, 'a'),
      ])
    ).toStrictEqual({ level: 25, categoryPath: 'a' })
    expect(
      categoriseWith(web('example.org', '/'), [
        site('example.org', 75, 'first'),
        site('example.org', 75, 'second'),
      ]).categoryPath
    ).toBe('first')
  })

  it('an_alias_domain_assignment_matches_the_canonical_host', () => {
    const siteProfiles = [makeSiteProfile('example.org', {}, ['example.net'])]
    const assignments = [site('www.example.net', 0, 'social')]
    expect(categorise(web('example.org', '/'), assignments, catalogOf(siteProfiles)).level).toBe(0)
  })
})
