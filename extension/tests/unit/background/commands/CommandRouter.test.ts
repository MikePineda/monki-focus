// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest'
import { CommandRouter } from '../../../../src/background/commands/CommandRouter'
import { commandMessage } from '../../../../src/shared/messages'

const OWN_ID = 'own-extension-id'

function makeRouter() {
  const ping = vi.fn(() => ({ at: 42 }))
  return { router: new CommandRouter(OWN_ID, { 'system.ping': ping }), ping }
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
    })

    expect(await router.route(commandMessage('system.ping', {}), { id: OWN_ID })).toEqual({
      ok: false,
      error: 'command.failed',
    })
  })
})
