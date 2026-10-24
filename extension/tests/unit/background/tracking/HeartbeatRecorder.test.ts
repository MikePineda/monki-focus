// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { IdbEventRepository } from '../../../../src/background/storage/IdbEventRepository'
import {
  HeartbeatRecorder,
  OPEN_HEARTBEAT_STORAGE_NAME,
} from '../../../../src/background/tracking/HeartbeatRecorder'
import { makeEvent } from '../../../factories/makeEvent'
import { freshDb } from '../../../support/testDb'

const BUCKET = 'monki-web-chrome_device-a'
const PULSETIME = 45
const DAY = ['2026-01-05T00:00:00Z', '2026-01-06T00:00:00Z'] as const

function beat(timestamp: string, domain = 'news.example') {
  return makeEvent({ timestamp, duration: 0, data: { domain } })
}

describe('HeartbeatRecorder', () => {
  let events: IdbEventRepository
  let recorder: HeartbeatRecorder

  beforeEach(async () => {
    fakeBrowser.reset()
    events = new IdbEventRepository(await freshDb())
    recorder = new HeartbeatRecorder(fakeBrowser.storage.session, events, BUCKET, PULSETIME)
  })

  it('heartbeat_within_pulsetime_extends_the_open_event', async () => {
    await recorder.record(beat('2026-01-05T09:00:00Z'), null)
    await recorder.record(beat('2026-01-05T09:00:30Z'), null)
    await recorder.record(beat('2026-01-05T09:01:00Z'), null)

    expect(await events.between(BUCKET, ...DAY)).toEqual([
      makeEvent({ timestamp: '2026-01-05T09:00:00Z', duration: 60 }),
    ])
  })

  it('heartbeat_after_pulsetime_opens_a_new_event', async () => {
    await recorder.record(beat('2026-01-05T09:00:00Z'), null)
    await recorder.record(beat('2026-01-05T09:01:00Z'), null)

    expect(await events.between(BUCKET, ...DAY)).toHaveLength(2)
  })

  it('switching_sites_closes_the_open_event_at_the_switch', async () => {
    await recorder.record(beat('2026-01-05T09:00:00Z'), null)
    await recorder.record(beat('2026-01-05T09:00:30Z'), null)

    await recorder.record(beat('2026-01-05T09:00:50Z', 'docs.example'), '2026-01-05T09:00:50Z')

    expect(await events.between(BUCKET, ...DAY)).toEqual([
      makeEvent({ timestamp: '2026-01-05T09:00:00Z', duration: 50 }),
      makeEvent({
        timestamp: '2026-01-05T09:00:50Z',
        duration: 0,
        data: { domain: 'docs.example' },
      }),
    ])
  })

  it('nothing_to_count_ends_the_open_event', async () => {
    await recorder.record(beat('2026-01-05T09:00:00Z'), null)

    await recorder.record(null, '2026-01-05T09:00:20Z')
    await recorder.record(beat('2026-01-05T09:00:40Z'), null)

    expect((await events.between(BUCKET, ...DAY)).map((event) => event.duration)).toEqual([20, 0])
    expect(await fakeBrowser.storage.session.get(OPEN_HEARTBEAT_STORAGE_NAME)).toMatchObject({
      [OPEN_HEARTBEAT_STORAGE_NAME]: { event: { timestamp: '2026-01-05T09:00:40Z' } },
    })
  })

  it('a_close_past_pulsetime_does_not_stretch_the_event', async () => {
    await recorder.record(beat('2026-01-05T09:00:00Z'), null)

    await recorder.record(null, '2026-01-05T09:05:00Z')

    expect((await events.between(BUCKET, ...DAY))[0]?.duration).toBe(0)
  })

  it('a_new_worker_keeps_extending_the_event_left_in_session_storage', async () => {
    await recorder.record(beat('2026-01-05T09:00:00Z'), null)
    await recorder.record(beat('2026-01-05T09:00:30Z'), null)

    const restarted = new HeartbeatRecorder(fakeBrowser.storage.session, events, BUCKET, PULSETIME)
    await restarted.record(beat('2026-01-05T09:01:00Z'), null)

    expect(await events.between(BUCKET, ...DAY)).toEqual([
      makeEvent({ timestamp: '2026-01-05T09:00:00Z', duration: 60 }),
    ])
  })
})
