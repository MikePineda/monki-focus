// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import {
  activityWatchBucketId,
  fromActivityWatchExport,
  toActivityWatchExport,
} from '../../src/index.ts'
import type { ActivityWatchBucket, ActivityWatchExport } from '../../src/index.ts'
import { makeAfkEvent, makeWebEvent, makeWindowEvent } from '../factories/ActivityFactory.ts'

const HOST = 'test-host'

const windowBucket: ActivityWatchBucket = {
  id: activityWatchBucketId('currentwindow', HOST),
  type: 'currentwindow',
  client: 'monki-focus-mac',
  hostname: HOST,
  created: '2026-10-26T08:00:00Z',
  events: [
    makeWindowEvent('2026-10-26T09:05:00Z', 120, 'org.example.Editor', 'Draft'),
    makeWindowEvent('2026-10-26T09:00:00Z', 300, 'org.example.Editor'),
  ],
}

const afkBucket: ActivityWatchBucket = {
  id: activityWatchBucketId('afkstatus', HOST),
  type: 'afkstatus',
  client: 'monki-focus-mac',
  hostname: HOST,
  created: '2026-10-26T08:00:00Z',
  events: [makeAfkEvent('2026-10-26T09:00:00Z', 420, 'not-afk')],
}

const buckets: ActivityWatchBucket[] = [
  windowBucket,
  afkBucket,
  {
    id: activityWatchBucketId('web.tab.current', HOST),
    type: 'web.tab.current',
    client: 'monki-focus-web',
    hostname: HOST,
    created: '2026-10-26T08:00:00Z',
    events: [
      makeWebEvent('2026-10-26T09:00:00Z', 60, {
        domain: 'example.org',
        path: '/docs',
        surface: 'example.docs',
        title: 'Docs',
      }),
      makeWebEvent('2026-10-26T09:01:00Z', 30, { incognito: true }),
    ],
  },
]

function byTimestamp(bucket: ActivityWatchBucket): ActivityWatchBucket {
  return {
    ...bucket,
    events: [...bucket.events].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1)),
  }
}

describe('ActivityWatchExport', () => {
  it('aw_export_roundtrips_events', () => {
    const json = JSON.stringify(toActivityWatchExport(buckets))
    const parsed = JSON.parse(json) as ActivityWatchExport
    expect(fromActivityWatchExport(parsed)).toStrictEqual(buckets.map(byTimestamp))
  })

  it('aw_export_has_the_aw_server_shape', () => {
    const exported = toActivityWatchExport(buckets)
    expect(Object.keys(exported.buckets)).toStrictEqual([
      'monki-window_test-host',
      'monki-afk_test-host',
      'monki-web-chrome_test-host',
    ])
    expect(exported.buckets['monki-window_test-host']).toStrictEqual({
      id: 'monki-window_test-host',
      created: '2026-10-26T08:00:00Z',
      type: 'currentwindow',
      client: 'monki-focus-mac',
      hostname: HOST,
      data: {},
      events: [
        {
          timestamp: '2026-10-26T09:00:00Z',
          duration: 300,
          data: { app: 'org.example.Editor', title: '' },
        },
        {
          timestamp: '2026-10-26T09:05:00Z',
          duration: 120,
          data: { app: 'org.example.Editor', title: 'Draft' },
        },
      ],
    })
    expect(exported.buckets['monki-web-chrome_test-host']?.events[0]?.data).toStrictEqual({
      url: 'https://example.org/docs',
      title: 'Docs',
      audible: false,
      incognito: false,
      domain: 'example.org',
      path: '/docs',
      surface: 'example.docs',
    })
  })

  it('the_web_bucket_id_names_the_browser_for_the_aw_dashboard', () => {
    expect(activityWatchBucketId('web.tab.current', HOST, 'brave')).toBe(
      'monki-web-brave_test-host'
    )
  })

  it('duplicate_bucket_ids_are_rejected', () => {
    expect(() => toActivityWatchExport([afkBucket, afkBucket])).toThrow('Duplicate bucket id')
  })

  it.each([
    ['currentwindow', makeAfkEvent('2026-10-26T09:00:00Z', 1)],
    ['afkstatus', makeWebEvent('2026-10-26T09:00:00Z', 1)],
    ['web.tab.current', makeWindowEvent('2026-10-26T09:00:00Z', 1)],
  ] as const)('an_event_that_does_not_fit_a_%s_bucket_is_rejected', (type, event) => {
    const bucket = { ...windowBucket, type, events: [event] }
    expect(() => toActivityWatchExport([bucket])).toThrow(`does not fit a ${type} bucket`)
  })

  it('aw_style_offsets_and_fractional_durations_are_read_as_utc_whole_seconds', () => {
    const [bucket] = fromActivityWatchExport({
      buckets: {
        afk: {
          id: 'afk',
          created: '2026-10-26T08:00:00.123456+00:00',
          type: 'afkstatus',
          client: 'aw-watcher-afk',
          hostname: HOST,
          data: {},
          events: [
            { timestamp: '2026-10-26T19:00:00+10:00', duration: 59.6, data: { status: 'afk' } },
          ],
        },
      },
    })
    expect(bucket?.created).toBe('2026-10-26T08:00:00Z')
    expect(bucket?.events).toStrictEqual([makeAfkEvent('2026-10-26T09:00:00Z', 60)])
  })

  it.each([
    ['afkstatus', { status: 'away' }, 'Unknown AFK status away'],
    ['afkstatus', { status: true }, 'status must be a string'],
    ['currentwindow', { title: 'x' }, 'app must be a string'],
    [
      'web.tab.current',
      { domain: 'example.org', path: '/', surface: null, audible: 'no' },
      'audible must be a boolean',
    ],
    [
      'web.tab.current',
      { domain: 'example.org', path: '/', surface: 3 as unknown as null },
      'surface must be a string',
    ],
  ] as const)('a_malformed_%s_event_is_rejected', (type, data, message) => {
    const document: ActivityWatchExport = {
      buckets: {
        bucket: {
          id: 'bucket',
          created: '2026-10-26T08:00:00Z',
          type,
          client: 'monki-focus-web',
          hostname: HOST,
          data: {},
          events: [{ timestamp: '2026-10-26T09:00:00Z', duration: 1, data }],
        },
      },
    }
    expect(() => fromActivityWatchExport(document)).toThrow(message)
  })
})
