// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { Outbox } from '../../../../src/background/storage/Outbox'
import { makeBlock } from '../../../factories/makeEvent'
import { freshDb } from '../../../support/testDb'

describe('Outbox', () => {
  let outbox: Outbox

  beforeEach(async () => {
    outbox = new Outbox(await freshDb())
  })

  it('outbox_holds_only_the_seven_sync_block_fields', async () => {
    const leaky = { ...makeBlock(), title: 'Secret page', path: '/private' }

    await outbox.enqueueBlocks([leaky], '2026-01-05T09:05:00Z')

    const [entry] = await outbox.peek(10)
    expect(entry).toMatchObject({ kind: 'block', enqueuedAt: '2026-01-05T09:05:00Z' })
    expect(entry?.payload).toEqual(makeBlock())
  })

  it('acknowledged_entries_leave_the_outbox', async () => {
    await outbox.enqueueBlocks([makeBlock(), makeBlock({ level: 0 })], '2026-01-05T09:05:00Z')
    const [first] = await outbox.peek(1)

    await outbox.acknowledge([first?.id ?? -1])

    expect(await outbox.peek(10)).toHaveLength(1)
  })
})
