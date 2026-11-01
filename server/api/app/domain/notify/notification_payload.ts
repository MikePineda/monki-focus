// SPDX-License-Identifier: AGPL-3.0-or-later
import type { GuardianNoticePayload } from '#domain/guardians/guardian_notice'

/**
 * What a `notification_outbox` row carries: reason codes, ids and numbers
 * only, never a scope value, a reason the user wrote, a name or anything
 * about the ward's activity. The ntfy message builder turns it into text
 * in the recipient's language.
 *
 * - `unlock_request`: a request waits for the guardian. `sealedActions`
 *   holds the two action tokens encrypted with APP_KEY (15-minute
 *   expiry) while the row is unsent, so a retry can still build the
 *   buttons; it is removed once the row is sent. Never the plain tokens.
 * - `unlock_decided`: the confirmation after a decision.
 * - `bypass_alert`: a device reported a protection event (no kind detail
 *   in the text).
 */
export interface UnlockRequestPayload {
  readonly type: 'unlock_request'
  readonly linkId: number
  readonly requestUuid: string
  readonly minutes: number
  readonly sealedActions?: string | null
}

export interface UnlockDecidedPayload {
  readonly type: 'unlock_decided'
  readonly linkId: number
  readonly requestUuid: string
  readonly decision: 'approved' | 'denied'
  readonly minutes: number
}

export interface BypassAlertPayload {
  readonly type: 'bypass_alert'
  readonly linkId: number
}

export type NotificationPayload =
  GuardianNoticePayload | UnlockRequestPayload | UnlockDecidedPayload | BypassAlertPayload

export function unlockRequestDedupeKey(requestUuid: string): string {
  return `unlock_request:${requestUuid}`
}

export function unlockDecidedDedupeKey(requestUuid: string): string {
  return `unlock_decided:${requestUuid}`
}

export function bypassAlertDedupeKey(eventId: number, linkId: number): string {
  return `bypass_alert:${eventId}:${linkId}`
}
