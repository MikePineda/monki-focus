// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ActivityEvent } from '@monki-focus/analytics'
import { starterPreset } from '@monki-focus/rules/pure'
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { Outbox } from '../../../../src/background/storage/Outbox'
import { AGGREGATED_THROUGH_STORAGE_NAME } from '../../../../src/background/tracking/AggregationJob'
import { RULESET_KEY } from '../../../../src/background/rules/RulesetStore'
import { makeEvent } from '../../../factories/makeEvent'
import {
  BUCKET,
  DEVICE_ID,
  startTracking,
  type TrackingHarness,
} from '../../../support/trackingHarness'

const START = '2026-01-05T09:00:00Z'
const DAY = ['2026-01-05T00:00:00Z', '2026-01-06T00:00:00Z'] as const

/**
 * Stores past events as if this install had never aggregated (the module's
 * start-up run already moved the watermark to now).
 */
async function seed(harness: TrackingHarness, ...events: ActivityEvent[]): Promise<void> {
  for (const event of events) await harness.events.add(BUCKET, event)
  await fakeBrowser.storage.local.remove(AGGREGATED_THROUGH_STORAGE_NAME)
}

describe('aggregation job', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('events_become_5_minute_blocks_split_at_the_boundary', async () => {
    const harness = await startTracking({ now: '2026-01-05T09:20:00Z' })
    await seed(harness, makeEvent({ timestamp: '2026-01-05T09:03:00Z', duration: 300 }))

    await harness.module.aggregate()

    expect(await harness.blocks.between(...DAY)).toEqual([
      expect.objectContaining({ blockStart: '2026-01-05T09:00:00Z', seconds: 120 }),
      expect.objectContaining({ blockStart: '2026-01-05T09:05:00Z', seconds: 180 }),
    ])
  })

  it('blocks_use_the_bundled_default_categories', async () => {
    const harness = await startTracking({ now: '2026-01-05T09:20:00Z' })
    await seed(
      harness,
      makeEvent({ timestamp: START, duration: 100, data: { domain: 'reddit.com', path: '/r/sub' } })
    )
    await seed(
      harness,
      makeEvent({
        timestamp: '2026-01-05T09:01:40Z',
        duration: 50,
        data: { domain: 'news.example' },
      })
    )

    await harness.module.aggregate()

    expect(await harness.blocks.between(...DAY)).toEqual(
      expect.arrayContaining([
        {
          deviceId: DEVICE_ID,
          blockStart: START,
          activityKey: 'reddit.com',
          categoryPath: 'social',
          level: 0,
          source: 'web',
          seconds: 100,
        },
        expect.objectContaining({
          activityKey: 'news.example',
          categoryPath: 'uncategorised',
          level: 50,
        }),
      ])
    )
  })

  it('the_rule_sets_categories_override_the_defaults', async () => {
    await fakeBrowser.storage.local.set({
      [RULESET_KEY]: {
        ...starterPreset,
        categories: [
          { target: { kind: 'site', domain: 'reddit.com' }, level: 75, category: 'research' },
        ],
      },
    })
    const harness = await startTracking({ now: '2026-01-05T09:20:00Z' })
    await seed(harness, makeEvent({ timestamp: START, data: { domain: 'reddit.com' } }))

    await harness.module.aggregate()

    expect(await harness.blocks.between(...DAY)).toEqual([
      expect.objectContaining({ activityKey: 'reddit.com', categoryPath: 'research', level: 75 }),
    ])
  })

  it('running_twice_over_the_same_events_writes_the_same_blocks', async () => {
    const harness = await startTracking({ now: '2026-01-05T09:20:00Z' })
    await seed(harness, makeEvent({ timestamp: START, duration: 200 }))

    await harness.module.aggregate()
    const once = await harness.blocks.between(...DAY)
    await fakeBrowser.storage.local.remove(AGGREGATED_THROUGH_STORAGE_NAME)
    await harness.module.aggregate()

    expect(await harness.blocks.between(...DAY)).toEqual(once)
  })

  it('an_event_extended_after_the_last_run_updates_its_block', async () => {
    const harness = await startTracking({ now: START })
    harness.browser.activate({ url: 'https://news.example/' })
    await harness.settle()
    await harness.alarmPulseAfter(30)
    await harness.module.aggregate()

    await harness.alarmPulseAfter(30)
    await harness.alarmPulseAfter(30)
    await harness.module.aggregate()

    expect(await harness.blocks.between(...DAY)).toEqual([
      expect.objectContaining({ blockStart: START, activityKey: 'news.example', seconds: 90 }),
    ])
  })

  it('new_and_changed_blocks_are_queued_in_the_outbox_without_titles', async () => {
    await fakeBrowser.storage.local.set({ 'privacy.storeTitles': true })
    const harness = await startTracking({ now: '2026-01-05T09:20:00Z' })
    await seed(
      harness,
      makeEvent({ timestamp: START, duration: 60, data: { title: 'A headline' } })
    )

    await harness.module.aggregate()
    await harness.module.aggregate()

    const entries = await new Outbox(harness.db).peek(10)
    expect(entries.map((entry) => entry.payload)).toEqual([
      expect.objectContaining({ activityKey: 'news.example', seconds: 60 }),
    ])
    expect(JSON.stringify(entries)).not.toContain('headline')
  })

  it('aggregation_purges_raw_events_past_retention', async () => {
    const harness = await startTracking({ now: '2026-03-01T12:00:00Z' })
    await seed(harness, makeEvent({ timestamp: '2026-01-05T09:00:00Z' }))

    await harness.module.aggregate()

    expect(await harness.events.between(BUCKET, ...DAY)).toEqual([])
  })
})
