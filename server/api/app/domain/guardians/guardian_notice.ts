// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Notices a guardian gets about their link, queued in the notification
 * outbox for the ntfy notifier (S6) to publish on the link's topic in the
 * guardian's language. Neutral by design: the payload is a reason code,
 * the link id and at most a deadline; never a name, a reason in words or
 * anything about the ward's activity.
 *
 * - `revocation_requested`: the ward asked to leave; ends at `effectiveAt`.
 * - `revocation_cancelled`: the ward withdrew it.
 * - `pairing_ended`: the link is over ("pairing ended", nothing more).
 * - `topic_rotated`: the ward rotated the topic; the last message ever
 *   published on the old one, telling the guardian to open the dashboard
 *   and subscribe again.
 */
export const GUARDIAN_NOTICE_KINDS = [
  'revocation_requested',
  'revocation_cancelled',
  'pairing_ended',
  'topic_rotated',
] as const

export type GuardianNoticeKind = (typeof GUARDIAN_NOTICE_KINDS)[number]

export interface GuardianNotice {
  readonly kind: GuardianNoticeKind
  readonly linkId: number
  readonly effectiveAt?: Date
}

export interface GuardianNoticePayload {
  readonly type: 'guardian_notice'
  readonly kind: GuardianNoticeKind
  readonly linkId: number
  readonly effectiveAt?: string
}

export function guardianNoticePayload(notice: GuardianNotice): GuardianNoticePayload {
  return {
    type: 'guardian_notice',
    kind: notice.kind,
    linkId: notice.linkId,
    ...(notice.effectiveAt ? { effectiveAt: notice.effectiveAt.toISOString() } : {}),
  }
}

/** One notice per link, kind and instant: a retried request or job never queues it twice. */
export function guardianNoticeDedupeKey(
  linkId: number,
  kind: GuardianNoticeKind,
  at: Date
): string {
  return `guardian_link:${linkId}:${kind}:${at.getTime()}`
}
