// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import limiter from '@adonisjs/limiter/services/main'
import { rateLimitBucket } from '#http/rate_limit_bucket'

/**
 * Throttles of the unlock flow, on top of the per-IP `api` throttle:
 *
 * - 6 unlock requests per hour per device (a stolen token cannot flood
 *   the guardian's phone).
 * - 30 action POSTs per minute per IP (IPv6 by /64): capability guesses
 *   are hopeless at 256 bits, this only keeps the endpoint cheap.
 */
function consume(key: string, requests: number, duration: string) {
  return limiter.use(env.get('LIMITER_STORE'), { requests, duration }).consume(key)
}

export const UNLOCK_REQUESTS_PER_HOUR = 6

export function consumeUnlockRequest(deviceId: number) {
  return consume(`unlock_requests:device_${deviceId}`, UNLOCK_REQUESTS_PER_HOUR, '1 hour')
}

export function consumeUnlockAction(ip: string) {
  return consume(`unlock_actions:ip_${rateLimitBucket(ip)}`, 30, '1 min')
}
