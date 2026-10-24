// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '@monki-focus/rules/pure'

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

/** The longest page URL a content script may ask about (longer: malformed). */
export const MAX_COMMAND_URL_LENGTH = 4096

/**
 * What the feed guard needs for one page: the engine's decision plus the
 * surfaces to hide, all derived from `normalizeUrl(...).surface` and
 * `decide(...).content` (the extension never decides which paths are feeds).
 */
export interface FeedDecision {
  /** The page's surface as the engine normalises the URL, or null. */
  surface: string | null
  decision: Decision
  /** Surfaces whose page content is hidden (`data-mf-hide`). */
  hide: string[]
  /**
   * Feed surfaces of the same site that the rule set restricts (hidden or
   * blocked): their entry points (nav links, Shorts shelves) are hidden on
   * every page of the site (`data-mf-restrict`).
   */
  restrict: string[]
}

export interface CommandMap {
  /** Liveness probe; answers the service worker's wall-clock time. */
  'system.ping': { request: Record<string, never>; response: { at: number } }
  /** Feed decision for the page a content script runs in. */
  'decision.get': { request: { url: string }; response: FeedDecision }
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

function hasOnlyKeys(value: object, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isHttpUrl(text: unknown): text is string {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_COMMAND_URL_LENGTH) {
    return false
  }
  try {
    const { protocol } = new URL(text)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/** Per-command payload validation; a payload that fails is `message.malformed`. */
export const COMMAND_PAYLOAD_GUARDS: {
  [T in CommandType]: (payload: object) => payload is CommandRequest<T>
} = {
  'system.ping': (payload): payload is Record<string, never> => hasOnlyKeys(payload, []),
  'decision.get': (payload): payload is { url: string } =>
    hasOnlyKeys(payload, ['url']) && isHttpUrl((payload as { url?: unknown }).url),
}

/**
 * Commands sent by content scripts about the page they run in: the router
 * only answers them when the sending tab's URL has the same host as the URL
 * the payload asks about, so a frame cannot ask about another site.
 */
export const TAB_URL_COMMANDS: { [T in CommandType]?: (payload: CommandRequest<T>) => string } = {
  'decision.get': (payload) => payload.url,
}
