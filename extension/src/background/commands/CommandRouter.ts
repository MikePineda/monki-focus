// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  isCommandEnvelope,
  type CommandRequest,
  type CommandResponse,
  type CommandResult,
  type CommandType,
} from '../../shared/messages'

/** The part of `runtime.MessageSender` the router relies on. */
export interface CommandSender {
  id?: string | undefined
  url?: string | undefined
}

export type CommandHandler<T extends CommandType> = (
  payload: CommandRequest<T>,
  sender: CommandSender
) => CommandResponse<T> | Promise<CommandResponse<T>>

export type CommandHandlers = { [T in CommandType]: CommandHandler<T> }

/** The part of `runtime.onMessage` the router listens on. */
export interface MessageEvent {
  addListener(
    listener: (
      message: unknown,
      sender: CommandSender,
      sendResponse: (response: CommandResult) => void
    ) => boolean | undefined
  ): void
}

/**
 * Single entry point for commands sent to the service worker. It answers only
 * messages from this extension's own contexts (`sender.id === runtime.id`;
 * there is no `externally_connectable`), drops malformed envelopes and
 * unknown commands, and never leaks handler errors to the caller.
 */
export class CommandRouter {
  constructor(
    private readonly runtimeId: string,
    private readonly handlers: CommandHandlers
  ) {}

  async route(message: unknown, sender: CommandSender): Promise<CommandResult> {
    if (!sender.id || sender.id !== this.runtimeId) {
      return { ok: false, error: 'sender.rejected' }
    }
    if (!isCommandEnvelope(message)) {
      return { ok: false, error: 'message.malformed' }
    }
    if (!Object.hasOwn(this.handlers, message.type)) {
      return { ok: false, error: 'command.unknown' }
    }
    const handler = this.handlers[message.type as CommandType] as CommandHandler<CommandType>
    try {
      const data = await handler(message.payload as CommandRequest<CommandType>, sender)
      return { ok: true, data }
    } catch {
      return { ok: false, error: 'command.failed' }
    }
  }

  /**
   * Registers the router on `runtime.onMessage`. Uses `sendResponse` and
   * `return true` (keep the channel open) rather than returning a promise,
   * which works on every Chromium the extension supports.
   */
  listen(onMessage: MessageEvent): void {
    onMessage.addListener((message, sender, sendResponse) => {
      void this.route(message, sender).then(sendResponse)
      return true
    })
  }
}
