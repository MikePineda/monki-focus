// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DateTime } from 'luxon'
import type User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

/** Session key of a login waiting for its second factor. */
export const TWO_FACTOR_CHALLENGE_KEY = 'two_factor_challenge'

/** How long the password step stays good for the code step. */
export const TWO_FACTOR_CHALLENGE_MINUTES = 5

interface StoredChallenge {
  userId: number
  /** session_version at the password step: a revocation in between voids it. */
  sv: number
  expiresAt: number
}

type SessionHolder = Pick<HttpContext, 'session'>

/**
 * The state between the two login steps, held in the (encrypted) session
 * cookie: which user passed the password check, until when. It never logs
 * anybody in by itself.
 */
export function openChallenge(ctx: SessionHolder, user: User, now: DateTime) {
  const challenge: StoredChallenge = {
    userId: user.id,
    sv: user.sessionVersion,
    expiresAt: now.plus({ minutes: TWO_FACTOR_CHALLENGE_MINUTES }).toMillis(),
  }
  ctx.session.put(TWO_FACTOR_CHALLENGE_KEY, challenge)
}

/** The pending challenge, or null when there is none or it expired. */
export function readChallenge(ctx: SessionHolder, now: DateTime): StoredChallenge | null {
  const value = ctx.session.get(TWO_FACTOR_CHALLENGE_KEY) as Partial<StoredChallenge> | undefined
  if (
    typeof value?.userId !== 'number' ||
    typeof value.sv !== 'number' ||
    typeof value.expiresAt !== 'number' ||
    value.expiresAt <= now.toMillis()
  ) {
    return null
  }
  return { userId: value.userId, sv: value.sv, expiresAt: value.expiresAt }
}

export function closeChallenge(ctx: SessionHolder) {
  ctx.session.forget(TWO_FACTOR_CHALLENGE_KEY)
}
