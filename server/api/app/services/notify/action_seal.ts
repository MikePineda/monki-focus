// SPDX-License-Identifier: AGPL-3.0-or-later
import encryption from '@adonisjs/core/services/encryption'
import { ACTION_TOKEN_LIFETIME_SECONDS, isActionToken } from '#domain/unlock/action_token'

const PURPOSE = 'unlock_request_actions'

export interface ActionTokens {
  readonly approve: string
  readonly deny: string
}

/**
 * The two plain action tokens of an unsent unlock-request notification,
 * encrypted with APP_KEY for at most their 15-minute lifetime, so a retry
 * from the outbox can still build the buttons. The database never holds
 * them in clear; the seal is dropped once the row is sent.
 */
export function sealActionTokens(tokens: ActionTokens): string {
  return encryption.encrypt(tokens, `${ACTION_TOKEN_LIFETIME_SECONDS}s`, PURPOSE)
}

/** The tokens, or null when the seal expired, was tampered with or is missing. */
export function unsealActionTokens(sealed: string | null | undefined): ActionTokens | null {
  if (!sealed) return null
  const tokens = encryption.decrypt<ActionTokens>(sealed, PURPOSE)
  if (!tokens || !isActionToken(tokens.approve) || !isActionToken(tokens.deny)) return null
  return tokens
}
