// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect } from 'vitest'
import { normalizeUrl } from '../../src/index.ts'
import { fixtureCatalog } from './FixtureCatalog.ts'
import { describeFixtures } from './FixtureRunner.ts'

describeFixtures('url-normalize', (fixture) => {
  expect(normalizeUrl(fixture.given.urlText, fixtureCatalog())).toEqual(fixture.then)
})
