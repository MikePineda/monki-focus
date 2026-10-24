// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The tab probe normalises URLs (SEMANTICS.md §2), so the shared
 * `url-normalize` fixtures prove the normaliser it uses.
 */
import { describe, expect, it } from 'vitest'
import { loadFixtures, loadSiteProfiles } from '@monki-focus/rules'
import { normalizeUrl } from '../../src/index.ts'

const siteProfiles = loadSiteProfiles().map((file) => file.profile)
const fixtures = loadFixtures('url-normalize')

describe('url-normalize fixtures (SEMANTICS.md §2)', () => {
  it.each(fixtures.map((fixture) => [fixture.id, fixture] as const))('%s', (_id, fixture) => {
    expect(normalizeUrl(fixture.given.urlText, siteProfiles)).toStrictEqual(fixture.then)
  })
})
