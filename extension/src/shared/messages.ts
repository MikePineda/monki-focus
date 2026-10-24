// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Typed command contract between the extension contexts (popup, options,
 * gate, content scripts) and the service worker, which is the only writer of
 * state. Every command is `{ v, type, payload }`; the answer is a
 * `CommandResult` that carries a reason code, never user-facing text.
 *
 * Later work packages add `intention.start`, `intention.extend`,
 * `gate.dismiss`, `override.request`, ...
 */
export const MESSAGE_VERSION = 1

export interface CommandMap {
  /** Liveness probe; answers the service worker's wall-clock time. */
  'system.ping': { request: Record<string, never>; response: { at: number } }
}

export type CommandType = keyof CommandMap
export type CommandRequest<T extends CommandType> = CommandMap[T]['request']
export type CommandResponse<T extends CommandType> = CommandMap[T]['response']

export interface CommandMessage<T extends CommandType = CommandType> {
  v: typeof MESSAGE_VERSION
  type: T
  payload: CommandRequest<T>
}

export type CommandErrorCode =
  'sender.rejected' | 'message.malformed' | 'command.unknown' | 'command.failed'

export type CommandResult<T extends CommandType = CommandType> =
  { ok: true; data: CommandResponse<T> } | { ok: false; error: CommandErrorCode }

export function commandMessage<T extends CommandType>(
  type: T,
  payload: CommandRequest<T>
): CommandMessage<T> {
  return { v: MESSAGE_VERSION, type, payload }
}

/** Structural check of the envelope only; payloads are validated per command. */
export function isCommandEnvelope(
  value: unknown
): value is { v: typeof MESSAGE_VERSION; type: string; payload: unknown } {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    candidate.v === MESSAGE_VERSION &&
    typeof candidate.type === 'string' &&
    typeof candidate.payload === 'object' &&
    candidate.payload !== null
  )
}
