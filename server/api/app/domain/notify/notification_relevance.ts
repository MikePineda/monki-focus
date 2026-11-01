// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NotificationPayload } from '#domain/notify/notification_payload'

/**
 * Whether an outbox row is still worth publishing when its turn comes.
 * Everything about a link stops once the link no longer grants
 * guardianship, except the two notices written for that moment
 * (`pairing_ended`, and `topic_rotated` on the old topic); an unlock
 * request stops once the request is closed (decided, cancelled, expired).
 * The dispatcher gives up on anything else instead of publishing it.
 */
export function isStillRelevant(
  payload: NotificationPayload,
  state: {
    /** The link exists and is active or revoking at send time. */
    readonly linkGrantsGuardianship: boolean
    /** For `unlock_request`: the request is still pending and unexpired. */
    readonly requestOpen: boolean
  }
): boolean {
  if (
    payload.type === 'guardian_notice' &&
    (payload.kind === 'pairing_ended' || payload.kind === 'topic_rotated')
  ) {
    return true
  }
  if (!state.linkGrantsGuardianship) return false
  if (payload.type === 'unlock_request') return state.requestOpen
  return true
}
