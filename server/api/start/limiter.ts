// SPDX-License-Identifier: AGPL-3.0-or-later
/*
|--------------------------------------------------------------------------
| HTTP throttles
|--------------------------------------------------------------------------
|
| Route-level throttles, stored in `rate_limits` (LIMITER_STORE=database).
| Keys always use `clientIp(ctx)` (CLIENT_IP_HEADER only from the
| CLIENT_IP_HEADER_FROM ranges), never a client-supplied X-Forwarded-For,
| and bucket IPv6 by /64. Login, enrolment, pairing, unlock
| requests and action URLs get their own stricter throttles with their
| routes (S2-S6).
|
*/

import limiter from '@adonisjs/limiter/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import { clientIp } from '#http/client_ip'
import { rateLimitBucket } from '#http/rate_limit_bucket'

/** The limiter key of a guest request: one bucket per client IPv4 (or IPv6 /64) and purpose. */
export function ipKey(purpose: string, ctx: HttpContext) {
  return `${purpose}:ip_${rateLimitBucket(clientIp(ctx))}`
}

/** 300 requests per minute per client IP on the public API. */
export const apiThrottle = limiter.define('api', (ctx) => {
  return limiter.allowRequests(300).every('1 minute').usingKey(ipKey('api', ctx))
})
