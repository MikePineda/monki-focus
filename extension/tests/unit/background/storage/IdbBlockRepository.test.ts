// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { IdbBlockRepository } from '../../../../src/background/storage/IdbBlockRepository'
import { makeBlock } from '../../../factories/makeEvent'
import { freshDb } from '../../../support/testDb'

const DAY = ['2026-01-05T00:00:00Z', '2026-01-06T00:00:00Z'] as const

describe('IdbBlockRepository', () => {
  let repo: IdbBlockRepository

  beforeEach(async () => {
    repo = new IdbBlockRepository(await freshDb())
  })

  it('upsert_is_idempotent_by_natural_key', async () => {
    const blocks = [makeBlock(), makeBlock({ activityKey: 'docs.example', level: 100 })]

    await repo.upsert(blocks)
    await repo.upsert(blocks)

    expect(await repo.between(...DAY)).toHaveLength(2)
  })

  it('upsert_replaces_seconds_instead_of_adding_them', async () => {
    await repo.upsert([makeBlock({ seconds: 120 })])

    await repo.upsert([makeBlock({ seconds: 180 })])

    expect(await repo.between(...DAY)).toEqual([makeBlock({ seconds: 180 })])
  })

  it('blocks_without_an_activity_key_keep_their_null_key', async () => {
    await repo.upsert([makeBlock({ activityKey: null })])

    const [block] = await repo.between(...DAY)

    expect(block?.activityKey).toBeNull()
  })

  it('blocks_never_store_a_title_or_url', async () => {
    const leaky = { ...makeBlock(), title: 'Secret page', url: 'https://news.example/a' }

    await repo.upsert([leaky])

    expect(await repo.between(...DAY)).toEqual([makeBlock()])
  })

  it('a_block_that_breaks_the_sync_schema_is_rejected', async () => {
    await expect(
      repo.upsert([makeBlock({ activityKey: 'https://news.example/a' })])
    ).rejects.toThrow(RangeError)
  })

  it('replace_range_drops_stale_blocks_and_reports_only_changes', async () => {
    await repo.upsert([
      makeBlock({ seconds: 100 }),
      makeBlock({ activityKey: 'stale.example' }),
      makeBlock({ blockStart: '2026-01-05T10:00:00Z' }),
      makeBlock({ deviceId: 'device-b' }),
    ])

    const changed = await repo.replaceRange(
      'device-a',
      '2026-01-05T09:00:00Z',
      '2026-01-05T09:05:00Z',
      [makeBlock({ seconds: 100 }), makeBlock({ activityKey: 'docs.example', seconds: 30 })]
    )

    expect(changed).toEqual([makeBlock({ activityKey: 'docs.example', seconds: 30 })])
    const keys = (await repo.between(...DAY)).map((block) => [block.deviceId, block.activityKey])
    expect(keys).toEqual(
      expect.arrayContaining([
        ['device-a', 'news.example'],
        ['device-a', 'docs.example'],
        ['device-b', 'news.example'],
      ])
    )
    expect(keys).not.toContainEqual(['device-a', 'stale.example'])
    expect(await repo.between('2026-01-05T10:00:00Z', '2026-01-05T10:05:00Z')).toHaveLength(1)
  })
})
