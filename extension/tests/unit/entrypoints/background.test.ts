// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import background from '../../../src/entrypoints/background'
import { commandMessage, type CommandResult } from '../../../src/shared/messages'

describe('background entrypoint', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('background_registers_command_router_on_start', () => {
    expect(fakeBrowser.runtime.onMessage.hasListeners()).toBe(false)

    background.main()

    expect(fakeBrowser.runtime.onMessage.hasListeners()).toBe(true)
  })

  it('background_answers_a_ping_from_its_own_extension', async () => {
    background.main()

    const response = await new Promise<CommandResult<'system.ping'>>((resolve) => {
      void fakeBrowser.runtime.onMessage.trigger(
        commandMessage('system.ping', {}),
        { id: fakeBrowser.runtime.id },
        resolve
      )
    })

    expect(response.ok).toBe(true)
  })

  it('background_rejects_a_ping_from_a_foreign_sender', async () => {
    background.main()

    const response = await new Promise<CommandResult<'system.ping'>>((resolve) => {
      void fakeBrowser.runtime.onMessage.trigger(
        commandMessage('system.ping', {}),
        { id: 'another-extension-id' },
        resolve
      )
    })

    expect(response).toEqual({ ok: false, error: 'sender.rejected' })
  })
})
