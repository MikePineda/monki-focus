// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { heartbeat, mergeHeartbeats } from '../../src/index.ts'
import { makeWebEvent, makeWindowEvent } from '../factories/ActivityFactory.ts'

describe('HeartbeatMerger', () => {
  it('heartbeat_without_a_last_event_opens_a_new_event', () => {
    expect(heartbeat(null, makeWebEvent('2026-10-26T09:00:00Z', 0), 45)).toBeNull()
  })

  it('heartbeat_at_exactly_pulsetime_after_the_end_still_extends', () => {
    const last = makeWebEvent('2026-10-26T09:00:00Z', 30)
    const next = makeWebEvent('2026-10-26T09:01:15Z', 0)
    expect(heartbeat(last, next, 45)).toStrictEqual(makeWebEvent('2026-10-26T09:00:00Z', 75))
  })

  it('heartbeat_before_the_last_event_opens_a_new_event', () => {
    const last = makeWebEvent('2026-10-26T09:00:00Z', 30)
    expect(heartbeat(last, makeWebEvent('2026-10-26T08:59:59Z', 0), 45)).toBeNull()
  })

  it('heartbeat_inside_the_event_never_shortens_it', () => {
    const last = makeWebEvent('2026-10-26T09:00:00Z', 60)
    const merged = heartbeat(last, makeWebEvent('2026-10-26T09:00:10Z', 5), 45)
    expect(merged?.duration).toBe(60)
  })

  it('heartbeat_with_a_title_differs_from_one_without', () => {
    const last = makeWindowEvent('2026-10-26T09:00:00Z', 30, 'org.example.Editor')
    const next = makeWindowEvent('2026-10-26T09:00:30Z', 0, 'org.example.Editor', 'Draft')
    expect(heartbeat(last, next, 45)).toBeNull()
  })

  it('merge_heartbeats_starts_an_empty_bucket_and_never_mutates_inputs', () => {
    const heartbeats = [
      makeWebEvent('2026-10-26T09:00:00Z', 0),
      makeWebEvent('2026-10-26T09:00:30Z', 0),
      makeWebEvent('2026-10-26T09:01:00Z', 0),
    ]
    const snapshot = structuredClone(heartbeats)
    expect(mergeHeartbeats([], heartbeats, 45)).toStrictEqual([
      makeWebEvent('2026-10-26T09:00:00Z', 60),
    ])
    expect(heartbeats).toStrictEqual(snapshot)
  })
})
