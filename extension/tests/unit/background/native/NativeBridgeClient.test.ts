// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import {
  AGGREGATOR_STORAGE_NAME,
  AggregatorFlag,
} from '../../../../src/background/native/AggregatorFlag'
import {
  NativeBridgeClient,
  type AppPush,
} from '../../../../src/background/native/NativeBridgeClient'
import { FakeNativeHost } from '../../../support/FakeNativeHost'
import { ManualClock } from '../../../support/ManualClock'

const ACK = {
  v: 1,
  id: 'a1',
  type: 'hello.ack',
  payload: { aggregator: 'mac', appVersion: '0.1.0', schemaVersion: 1 },
}
const UNAVAILABLE = { v: 1, id: 'app-unavailable', type: 'app.unavailable', payload: {} }
const HEARTBEAT = {
  timestamp: '2026-01-05T09:00:00Z',
  duration: 0,
  data: { domain: 'example.com', path: '/', surface: null, audible: false, incognito: false },
}

interface Scheduled {
  callback: () => void
  delayMs: number
}

function setup() {
  const host = new FakeNativeHost()
  const clock = new ManualClock('2026-01-05T09:00:00Z')
  const timers: Scheduled[] = []
  const pushes: AppPush[] = []
  const aggregator = new AggregatorFlag(fakeBrowser.storage.session)
  let ids = 0
  const client = new NativeBridgeClient({
    connectNative: host.connect,
    extensionVersion: '0.1.0',
    browser: 'brave',
    aggregator,
    clock,
    setTimer: (callback, delayMs) => timers.push({ callback, delayMs }),
    random: () => 0.5,
    randomId: () => `id-${String(++ids)}`,
    onPush: (message) => pushes.push(message),
  })
  const fireTimers = () => {
    const due = timers.splice(0)
    for (const timer of due) {
      clock.advanceSeconds(timer.delayMs / 1000)
      timer.callback()
    }
  }
  return { host, clock, timers, pushes, aggregator, client, fireTimers }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('native bridge client', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('connects_to_the_monki_bridge_host_and_says_hello_first', () => {
    const { host, client } = setup()

    client.start()

    expect(host.hostNames).toEqual(['dev.monkifocus.bridge'])
    expect(host.last.posted).toEqual([
      {
        v: 1,
        id: 'id-1',
        type: 'hello',
        payload: { extensionVersion: '0.1.0', schemaVersion: 1, browser: 'brave' },
      },
    ])
  })

  it('hello_ack_from_the_mac_sets_the_dedupe_flag', async () => {
    const { host, client, aggregator } = setup()
    client.start()

    host.last.reply(ACK)
    await flush()

    expect(client.state).toBe('connected')
    expect(await aggregator.isMac()).toBe(true)
    expect(await aggregator.extensionSyncsBlocks()).toBe(false)
  })

  it('app_unavailable_keeps_the_extension_on_its_own_and_retries_later', async () => {
    const { host, client, aggregator, timers } = setup()
    await fakeBrowser.storage.session.set({ [AGGREGATOR_STORAGE_NAME]: 'mac' })
    client.start()

    host.last.reply(UNAVAILABLE)
    host.last.hangUp()
    await flush()

    expect(client.state).toBe('unavailable')
    expect(await aggregator.extensionSyncsBlocks()).toBe(true)
    expect(client.send('browser.focus', { focused: true })).toBe(false)
    expect(timers.map((timer) => timer.delayMs)).toEqual([1000])
  })

  it('a_missing_host_never_throws_and_backs_off_up_to_a_minute', () => {
    const { host, client, timers, fireTimers } = setup()
    host.failing = true

    client.start()
    const delays: number[] = []
    for (let attempt = 0; attempt < 10; attempt += 1) {
      delays.push(...timers.map((timer) => timer.delayMs))
      fireTimers()
    }

    expect(delays[0]).toBe(1000)
    expect(delays.every((delay) => delay >= 1000 && delay <= 60_000)).toBe(true)
    expect(delays.at(-1)).toBe(45_000)
    expect(host.hostNames).toHaveLength(11)
  })

  it('a_disconnect_clears_the_flag_and_reconnects_with_a_fresh_hello', async () => {
    const { host, client, aggregator, fireTimers } = setup()
    client.start()
    host.last.reply(ACK)
    await flush()

    host.last.hangUp()
    await flush()
    expect(await aggregator.isMac()).toBe(false)
    fireTimers()

    expect(host.ports).toHaveLength(2)
    expect(host.last.postedOf('hello')).toHaveLength(1)
  })

  it('an_acknowledged_connection_resets_the_backoff', async () => {
    const { host, client, timers, fireTimers } = setup()
    client.start()
    host.last.hangUp()
    fireTimers()
    host.last.hangUp()
    expect(timers.map((timer) => timer.delayMs)).toEqual([1500])
    fireTimers()

    host.last.reply(ACK)
    await flush()
    host.last.hangUp()

    expect(timers.map((timer) => timer.delayMs)).toEqual([1000])
  })

  it('messages_are_sent_only_once_the_app_acknowledged', async () => {
    const { host, client } = setup()
    client.start()

    expect(client.send('browser.activity', HEARTBEAT)).toBe(false)
    host.last.reply(ACK)
    await flush()

    expect(client.send('browser.activity', HEARTBEAT)).toBe(true)
    expect(host.last.postedOf('browser.activity').map((message) => message.payload)).toEqual([
      HEARTBEAT,
    ])
  })

  it('a_payload_the_contract_refuses_never_reaches_the_wire', async () => {
    const { host, client } = setup()
    client.start()
    host.last.reply(ACK)
    await flush()

    const withQuery = { ...HEARTBEAT, data: { ...HEARTBEAT.data, path: '/watch?v=secret' } }

    expect(client.send('browser.activity', withQuery)).toBe(false)
    expect(host.last.postedOf('browser.activity')).toEqual([])
  })

  it('app_pushes_reach_the_worker_only_when_valid_and_acknowledged', async () => {
    const { host, client, pushes } = setup()
    const state = {
      v: 1,
      id: 's1',
      type: 'focusSession.state',
      payload: { active: false, endsAt: null },
    }
    client.start()

    host.last.reply(state)
    host.last.reply(ACK)
    await flush()
    host.last.reply({ ...state, payload: { active: true, endsAt: null } })
    host.last.reply({ v: 1, id: 'x', type: 'hello', payload: {} })
    host.last.reply(state)

    expect(pushes).toEqual([state])
  })

  it('an_unlock_token_is_handed_on_unverified_as_a_push', async () => {
    const { host, client, pushes } = setup()
    const unlock = {
      v: 1,
      id: 'u1',
      type: 'unlock.token',
      payload: { token: 'v4.public.c3ludGhldGlj.Zm9vdGVy' },
    }
    client.start()
    host.last.reply(ACK)
    await flush()

    host.last.reply(unlock)

    expect(pushes).toEqual([unlock])
  })

  it('a_retry_whose_timer_died_with_the_worker_is_caught_up', () => {
    const { host, client, clock, timers } = setup()
    client.start()
    host.last.hangUp()
    timers.splice(0)

    client.ensureConnected()
    expect(host.ports).toHaveLength(1)
    clock.advanceSeconds(2)
    client.ensureConnected()

    expect(host.ports).toHaveLength(2)
  })

  it('stop_disconnects_and_never_reconnects', () => {
    const { host, client, timers } = setup()
    client.start()

    client.stop()
    client.ensureConnected()

    expect(host.last.disconnected).toBe(true)
    expect(host.ports).toHaveLength(1)
    expect(timers).toEqual([])
  })
})
