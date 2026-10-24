// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest'
import { FEED_GUARD_SCRIPT, SiteTabs } from '../../../../src/background/feeds/SiteTabs'
import { SITE_HOST_PERMISSIONS } from '../../../../config/extensionManifest'

function makeTabs() {
  const query = vi.fn(() => Promise.resolve([{ id: 1 }, { id: 2 }, {}]))
  const sendMessage = vi.fn((tabId: number) =>
    tabId === 2 ? Promise.reject(new Error('no receiver')) : Promise.resolve(undefined)
  )
  const executeScript = vi.fn(() => Promise.resolve([]))
  return {
    tabs: new SiteTabs({ query, sendMessage, executeScript }),
    query,
    sendMessage,
    executeScript,
  }
}

describe('SiteTabs', () => {
  it('broadcast_reaches_every_open_site_tab_and_survives_failures', async () => {
    const { tabs, query, sendMessage } = makeTabs()

    expect(await tabs.broadcast({ v: 1, type: 'decision.changed' })).toBe(1)
    expect(query).toHaveBeenCalledWith({ url: [...SITE_HOST_PERMISSIONS] })
    expect(sendMessage).toHaveBeenCalledTimes(2)
  })

  it('inject_feed_guard_runs_the_built_content_script_in_each_site_tab', async () => {
    const { tabs, executeScript } = makeTabs()

    expect(await tabs.injectFeedGuard()).toBe(2)
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 1 },
      files: ['/content-scripts/feed-guard.js'],
    })
    expect(FEED_GUARD_SCRIPT).toBe('/content-scripts/feed-guard.js')
  })
})
