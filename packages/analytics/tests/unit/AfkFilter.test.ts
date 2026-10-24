// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { activeTime } from '../../src/index.ts'
import { makeAfkEvent, makeWebEvent, makeWindowEvent } from '../factories/ActivityFactory.ts'

describe('AfkFilter', () => {
  it('afk_in_the_middle_splits_an_event_in_two', () => {
    const events = [makeWindowEvent('2026-10-26T09:00:00Z', 600)]
    const afk = [makeAfkEvent('2026-10-26T09:04:00Z', 60)]
    expect(activeTime(events, afk)).toStrictEqual([
      makeWindowEvent('2026-10-26T09:00:00Z', 240),
      makeWindowEvent('2026-10-26T09:05:00Z', 300),
    ])
  })

  it('not_afk_status_never_cuts_time', () => {
    const events = [makeWindowEvent('2026-10-26T09:00:00Z', 600)]
    const afk = [makeAfkEvent('2026-10-26T09:00:00Z', 600, 'not-afk')]
    expect(activeTime(events, afk)).toStrictEqual(events)
  })

  it('silent_web_time_is_cut_by_afk', () => {
    const events = [makeWebEvent('2026-10-26T09:00:00Z', 600)]
    const afk = [makeAfkEvent('2026-10-26T09:05:00Z', 600)]
    expect(activeTime(events, afk)).toStrictEqual([makeWebEvent('2026-10-26T09:00:00Z', 300)])
  })

  it('fully_afk_and_zero_length_events_are_dropped', () => {
    const events = [
      makeWindowEvent('2026-10-26T09:00:00Z', 60),
      makeWebEvent('2026-10-26T09:30:00Z', 0, { audible: true }),
    ]
    expect(activeTime(events, [makeAfkEvent('2026-10-26T09:00:00Z', 120)])).toStrictEqual([])
  })

  it('pieces_come_out_in_timestamp_order', () => {
    const events = [
      makeWindowEvent('2026-10-26T10:00:00Z', 60, 'org.example.Late'),
      makeWindowEvent('2026-10-26T09:00:00Z', 60, 'org.example.Early'),
    ]
    expect(activeTime(events, []).map((event) => event.timestamp)).toStrictEqual([
      '2026-10-26T09:00:00Z',
      '2026-10-26T10:00:00Z',
    ])
  })
})
