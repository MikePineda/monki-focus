// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  commandMessage,
  type CommandMessage,
  type CommandResult,
  type FeedDecision,
} from '../shared/messages'

/** The slice of `runtime.sendMessage` the client uses. */
export type SendMessage = (message: CommandMessage<'decision.get'>) => Promise<unknown>

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/** Shape check of the service worker's answer before anything acts on it. */
function isFeedDecision(value: unknown): value is FeedDecision {
  if (typeof value !== 'object' || value === null) return false
  const answer = value as Record<string, unknown>
  return (
    (answer.surface === null || typeof answer.surface === 'string') &&
    typeof answer.decision === 'object' &&
    answer.decision !== null &&
    isStringArray(answer.hide) &&
    isStringArray(answer.restrict) &&
    (answer.validUntil === null || typeof answer.validUntil === 'string')
  )
}

/**
 * Asks the service worker for the feed decision of the page. The URL goes
 * to the extension's own service worker only. Rejects on any failure (no
 * answer, an error result, a malformed answer): the caller keeps the page
 * fail-closed.
 */
export async function requestFeedDecision(
  sendMessage: SendMessage,
  url: string
): Promise<FeedDecision> {
  const result = (await sendMessage(commandMessage('decision.get', { url }))) as
    CommandResult<'decision.get'> | undefined
  if (!result || result.ok !== true || !isFeedDecision(result.data)) {
    throw new Error('decision.unavailable')
  }
  return result.data
}
