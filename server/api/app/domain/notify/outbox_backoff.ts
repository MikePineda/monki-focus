// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Retries of an outbox row that failed to publish: 10 s, 30 s, then 2 min
 * after the first, second and third failure; the fourth failure gives up
 * (the row keeps its `last_error` and is never tried again).
 */
export const OUTBOX_RETRY_DELAYS_SECONDS = [10, 30, 120] as const

/** `last_error` column width. */
export const OUTBOX_ERROR_MAX_LENGTH = 500

/** When to try again after the `failures`-th failure (1-based), or null to give up. */
export function nextAttemptAfterFailure(failures: number, now: Date): Date | null {
  const delay = OUTBOX_RETRY_DELAYS_SECONDS[failures - 1]
  if (delay === undefined) return null
  return new Date(now.getTime() + delay * 1000)
}

/**
 * The stored error: a short reason the publisher produced (status code,
 * error class), cut to the column. The publisher never puts a topic, a
 * URL, a token or a response body in it.
 */
export function outboxErrorSummary(reason: string): string {
  const oneLine = reason.replace(/\s+/g, ' ').trim()
  return (oneLine || 'unknown').slice(0, OUTBOX_ERROR_MAX_LENGTH)
}
