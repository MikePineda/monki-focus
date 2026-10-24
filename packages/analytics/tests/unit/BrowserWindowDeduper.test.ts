// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { BROWSER_UNKNOWN, dedupeBrowserTime } from '../../src/index.ts'
import type { BrowserDedupeInput } from '../../src/index.ts'
import { makeAfkEvent, makeWebEvent, makeWindowEvent } from '../factories/ActivityFactory.ts'

const BROWSER = 'org.example.Browser'

function input(overrides: Partial<BrowserDedupeInput>): BrowserDedupeInput {
  return {
    browserApps: [BROWSER],
    windowEvents: [],
    webEvents: [],
    extensionLastHeartbeatAt: '2026-10-26T12:00:00Z',
    staleAfterSeconds: 60,
    ...overrides,
  }
}

describe('BrowserWindowDeduper', () => {
  it('without_any_extension_heartbeat_browser_time_is_the_browser_app', () => {
    const segments = dedupeBrowserTime(
      input({
        windowEvents: [makeWindowEvent('2026-10-26T10:00:00Z', 300, BROWSER)],
        extensionLastHeartbeatAt: null,
      })
    )
    expect(segments).toStrictEqual([
      {
        start: '2026-10-26T10:00:00Z',
        end: '2026-10-26T10:05:00Z',
        source: 'app',
        activityKey: BROWSER,
      },
    ])
  })

  it('silence_before_the_first_heartbeat_is_the_browser_app_and_after_it_goes_stale', () => {
    // Known heartbeats: 10:02 (end of the web event) and 12:00 (last seen), which
    // never covers the earlier silence.
    const segments = dedupeBrowserTime(
      input({
        windowEvents: [makeWindowEvent('2026-10-26T10:00:00Z', 300, BROWSER)],
        webEvents: [makeWebEvent('2026-10-26T10:01:00Z', 60, { domain: 'example.org' })],
      })
    )
    expect(
      segments.map((segment) => [segment.start.slice(11, 16), segment.activityKey])
    ).toStrictEqual([
      ['10:00', BROWSER],
      ['10:01', 'example.org'],
      ['10:02', BROWSER_UNKNOWN],
      ['10:03', BROWSER],
    ])
  })

  it('a_heartbeat_inside_a_stretch_restarts_the_unknown_window', () => {
    const segments = dedupeBrowserTime(
      input({
        windowEvents: [makeWindowEvent('2026-10-26T10:00:00Z', 300, BROWSER)],
        webEvents: [makeWebEvent('2026-10-26T09:59:30Z', 30)],
        extensionLastHeartbeatAt: '2026-10-26T10:00:40Z',
      })
    )
    // 10:00 → 10:01:40 stays unknown: the 10:00:40 heartbeat extends the first window.
    expect(
      segments.map((segment) => [segment.start.slice(11, 19), segment.activityKey])
    ).toStrictEqual([
      ['09:59:30', 'example.org'],
      ['10:00:00', BROWSER_UNKNOWN],
      ['10:01:40', BROWSER],
    ])
  })

  it('payloads_of_the_wrong_kind_and_zero_length_events_are_ignored', () => {
    const segments = dedupeBrowserTime(
      input({
        windowEvents: [
          makeAfkEvent('2026-10-26T10:00:00Z', 60),
          makeWindowEvent('2026-10-26T10:00:00Z', 0),
        ],
        webEvents: [makeWindowEvent('2026-10-26T10:00:00Z', 60)],
      })
    )
    expect(segments).toStrictEqual([])
  })

  it('segments_starting_together_are_ordered_by_end_then_source_then_key', () => {
    const segments = dedupeBrowserTime(
      input({
        windowEvents: [
          makeWindowEvent('2026-10-26T10:00:00Z', 120, 'org.example.Zeta'),
          makeWindowEvent('2026-10-26T10:00:00Z', 120, 'org.example.Alpha'),
          makeWindowEvent('2026-10-26T10:00:00Z', 60, 'org.example.Late'),
        ],
        webEvents: [makeWebEvent('2026-10-26T10:00:00Z', 120)],
      })
    )
    expect(segments.map((segment) => segment.activityKey)).toStrictEqual([
      'org.example.Late',
      'org.example.Alpha',
      'org.example.Zeta',
      'example.org',
    ])
  })
})
