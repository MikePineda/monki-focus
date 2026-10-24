// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Runs every shared `activity` fixture of packages/rules against this
 * package. The test name is the fixture id; nothing is skipped.
 */
import { describe, expect, it } from 'vitest'
import { loadDefaultCategories, loadFixtures, loadSiteProfiles } from '@monki-focus/rules'
import type { ActivityFixture } from '@monki-focus/rules'
import {
  activeTime,
  capAcrossDevices,
  categorise,
  dailyTotals,
  dedupeBrowserTime,
  mergeHeartbeats,
  probeTab,
  pulse,
  toBlocks,
} from '../../src/index.ts'

const siteProfiles = loadSiteProfiles().map((file) => file.profile)
const defaults = loadDefaultCategories().assignments
const fixtures = loadFixtures('activity')

function actualOf(fixture: ActivityFixture): unknown {
  switch (fixture.operation) {
    case 'heartbeat-merge':
      return {
        events: mergeHeartbeats(
          fixture.given.events,
          fixture.given.heartbeats,
          fixture.given.pulsetime
        ),
      }
    case 'probe':
      return { heartbeat: probeTab(fixture.given, siteProfiles) }
    case 'active-time':
      return { events: activeTime(fixture.given.events, fixture.given.afk) }
    case 'categorise':
      return categorise(fixture.given.activity, fixture.given.assignments, {
        defaults: fixture.given.includeDefaults ? defaults : [],
        siteProfiles,
      })
    case 'pulse':
      return { pulse: pulse(fixture.given.entries) }
    case 'blocks':
      return {
        blocks: toBlocks(fixture.given.events, {
          deviceId: fixture.given.deviceId,
          syncActivityKey: fixture.given.syncActivityKey,
        }),
      }
    case 'daily-totals':
      return { days: dailyTotals(fixture.given.entries, fixture.given.timeZone) }
    case 'browser-dedupe':
      return { segments: dedupeBrowserTime(fixture.given) }
    case 'cross-device-cap':
      return { blocks: capAcrossDevices(fixture.given.blocks) }
  }
}

describe('activity fixtures (SEMANTICS.md §10)', () => {
  it('loads the shared activity fixtures', () => {
    expect(fixtures.length).toBeGreaterThan(0)
  })

  it.each(fixtures.map((fixture) => [fixture.id, fixture] as const))('%s', (_id, fixture) => {
    // Arrays in `then` are compared in order (SEMANTICS.md §1).
    expect(actualOf(fixture)).toStrictEqual(fixture.then)
  })
})
