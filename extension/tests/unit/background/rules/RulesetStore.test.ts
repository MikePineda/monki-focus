// SPDX-License-Identifier: AGPL-3.0-or-later
import { starterPreset, type Ruleset } from '@monki-focus/rules/pure'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { RULESET_KEY, RulesetStore } from '../../../../src/background/rules/RulesetStore'

async function stored(): Promise<Ruleset | undefined> {
  return (await fakeBrowser.storage.local.get(RULESET_KEY))[RULESET_KEY] as Ruleset | undefined
}

function makeStore(zone = 'Etc/GMT-10') {
  const deviceTimeZone = vi.fn(() => zone)
  return {
    store: new RulesetStore({ storage: fakeBrowser.storage.local, deviceTimeZone }),
    deviceTimeZone,
  }
}

describe('RulesetStore', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('install_creates_the_starter_preset_pinned_to_the_device_time_zone', async () => {
    const { store } = makeStore('Etc/GMT+6')

    await store.ensureCreated()

    expect(await stored()).toEqual({ ...starterPreset, timeZone: 'Etc/GMT+6' })
  })

  it('time_zone_stays_pinned_after_the_device_moves', async () => {
    await makeStore('Etc/GMT-1').store.ensureCreated()

    const { store, deviceTimeZone } = makeStore('Etc/GMT-9')
    const ruleset = await store.load()

    expect(ruleset.timeZone).toBe('Etc/GMT-1')
    expect(deviceTimeZone).not.toHaveBeenCalled()
    expect((await stored())?.timeZone).toBe('Etc/GMT-1')
  })

  it('first_read_without_an_install_creates_the_starter_once', async () => {
    const { store, deviceTimeZone } = makeStore()

    const [first, second] = await Promise.all([store.load(), store.ensureCreated()])

    expect(first.rules).toEqual(starterPreset.rules)
    expect(second).toBeUndefined()
    expect(deviceTimeZone).toHaveBeenCalledOnce()
  })

  it('creating_never_mutates_the_bundled_preset', async () => {
    const before = structuredClone(starterPreset)

    const ruleset = await makeStore().store.load()
    ruleset.rules.pop()

    expect(starterPreset).toEqual(before)
  })

  it('a_stored_rule_set_is_returned_as_stored', async () => {
    const custom = { ...structuredClone(starterPreset), rules: [], timeZone: 'UTC' }
    await fakeBrowser.storage.local.set({ [RULESET_KEY]: custom })

    expect(await makeStore().store.load()).toEqual(custom)
  })

  it('a_change_in_storage_drops_the_cache_and_notifies', async () => {
    const { store } = makeStore()
    await store.load()
    const onChange = vi.fn()
    store.watch(fakeBrowser.storage.onChanged, onChange)

    const custom = { ...structuredClone(starterPreset), rules: [], timeZone: 'UTC' }
    await fakeBrowser.storage.local.set({ [RULESET_KEY]: custom })

    expect(onChange).toHaveBeenCalledOnce()
    expect((await store.load()).rules).toEqual([])
  })

  it('unrelated_storage_changes_keep_the_cache', async () => {
    const { store } = makeStore()
    const onChange = vi.fn()
    store.watch(fakeBrowser.storage.onChanged, onChange)

    await fakeBrowser.storage.local.set({ 'ui.theme': 'dark' })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('a_failed_read_is_retried_on_the_next_load', async () => {
    const get = vi
      .fn()
      .mockRejectedValueOnce(new Error('io'))
      .mockResolvedValue({ [RULESET_KEY]: starterPreset })
    const store = new RulesetStore({
      storage: { get, set: vi.fn() },
      deviceTimeZone: () => 'UTC',
    })

    await expect(store.load()).rejects.toThrow('io')
    expect(await store.load()).toEqual(starterPreset)
  })

  it('a_save_racing_the_first_read_is_never_overwritten_by_the_starter', async () => {
    const { store } = makeStore()
    const custom = { ...structuredClone(starterPreset), rules: [], timeZone: 'UTC' }

    const loading = store.load()
    const saving = store.save(custom)
    await Promise.all([loading, saving])

    expect(await stored()).toEqual(custom)
    expect(await store.load()).toEqual(custom)
  })

  it('a_failed_save_does_not_block_later_ones', async () => {
    const set = vi.fn().mockRejectedValueOnce(new Error('quota')).mockResolvedValue(undefined)
    const store = new RulesetStore({
      storage: { get: vi.fn().mockResolvedValue({}), set },
      deviceTimeZone: () => 'UTC',
    })

    await expect(store.save(starterPreset)).rejects.toThrow('quota')
    await expect(store.save(starterPreset)).resolves.toBeUndefined()
  })
})
