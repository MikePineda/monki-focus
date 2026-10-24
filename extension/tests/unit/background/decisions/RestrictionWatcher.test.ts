// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import {
  RESTRICTION_SNAPSHOT_NAME,
  RestrictionWatcher,
} from '../../../../src/background/decisions/RestrictionWatcher'
import { bundledRulesCatalog } from '../../../../src/shared/bundledRulesCatalog'

function makeWatcher(restricted: Set<string>) {
  const onChange = vi.fn()
  const watcher = new RestrictionWatcher({
    catalog: bundledRulesCatalog(),
    restriction: { restricts: (surface) => Promise.resolve(restricted.has(surface)) },
    storage: fakeBrowser.storage.session,
    onChange,
  })
  return { watcher, onChange }
}

describe('RestrictionWatcher', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('the_first_check_only_records_the_restricted_feeds', async () => {
    const { watcher, onChange } = makeWatcher(new Set(['reddit.feed']))

    expect(await watcher.check()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
    expect(
      (await fakeBrowser.storage.session.get(RESTRICTION_SNAPSHOT_NAME))[RESTRICTION_SNAPSHOT_NAME]
    ).toBe('reddit.feed')
  })

  it('a_schedule_edge_that_changes_the_restricted_set_notifies', async () => {
    const restricted = new Set(['reddit.feed'])
    const { watcher, onChange } = makeWatcher(restricted)
    await watcher.check()

    restricted.add('youtube.home')

    expect(await watcher.check()).toBe(true)
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('an_unchanged_set_stays_quiet', async () => {
    const { watcher, onChange } = makeWatcher(new Set(['x.home']))
    await watcher.check()

    expect(await watcher.check()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('a_restarted_worker_still_sees_the_change', async () => {
    const restricted = new Set(['x.home'])
    await makeWatcher(restricted).watcher.check()
    restricted.delete('x.home')

    const { watcher, onChange } = makeWatcher(restricted)

    expect(await watcher.check()).toBe(true)
    expect(onChange).toHaveBeenCalledOnce()
  })
})
