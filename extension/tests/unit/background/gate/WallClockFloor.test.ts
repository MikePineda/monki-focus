// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { WallClockFloor } from '../../../../src/background/gate/WallClockFloor'

function failingStorage() {
  return {
    get: () => Promise.reject(new Error('storage.unavailable')),
    set: () => Promise.reject(new Error('storage.full')),
  }
}

function memoryStorage() {
  const items: Record<string, unknown> = {}
  return {
    items,
    get: (key: string) => Promise.resolve(key in items ? { [key]: items[key] } : {}),
    set: (changes: Record<string, unknown>) => {
      Object.assign(items, changes)
      return Promise.resolve()
    },
  }
}

describe('WallClockFloor', () => {
  it('a_rewind_is_reported_once_and_the_floor_starts_again_at_the_new_clock', async () => {
    const floor = new WallClockFloor(memoryStorage())

    expect(await floor.rewound(100_000)).toBe(false)
    expect(await floor.rewound(50_000)).toBe(true)
    expect(await floor.rewound(51_000)).toBe(false)
  })

  it('without_storage_the_floor_still_holds_in_memory', async () => {
    const floor = new WallClockFloor(failingStorage())
    await floor.rewound(100_000)

    expect(await floor.rewound(90_000)).toBe(true)
  })
})
