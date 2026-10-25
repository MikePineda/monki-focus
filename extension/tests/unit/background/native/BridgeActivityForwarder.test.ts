// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { BridgeActivityForwarder } from '../../../../src/background/native/BridgeActivityForwarder'
import type { BrowserActivityPayload } from '../../../../src/background/native/BridgeContract'
import { makeEvent } from '../../../factories/makeEvent'

function forwarder() {
  const sent: BrowserActivityPayload[] = []
  return { sent, forwarder: new BridgeActivityForwarder((payload) => sent.push(payload) > 0) }
}

describe('bridge activity forwarder', () => {
  it('each_probed_heartbeat_goes_to_the_app_as_is', () => {
    const { sent, forwarder: subject } = forwarder()
    const heartbeat = makeEvent({ timestamp: '2026-01-05T09:00:00Z', duration: 0 })

    subject.record(heartbeat, null)

    expect(sent).toEqual([heartbeat])
  })

  it('a_tab_switch_first_closes_the_previous_tab_at_the_switch', () => {
    const { sent, forwarder: subject } = forwarder()
    const first = makeEvent({ timestamp: '2026-01-05T09:00:00Z', data: { domain: 'example.com' } })
    const second = makeEvent({ timestamp: '2026-01-05T09:00:20Z', data: { domain: 'example.org' } })

    subject.record(first, null)
    subject.record(second, '2026-01-05T09:00:12Z')

    expect(sent).toEqual([
      first,
      { timestamp: '2026-01-05T09:00:12Z', duration: 0, data: first.data },
      second,
    ])
  })

  it('focus_leaving_closes_the_open_tab_and_sends_nothing_else', () => {
    const { sent, forwarder: subject } = forwarder()
    const first = makeEvent({ timestamp: '2026-01-05T09:00:00Z' })

    subject.record(first, null)
    subject.record(null, '2026-01-05T09:00:05Z')
    subject.record(null, '2026-01-05T09:00:35Z')

    expect(sent).toEqual([
      first,
      { timestamp: '2026-01-05T09:00:05Z', duration: 0, data: first.data },
    ])
  })

  it('the_same_tab_continuing_is_not_closed', () => {
    const { sent, forwarder: subject } = forwarder()
    const first = makeEvent({ timestamp: '2026-01-05T09:00:00Z' })
    const again = makeEvent({ timestamp: '2026-01-05T09:00:30Z' })

    subject.record(first, null)
    subject.record(again, '2026-01-05T09:00:30Z')

    expect(sent).toEqual([first, again])
  })
})
