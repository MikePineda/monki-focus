// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { UnsavedOverrideGrants } from '../../../../src/background/gate/UnsavedOverrideGrants'

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

describe('UnsavedOverrideGrants', () => {
  it('with_every_storage_area_failing_a_wait_still_keeps_its_one_grant', async () => {
    const grants = new UnsavedOverrideGrants(failingStorage())

    await grants.record('rule-a 2026-01-05T09:02:00Z', 1_000)

    expect(await grants.endsAt('rule-a 2026-01-05T09:02:00Z')).toBe(1_000)
    expect(await grants.endsAt('rule-a 2026-01-05T10:00:00Z')).toBeNull()
  })

  it('a_restarted_worker_reads_the_grants_back_and_a_rewind_ends_them', async () => {
    const storage = memoryStorage()
    await new UnsavedOverrideGrants(storage).record('rule-a 2026-01-05T09:02:00Z', 1_000)
    const restarted = new UnsavedOverrideGrants(storage)

    expect(await restarted.endsAt('rule-a 2026-01-05T09:02:00Z')).toBe(1_000)
    await restarted.expireAll()
    expect(await new UnsavedOverrideGrants(storage).endsAt('rule-a 2026-01-05T09:02:00Z')).toBe(0)
  })
})
