// SPDX-License-Identifier: AGPL-3.0-or-later
import { vi } from 'vitest'
import type { CommandHandler, CommandHandlers } from '../../src/background/commands/CommandRouter'
import { CommandError, type CommandClient } from '../../src/shared/CommandClient'
import type { CommandType } from '../../src/shared/messages'

const PAGE_SENDER = { id: 'own', url: 'chrome-extension://own/options.html' }

/**
 * A page-side client answered by service worker handlers in the same
 * process (`Http::fake` with the real controller): a missing handler fails
 * like an unknown command. `sent` records every call.
 */
export function handlerClient(handlers: Partial<CommandHandlers>) {
  const sent = vi.fn()
  const client: CommandClient = {
    async send(type, payload) {
      sent(type, payload)
      const handler = handlers[type] as CommandHandler<CommandType> | undefined
      if (!handler) throw new CommandError('command.unknown')
      try {
        return (await handler(payload, PAGE_SENDER)) as never
      } catch {
        throw new CommandError('command.failed')
      }
    },
  }
  return { client, sent }
}

/** A permissions API that grants what it is asked for, with spies. */
export function fakePermissions(granted: readonly string[] = []) {
  const origins = new Set(granted)
  return {
    contains: vi.fn(async ({ origins: asked }: { origins: string[] }) =>
      asked.every((origin) => origins.has(origin))
    ),
    request: vi.fn(async ({ origins: asked }: { origins: string[] }) => {
      for (const origin of asked) origins.add(origin)
      return true
    }),
  }
}
