// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest'
import {
  CommandRouter,
  type CommandHandlers,
} from '../../../../src/background/commands/CommandRouter'
import { parseHandoff } from '../../../../src/gate/GateHandoff'
import { commandMessage } from '../../../../src/shared/messages'

const OWN_ID = 'own-extension-id'
const GATE_PAGE = `chrome-extension://${OWN_ID}/gate.html`
const TICKET = 'abcdefghijklmnopqrstuvwxyzabcdef'

function makeRouter() {
  const load = vi.fn(() => ({ kind: 'none' as const }))
  const open = vi.fn(() => ({ opened: true }))
  const commit = vi.fn(() => ({ accepted: true as const, view: { kind: 'none' as const } }))
  const router = new CommandRouter(OWN_ID, {
    'gate.load': load,
    'gate.open': open,
    'gate.commit': commit,
  } as Partial<CommandHandlers> as CommandHandlers)
  return { router, load, open, commit }
}

describe('gate command routing', () => {
  it('the_gate_page_in_a_tab_may_load_its_view', async () => {
    const { router, load } = makeRouter()

    const result = await router.route(commandMessage('gate.load', { handoff: null }), {
      id: OWN_ID,
      url: GATE_PAGE,
      tab: { id: 7, url: GATE_PAGE },
      frameId: 0,
    })

    expect(result.ok).toBe(true)
    expect(load).toHaveBeenCalledOnce()
  })

  it('the_gate_page_under_its_dynamic_id_is_the_gate_page_too', async () => {
    const { router } = makeRouter()
    const dynamic = 'chrome-extension://d59d8524-2272-4340-a31d-4b3dee89d93c/gate.html'

    const result = await router.route(commandMessage('gate.load', { handoff: null }), {
      id: OWN_ID,
      url: dynamic,
      tab: { id: 7, url: dynamic },
      frameId: 0,
    })

    expect(result.ok).toBe(true)
  })

  it.each([
    ['a content script', 'https://www.reddit.com/', { id: 7, url: 'https://www.reddit.com/' }],
    ['the popup', `chrome-extension://${OWN_ID}/popup.html`, undefined],
    ['a gate page outside a tab', GATE_PAGE, undefined],
  ])('gate_commands_from_%s_are_rejected', async (_who, url, tab) => {
    const { router, load } = makeRouter()

    const result = await router.route(commandMessage('gate.load', { handoff: null }), {
      id: OWN_ID,
      url,
      tab,
    })

    expect(result).toEqual({ ok: false, error: 'sender.rejected' })
    expect(load).not.toHaveBeenCalled()
  })

  it('gate_commands_from_a_gate_page_inside_a_frame_are_rejected', async () => {
    const { router, load } = makeRouter()

    const result = await router.route(commandMessage('gate.load', { handoff: null }), {
      id: OWN_ID,
      url: GATE_PAGE,
      tab: { id: 7, url: 'https://www.reddit.com/' },
      frameId: 3,
    })

    expect(result).toEqual({ ok: false, error: 'sender.rejected' })
    expect(load).not.toHaveBeenCalled()
  })

  it('gate_open_only_names_the_sending_tabs_own_site', async () => {
    const { router, open } = makeRouter()

    const result = await router.route(commandMessage('gate.open', { url: 'https://x.com/home' }), {
      id: OWN_ID,
      tab: { id: 7, url: 'https://www.reddit.com/' },
      frameId: 0,
    })

    expect(result).toEqual({ ok: false, error: 'sender.rejected' })
    expect(open).not.toHaveBeenCalled()
  })

  it.each([
    { minutes: 7, intention: 'reply to one message' },
    { minutes: 5, intention: 'x'.repeat(281) },
    { minutes: 5, intention: 'ok', extra: true },
  ])('a_malformed_commit_%j_is_rejected', async (payload) => {
    const { router, commit } = makeRouter()

    const result = await router.route(
      { v: 1, type: 'gate.commit', payload },
      { id: OWN_ID, url: GATE_PAGE, tab: { id: 7 }, frameId: 0 }
    )

    expect(result).toEqual({ ok: false, error: 'message.malformed' })
    expect(commit).not.toHaveBeenCalled()
  })

  it('a_hand_off_needs_a_ticket_and_an_http_destination', async () => {
    const { router, load } = makeRouter()

    const result = await router.route(
      commandMessage('gate.load', { handoff: { ticket: TICKET, to: 'javascript:alert(1)' } }),
      { id: OWN_ID, url: GATE_PAGE, tab: { id: 7 }, frameId: 0 }
    )

    expect(result).toEqual({ ok: false, error: 'message.malformed' })
    expect(load).not.toHaveBeenCalled()
  })
})

describe('parseHandoff', () => {
  it('reads_the_ticket_and_the_verbatim_destination_of_the_redirect', () => {
    expect(parseHandoff(`?t=${TICKET}&to=https://www.reddit.com/r/a/?x=1&y=2`)).toEqual({
      ticket: TICKET,
      to: 'https://www.reddit.com/r/a/?x=1&y=2',
    })
  })

  it.each([
    '',
    '?to=https://evil.example/',
    `?t=${TICKET}&to=javascript:alert(1)`,
    '?t=short&to=https://a.example/',
  ])('anything_else_%j_is_no_hand_off', (search) => {
    expect(parseHandoff(search)).toBeNull()
  })
})
