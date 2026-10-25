// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import limiter from '@adonisjs/limiter/services/main'
import { rateLimitBucket } from '#http/rate_limit_bucket'
import type { FailureRule } from '#services/accounts/failure_throttle'

/**
 * The throttles of the guardian routes, on top of the per-IP `api`
 * throttle of /api/v1. Store: LIMITER_STORE (Postgres in production).
 *
 * - Pairing-code guesses (redeeming one signed in, or registering with
 *   one): reserved before the code is looked at (`throttleFailures`), 10
 *   failures per hour per IP (IPv6 by /64) and, signed in, 10 per hour per
 *   account. Each code also dies at its fifth wrong guess, whatever the IP
 *   (app/domain/guardians/pairing_code.ts).
 * - Per user: pairing codes 10 per hour, topic rotations 10 per hour.
 */

export function pairingGuessRules(ip: string, userId?: number): FailureRule[] {
  const rules: FailureRule[] = [
    {
      key: `pairing:ip_${rateLimitBucket(ip)}`,
      failures: 10,
      duration: '1 hour',
      blockDuration: '1 hour',
      resetOnSuccess: false,
    },
  ]
  if (userId !== undefined) {
    rules.push({
      key: `pairing:user_${userId}`,
      failures: 10,
      duration: '1 hour',
      blockDuration: '1 hour',
      resetOnSuccess: false,
    })
  }
  return rules
}

function consume(key: string, requests: number, duration: string) {
  return limiter.use(env.get('LIMITER_STORE'), { requests, duration }).consume(key)
}

export function consumePairingCodeCreation(userId: number) {
  return consume(`pairing_codes:user_${userId}`, 10, '1 hour')
}

export function consumeTopicRotation(userId: number) {
  return consume(`topic_rotation:user_${userId}`, 10, '1 hour')
}
