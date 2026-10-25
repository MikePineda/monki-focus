// SPDX-License-Identifier: AGPL-3.0-or-later
import { TOKEN_PURPOSES } from '@monki-focus/protocol'

/** The protocol's hard cap on `exp - iat` of an unlock token: 4 hours. */
export const UNLOCK_TOKEN_PROTOCOL_CAP_SECONDS = TOKEN_PURPOSES.unlock.maxLifetimeSeconds

/** `UNLOCK_TOKEN_MAX_MINUTES` when it is empty. */
export const DEFAULT_UNLOCK_TOKEN_MAX_MINUTES = 120

/**
 * The longest `exp - iat` this instance signs:
 * `min(UNLOCK_TOKEN_MAX_MINUTES, 240)` minutes, whatever the setting says
 * (a value outside 1-240 never widens the protocol cap).
 */
export function unlockLifetimeCapSeconds(configuredMinutes?: number): number {
  const minutes =
    configuredMinutes !== undefined && Number.isInteger(configuredMinutes) && configuredMinutes >= 1
      ? configuredMinutes
      : DEFAULT_UNLOCK_TOKEN_MAX_MINUTES
  return Math.min(minutes * 60, UNLOCK_TOKEN_PROTOCOL_CAP_SECONDS)
}
