// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { IdbEventRepository } from '../../../../src/background/storage/IdbEventRepository'
import { makeEvent } from '../../../factories/makeEvent'
import { freshDb } from '../../../support/testDb'

const BUCKET = 'monki-web-chrome_device-a'

describe('IdbEventRepository', () => {
  let repo: IdbEventRepository

  beforeEach(async () => {
    repo = new IdbEventRepository(await freshDb())
  })

  it('events_are_read_back_per_bucket_in_time_order', async () => {
    await repo.add(BUCKET, makeEvent({ timestamp: '2026-01-05T09:10:00Z' }))
    await repo.add(BUCKET, makeEvent({ timestamp: '2026-01-05T09:00:00Z' }))
    await repo.add('another-bucket', makeEvent({ timestamp: '2026-01-05T09:05:00Z' }))

    const events = await repo.between(BUCKET, '2026-01-05T00:00:00Z', '2026-01-06T00:00:00Z')

    expect(events.map((event) => event.timestamp)).toEqual([
      '2026-01-05T09:00:00Z',
      '2026-01-05T09:10:00Z',
    ])
  })

  it('between_includes_the_start_and_excludes_the_end', async () => {
    await repo.add(BUCKET, makeEvent({ timestamp: '2026-01-05T09:00:00Z' }))
    await repo.add(BUCKET, makeEvent({ timestamp: '2026-01-05T10:00:00Z' }))

    const events = await repo.between(BUCKET, '2026-01-05T09:00:00Z', '2026-01-05T10:00:00Z')

    expect(events).toHaveLength(1)
  })

  it('replace_overwrites_the_event_with_the_same_id', async () => {
    const id = await repo.add(BUCKET, makeEvent({ duration: 10 }))

    await repo.replace(id, BUCKET, makeEvent({ duration: 70 }))

    const [event] = await repo.between(BUCKET, '2026-01-05T00:00:00Z', '2026-01-06T00:00:00Z')
    expect(event?.duration).toBe(70)
  })

  it('stored_events_never_carry_fields_outside_the_event_model', async () => {
    const withExtra = { ...makeEvent(), url: 'https://news.example/a?q=secret' }

    await repo.add(BUCKET, withExtra)

    const [event] = await repo.between(BUCKET, '2026-01-05T00:00:00Z', '2026-01-06T00:00:00Z')
    expect(event).toEqual(makeEvent())
  })

  it('delete_before_removes_only_older_events_of_every_bucket', async () => {
    await repo.add(BUCKET, makeEvent({ timestamp: '2026-01-01T00:00:00Z' }))
    await repo.add('another-bucket', makeEvent({ timestamp: '2026-01-01T00:00:00Z' }))
    await repo.add(BUCKET, makeEvent({ timestamp: '2026-01-05T00:00:00Z' }))

    const deleted = await repo.deleteBefore('2026-01-05T00:00:00Z')

    expect(deleted).toBe(2)
    expect(await repo.between(BUCKET, '2026-01-01T00:00:00Z', '2026-01-06T00:00:00Z')).toHaveLength(
      1
    )
  })
})
