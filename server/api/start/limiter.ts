// SPDX-License-Identifier: AGPL-3.0-or-later
/*
|--------------------------------------------------------------------------
| HTTP throttles
|--------------------------------------------------------------------------
|
| Route-level throttles, stored in `rate_limits` (LIMITER_STORE=database).
| Keys always use `clientIp(ctx)` (CLIENT_IP_HEADER behind a trusted proxy),
| never a client-supplied X-Forwarded-For. Login, enrolment, pairing, unlock
| requests and action URLs get their own stricter throttles with their
| routes (S2-S6).
|
*/

import limiter from '@adonisjs/limiter/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import { clientIp } from '#http/client_ip'

/** The limiter key of a guest request: one bucket per client IP and purpose. */
export function ipKey(purpose: string, ctx: HttpContext) {
  return `${purpose}:ip_${clientIp(ctx)}`
}

/** 300 requests per minute per client IP on the public API. */
export const apiThrottle = limiter.define('api', (ctx) => {
  return limiter.allowRequests(300).every('1 minute').usingKey(ipKey('api', ctx))
})
