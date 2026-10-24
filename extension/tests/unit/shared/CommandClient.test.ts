// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest'
import { CommandError, createCommandClient } from '../../../src/shared/CommandClient'

describe('CommandClient', () => {
  it('sends_a_typed_envelope_and_answers_the_data', async () => {
    const sendMessage = vi.fn(() => Promise.resolve({ ok: true, data: { at: 7 } }))

    const answer = await createCommandClient(sendMessage).send('system.ping', {})

    expect(answer).toEqual({ at: 7 })
    expect(sendMessage).toHaveBeenCalledWith({ v: 1, type: 'system.ping', payload: {} })
  })

  it('a_refusal_throws_its_reason_code', async () => {
    const refusing = createCommandClient(() =>
      Promise.resolve({ ok: false, error: 'sender.rejected' })
    )
    const silent = createCommandClient(() => Promise.resolve(undefined))

    await expect(refusing.send('rules.state', {})).rejects.toEqual(
      new CommandError('sender.rejected')
    )
    await expect(silent.send('rules.state', {})).rejects.toMatchObject({ code: 'no_answer' })
  })
})
