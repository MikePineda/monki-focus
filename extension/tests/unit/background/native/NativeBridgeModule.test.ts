// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { createNativeBridgeModule } from '../../../../src/background/native/NativeBridgeModule'
import { Outbox } from '../../../../src/background/storage/Outbox'
import { FakeNativeHost } from '../../../support/FakeNativeHost'
import { ManualClock } from '../../../support/ManualClock'
import { startTracking } from '../../../support/trackingHarness'

const NOW = '2026-01-05T09:00:00Z'
const ACK = {
  v: 1,
  id: 'a1',
  type: 'hello.ack',
  payload: { aggregator: 'mac', appVersion: '0.1.0', schemaVersion: 1 },
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function bridge(host: FakeNativeHost, clock: ManualClock) {
  return createNativeBridgeModule({
    connectNative: host.connect,
    extensionVersion: '0.1.0',
    browserKind: 'chrome',
    session: fakeBrowser.storage.session,
    windows: fakeBrowser.windows,
    alarms: fakeBrowser.alarms,
    clock,
    setTimer: () => undefined,
  })
}

describe('native bridge module', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('tracked_heartbeats_reach_the_mac_app_and_its_blocks_are_not_synced_twice', async () => {
    const host = new FakeNativeHost()
    const clock = new ManualClock(NOW)
    const module = bridge(host, clock)
    module.start()
    host.last.reply(ACK)
    await flush()
    const harness = await startTracking({
      now: NOW,
      clock,
      onHeartbeat: module.onHeartbeat,
      syncBlocks: () => module.syncBlocks(),
    })

    harness.browser.activate({ url: 'https://news.example/today?ref=feed#top' })
    await harness.settle()
    await harness.module.aggregate()

    const sent = host.last.postedOf('browser.activity').map((message) => message.payload)
    expect(sent).toEqual([
      {
        timestamp: NOW,
        duration: 0,
        data: {
          domain: 'news.example',
          path: '/today',
          surface: null,
          audible: false,
          incognito: false,
        },
      },
    ])
    expect(JSON.stringify(host.last.posted)).not.toContain('ref=feed')
    expect(await new Outbox(harness.db).peek(10)).toEqual([])
  })

  it('without_the_app_tracking_and_sync_carry_on_alone', async () => {
    const host = new FakeNativeHost()
    host.failing = true
    const clock = new ManualClock(NOW)
    const module = bridge(host, clock)
    module.start()
    const harness = await startTracking({
      now: NOW,
      clock,
      onHeartbeat: module.onHeartbeat,
      syncBlocks: () => module.syncBlocks(),
    })

    harness.browser.activate({ url: 'https://news.example/' })
    await harness.settle()
    await harness.alarmPulseAfter(30)
    await harness.module.aggregate()

    expect(module.client.state).toBe('disconnected')
    expect((await new Outbox(harness.db).peek(10)).length).toBeGreaterThan(0)
  })

  it('a_focus_change_is_reported_without_window_details', async () => {
    const host = new FakeNativeHost()
    const module = bridge(host, new ManualClock(NOW))
    module.start()
    host.last.reply(ACK)
    await flush()

    await fakeBrowser.windows.onFocusChanged.trigger(fakeBrowser.windows.WINDOW_ID_NONE)
    await fakeBrowser.windows.onFocusChanged.trigger(7)

    expect(host.last.postedOf('browser.focus').map((message) => message.payload)).toEqual([
      { focused: false },
      { focused: true },
    ])
  })
})
