// SPDX-License-Identifier: AGPL-3.0-or-later
import { unlockLifetimeCapSeconds } from '#domain/unlock/unlock_lifetime'

/**
 * What a guardian sets on their link: the longest unlock they grant
 * (`maxUnlockMinutes`, 1 to the instance's cap) and whether notifications
 * carry approve/deny buttons (`allowNotificationActions`; off = decide in
 * the signed-in dashboard only).
 */

/** A new link's longest unlock, unless the instance caps lower. */
export const DEFAULT_MAX_UNLOCK_MINUTES = 30
export const MIN_MAX_UNLOCK_MINUTES = 1

/** The instance's cap in minutes: `min(UNLOCK_TOKEN_MAX_MINUTES, 240)`, default 120. */
export function maxUnlockMinutesCap(configuredMinutes: number | undefined): number {
  return Math.floor(unlockLifetimeCapSeconds(configuredMinutes) / 60)
}

export function defaultMaxUnlockMinutes(cap: number): number {
  return Math.min(DEFAULT_MAX_UNLOCK_MINUTES, cap)
}
