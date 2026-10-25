// SPDX-License-Identifier: AGPL-3.0-or-later
import { initialEscalationState } from '@monki-focus/engine'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { EscalationStore } from '../../../../src/background/gate/EscalationStore'
import { GateTabs } from '../../../../src/background/gate/GateTabs'
import { GateTicket } from '../../../../src/background/gate/GateTicket'
import { GATE_TIMER_ALARM, GateTimers } from '../../../../src/background/gate/GateTimers'
import { IntentionNotes } from '../../../../src/background/gate/IntentionNotes'
import { TabCloser } from '../../../../src/background/gate/TabCloser'
import { ManualClock } from '../../../support/ManualClock'

describe('gate stores', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('escalation_state_lives_in_local_storage_and_survives_a_restart', async () => {
    const pausing = {
      ...initialEscalationState('rule-a'),
      phase: 'pausing' as const,
      attemptCount: 1,
      pauseEndsAt: '2026-01-05T09:00:05Z',
    }
    await new EscalationStore(fakeBrowser.storage.local).put(pausing)

    expect(await new EscalationStore(fakeBrowser.storage.local).get('rule-a')).toEqual(pausing)
    expect(await new EscalationStore(fakeBrowser.storage.local).get('rule-b')).toEqual(
      initialEscalationState('rule-b')
    )
  })

  it('rule_ids_named_like_object_members_are_plain_groups', async () => {
    const store = new EscalationStore(fakeBrowser.storage.local)

    expect(await store.get('constructor')).toEqual(initialEscalationState('constructor'))
  })

  it('the_ticket_is_drawn_once_per_session_and_verified_exactly', async () => {
    const zeros = (size: number) => new Uint8Array(size)
    const ticket = new GateTicket(fakeBrowser.storage.session, zeros)

    expect(await ticket.current()).toBe('a'.repeat(32))
    expect(await new GateTicket(fakeBrowser.storage.session).current()).toBe('a'.repeat(32))
    expect(await ticket.verify('a'.repeat(32))).toBe(true)
    expect(await ticket.verify(`${'a'.repeat(31)}b`)).toBe(false)
    expect(await ticket.verify('short')).toBe(false)
  })

  it('a_tab_keeps_its_destination_until_it_closes', async () => {
    const tabs = new GateTabs(fakeBrowser.storage.session)
    await tabs.setDestination(7, 'https://www.reddit.com/')

    expect((await new GateTabs(fakeBrowser.storage.session).get(7)).destination).toBe(
      'https://www.reddit.com/'
    )
    await tabs.forget(7)
    expect(await tabs.get(7)).toEqual({ destination: null, searchPass: null })
  })

  it('each_group_keeps_its_own_last_intention', async () => {
    const notes = new IntentionNotes(fakeBrowser.storage.session)
    await notes.save('rule-a', { text: 'Reply to  one message', minutes: 5 })
    await notes.save('rule-b', { text: 'look up a recipe', minutes: 10 })

    expect(await new IntentionNotes(fakeBrowser.storage.session).of('rule-a')).toEqual({
      text: 'Reply to  one message',
      minutes: 5,
    })
    expect(await notes.of('rule-b')).toEqual({ text: 'look up a recipe', minutes: 10 })
    expect(await notes.of('rule-c')).toBeNull()
  })

  it('the_timer_alarm_follows_the_earliest_end_on_the_browser_clock', async () => {
    const alarms = { create: vi.fn(), clear: vi.fn(() => Promise.resolve(true)) }
    const clock = new ManualClock('2026-01-05T09:00:00Z')
    let next: number | null = clock.now() + 300_000
    const timers = new GateTimers(
      alarms,
      clock,
      () => Promise.resolve(next),
      () => 1_000
    )

    await timers.schedule()
    next = null
    await timers.schedule()

    expect(alarms.create).toHaveBeenCalledWith(GATE_TIMER_ALARM, { when: 301_000 })
    expect(alarms.clear).toHaveBeenCalledWith(GATE_TIMER_ALARM)
  })

  it('closing_the_last_tab_of_a_window_opens_a_new_tab_first', async () => {
    const tabs = {
      get: vi.fn(() => Promise.resolve({ windowId: 1 })),
      query: vi.fn(() => Promise.resolve([{ id: 7 }])),
      create: vi.fn(() => Promise.resolve({})),
      remove: vi.fn(() => Promise.resolve()),
    }

    await new TabCloser(tabs).close(7)

    expect(tabs.create).toHaveBeenCalledWith({ windowId: 1, active: true })
    expect(tabs.remove).toHaveBeenCalledWith(7)
  })

  it('closing_one_of_several_tabs_only_closes_it', async () => {
    const tabs = {
      get: vi.fn(() => Promise.resolve({ windowId: 1 })),
      query: vi.fn(() => Promise.resolve([{ id: 7 }, { id: 8 }])),
      create: vi.fn(() => Promise.resolve({})),
      remove: vi.fn(() => Promise.resolve()),
    }

    await new TabCloser(tabs).close(7)

    expect(tabs.create).not.toHaveBeenCalled()
    expect(tabs.remove).toHaveBeenCalledWith(7)
  })
})
