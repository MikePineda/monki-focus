// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  COMMAND_PAYLOAD_GUARDS,
  isCommandEnvelope,
  TAB_URL_COMMANDS,
  type CommandRequest,
  type CommandResponse,
  type CommandResult,
  type CommandType,
} from '../../shared/messages'

/** The part of `runtime.MessageSender` the router relies on. */
export interface CommandSender {
  id?: string | undefined
  url?: string | undefined
  /** Present when the message comes from a tab (a content script). */
  tab?: { id?: number | undefined; url?: string | undefined } | undefined
  /** 0 for the tab's top frame. */
  frameId?: number | undefined
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

function hostOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

/**
 * A tab-scoped command must come from a tab whose URL has the same host as
 * the URL it asks about (04 §4: messages validate the tab URL).
 */
function isTabUrlAllowed(type: CommandType, payload: unknown, sender: CommandSender): boolean {
  const urlOf = TAB_URL_COMMANDS[type] as ((payload: unknown) => string) | undefined
  if (!urlOf) return true
  const tabHost = hostOf(sender.tab?.url)
  return tabHost !== null && tabHost === hostOf(urlOf(payload))
}

/**
 * Single entry point for commands sent to the service worker. It answers only
 * messages from this extension's own contexts (`sender.id === runtime.id`;
 * there is no `externally_connectable`), drops malformed envelopes, unknown
 * commands and payloads that fail their guard, checks the sending tab of
 * content-script commands, and never leaks handler errors to the caller.
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
    const type = message.type as CommandType
    const payload = message.payload as object
    if (!COMMAND_PAYLOAD_GUARDS[type](payload)) {
      return { ok: false, error: 'message.malformed' }
    }
    if (!isTabUrlAllowed(type, payload, sender)) {
      return { ok: false, error: 'sender.rejected' }
    }
    const handler = this.handlers[type] as CommandHandler<CommandType>
    try {
      const data = await handler(payload as CommandRequest<CommandType>, sender)
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
