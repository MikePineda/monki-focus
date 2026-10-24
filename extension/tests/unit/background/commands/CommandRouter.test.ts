// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest'
import { CommandRouter } from '../../../../src/background/commands/CommandRouter'
import { ENGINE_ERROR_DECISION } from '@monki-focus/engine'
import { commandMessage, type FeedDecision } from '../../../../src/shared/messages'

const OWN_ID = 'own-extension-id'
const REDDIT_HOME = 'https://www.reddit.com/'

const FEED_DECISION: FeedDecision = {
  surface: 'reddit.feed',
  decision: { ...ENGINE_ERROR_DECISION },
  hide: ['reddit.feed'],
  restrict: ['reddit.feed'],
}

function makeRouter() {
  const ping = vi.fn(() => ({ at: 42 }))
  const decide = vi.fn(() => FEED_DECISION)
  return {
    router: new CommandRouter(OWN_ID, { 'system.ping': ping, 'decision.get': decide }),
    ping,
    decide,
  }
}

describe('CommandRouter', () => {
  it('known_command_from_own_extension_is_dispatched', async () => {
    const { router, ping } = makeRouter()

    const result = await router.route(commandMessage('system.ping', {}), { id: OWN_ID })

    expect(result).toEqual({ ok: true, data: { at: 42 } })
    expect(ping).toHaveBeenCalledOnce()
  })

  it('content_message_from_foreign_sender_is_rejected', async () => {
    const { router, ping } = makeRouter()

    const result = await router.route(commandMessage('system.ping', {}), {
      id: 'another-extension-id',
    })

    expect(result).toEqual({ ok: false, error: 'sender.rejected' })
    expect(ping).not.toHaveBeenCalled()
  })

  it('message_without_sender_id_is_rejected', async () => {
    const { router } = makeRouter()

    expect(await router.route(commandMessage('system.ping', {}), {})).toEqual({
      ok: false,
      error: 'sender.rejected',
    })
  })

  it.each([
    null,
    'system.ping',
    { type: 'system.ping' },
    { v: 2, type: 'system.ping', payload: {} },
  ])('malformed_message_%j_is_rejected', async (message) => {
    const { router, ping } = makeRouter()

    expect(await router.route(message, { id: OWN_ID })).toEqual({
      ok: false,
      error: 'message.malformed',
    })
    expect(ping).not.toHaveBeenCalled()
  })

  it('unknown_command_is_rejected', async () => {
    const { router } = makeRouter()

    expect(await router.route({ v: 1, type: 'admin.wipe', payload: {} }, { id: OWN_ID })).toEqual({
      ok: false,
      error: 'command.unknown',
    })
  })

  it('handler_failure_is_reported_without_its_details', async () => {
    const router = new CommandRouter(OWN_ID, {
      'system.ping': () => {
        throw new Error('internal detail')
      },
      'decision.get': () => FEED_DECISION,
    })

    expect(await router.route(commandMessage('system.ping', {}), { id: OWN_ID })).toEqual({
      ok: false,
      error: 'command.failed',
    })
  })

  it('decision_from_a_content_script_on_the_same_host_is_answered', async () => {
    const { router, decide } = makeRouter()

    const result = await router.route(commandMessage('decision.get', { url: REDDIT_HOME }), {
      id: OWN_ID,
      tab: { url: 'https://www.reddit.com/r/examplesub/' },
    })

    expect(result).toEqual({ ok: true, data: FEED_DECISION })
    expect(decide).toHaveBeenCalledWith({ url: REDDIT_HOME }, expect.anything())
  })

  it('decision_about_another_host_than_the_sending_tab_is_rejected', async () => {
    const { router, decide } = makeRouter()

    const result = await router.route(commandMessage('decision.get', { url: REDDIT_HOME }), {
      id: OWN_ID,
      tab: { url: 'https://www.youtube.com/' },
    })

    expect(result).toEqual({ ok: false, error: 'sender.rejected' })
    expect(decide).not.toHaveBeenCalled()
  })

  it('decision_without_a_sending_tab_is_rejected', async () => {
    const { router, decide } = makeRouter()

    const result = await router.route(commandMessage('decision.get', { url: REDDIT_HOME }), {
      id: OWN_ID,
    })

    expect(result).toEqual({ ok: false, error: 'sender.rejected' })
    expect(decide).not.toHaveBeenCalled()
  })

  it.each([
    {},
    { url: 42 },
    { url: 'not a url' },
    { url: 'javascript:alert(1)' },
    { url: `https://www.reddit.com/${'a'.repeat(5000)}` },
    { url: REDDIT_HOME, extra: true },
  ])('decision_payload_%j_is_malformed', async (payload) => {
    const { router, decide } = makeRouter()

    const result = await router.route(
      { v: 1, type: 'decision.get', payload },
      { id: OWN_ID, tab: { url: REDDIT_HOME } }
    )

    expect(result).toEqual({ ok: false, error: 'message.malformed' })
    expect(decide).not.toHaveBeenCalled()
  })

  it('ping_with_unexpected_payload_fields_is_malformed', async () => {
    const { router, ping } = makeRouter()

    const result = await router.route(
      { v: 1, type: 'system.ping', payload: { wipe: true } },
      { id: OWN_ID }
    )

    expect(result).toEqual({ ok: false, error: 'message.malformed' })
    expect(ping).not.toHaveBeenCalled()
  })
})
