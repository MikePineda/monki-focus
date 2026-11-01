// SPDX-License-Identifier: AGPL-3.0-or-later
import { refuse, succeed, type Outcome } from '#domain/outcome'

/**
 * The life of an unlock request (`unlock_requests.status`):
 *
 * - `pending`: waiting for the guardian until `expiresAt`.
 * - `approved` / `denied`: the guardian decided, once (from the ntfy
 *   action or the dashboard). A second decision is refused, whichever
 *   channel it comes from.
 * - `expired`: nobody decided in time. A pending row past its deadline
 *   already reads as expired here, so a late decision is refused even
 *   before the expiry job stores the state.
 * - `cancelled`: the device withdrew it while pending.
 */
export const UNLOCK_REQUEST_STATUSES = [
  'pending',
  'approved',
  'denied',
  'expired',
  'cancelled',
] as const

export type UnlockRequestStatus = (typeof UNLOCK_REQUEST_STATUSES)[number]
export type UnlockDecision = 'approve' | 'deny'
export const DECISION_CHANNELS = ['notification', 'web'] as const
export type DecisionChannel = (typeof DECISION_CHANNELS)[number]

export interface UnlockRequestTimeline {
  readonly status: UnlockRequestStatus
  readonly expiresAt: Date
}

export type DecisionRefusal = 'already_decided' | 'expired'

export function effectiveStatus(request: UnlockRequestTimeline, now: Date): UnlockRequestStatus {
  if (request.status === 'pending' && request.expiresAt.getTime() <= now.getTime()) {
    return 'expired'
  }
  return request.status
}

/** The state a decision leads to, or why it is refused. */
export function decideRequest(
  request: UnlockRequestTimeline,
  decision: UnlockDecision,
  now: Date
): Outcome<'approved' | 'denied', DecisionRefusal> {
  if (request.status !== 'pending') return refuse('already_decided')
  if (effectiveStatus(request, now) === 'expired') return refuse('expired')
  return succeed(decision === 'approve' ? 'approved' : 'denied')
}

/** A device withdraws its own request; only while it is still pending. */
export function cancelRequest(
  request: UnlockRequestTimeline,
  now: Date
): Outcome<'cancelled', 'already_closed'> {
  return effectiveStatus(request, now) === 'pending'
    ? succeed('cancelled')
    : refuse('already_closed')
}
