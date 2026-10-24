// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  commandMessage,
  type CommandErrorCode,
  type CommandRequest,
  type CommandResponse,
  type CommandResult,
  type CommandType,
} from './messages'

/** A command the service worker refused or failed; carries the reason code only. */
export class CommandError extends Error {
  constructor(readonly code: CommandErrorCode | 'no_answer') {
    super(code)
    this.name = 'CommandError'
  }
}

/** How a page reaches the service worker (`browser.runtime.sendMessage`). */
export type SendMessage = (message: unknown) => Promise<unknown>

/** Page side of the typed command contract: answers the data or throws `CommandError`. */
export interface CommandClient {
  send<T extends CommandType>(type: T, payload: CommandRequest<T>): Promise<CommandResponse<T>>
}

export function createCommandClient(sendMessage: SendMessage): CommandClient {
  return {
    async send(type, payload) {
      const result = (await sendMessage(commandMessage(type, payload))) as
        CommandResult<typeof type> | undefined
      if (!result || typeof result !== 'object') throw new CommandError('no_answer')
      if (!result.ok) throw new CommandError(result.error)
      return result.data
    },
  }
}
