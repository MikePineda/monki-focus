// SPDX-License-Identifier: AGPL-3.0-or-later
import limiter from '@adonisjs/limiter/services/main'
import { rateLimitBucket } from '#http/rate_limit_bucket'
import type { FailureRule } from '#services/accounts/failure_throttle'
import { oneWayDigest } from '#domain/accounts/one_way_digest'

/**
 * The throttles of the account routes. Every IP key goes through
 * `rateLimitBucket` (IPv6 by /64) of `clientIp(ctx)`; emails only appear
 * digested, so `rate_limits` never holds one in clear.
 */

function ipPart(ip: string) {
  return `ip_${rateLimitBucket(ip)}`
}

/** A short, stable digest of a normalised email for limiter keys. */
function emailPart(email: string) {
  return `email_${oneWayDigest(email.trim().toLowerCase()).slice(0, 24)}`
}

/** Password guesses: 5 per minute per email and IP (then 20 min), 30 per 15 min per IP. */
export function loginRules(ip: string, email: string): FailureRule[] {
  return [
    {
      key: `login:${ipPart(ip)}:${emailPart(email)}`,
      failures: 5,
      duration: '1 minute',
      blockDuration: '20 mins',
      resetOnSuccess: true,
    },
    {
      key: `login:${ipPart(ip)}`,
      failures: 30,
      duration: '15 mins',
      blockDuration: '15 mins',
      resetOnSuccess: false,
    },
  ]
}

/** Second-factor codes at login and in the settings: 5 per minute per user, 30 per 15 min per IP. */
export function twoFactorRules(userId: number, ip: string): FailureRule[] {
  return [
    {
      key: `two_factor:user_${userId}`,
      failures: 5,
      duration: '1 minute',
      blockDuration: '20 mins',
      resetOnSuccess: true,
    },
    {
      key: `two_factor:${ipPart(ip)}`,
      failures: 30,
      duration: '15 mins',
      blockDuration: '15 mins',
      resetOnSuccess: false,
    },
  ]
}

/**
 * Password re-checks of a signed-in user (sensitive actions): 5 per minute
 * per user, so a stolen session cannot brute-force the password.
 */
export function reauthRules(userId: number): FailureRule[] {
  return [
    {
      key: `reauth:user_${userId}`,
      failures: 5,
      duration: '1 minute',
      blockDuration: '20 mins',
      resetOnSuccess: true,
    },
  ]
}

/** Rejected registrations (bad or used invitation links): 10 per hour per IP. */
export function registrationRules(ip: string): FailureRule[] {
  return [
    {
      key: `register:${ipPart(ip)}`,
      failures: 10,
      duration: '1 hour',
      blockDuration: '1 hour',
      resetOnSuccess: false,
    },
  ]
}

/** Invitations an admin may create: 20 per hour. Consumed on every creation. */
export async function consumeInvitationCreation(userId: number) {
  await limiter.use({ requests: 20, duration: '1 hour' }).consume(`invitations:user_${userId}`)
}
