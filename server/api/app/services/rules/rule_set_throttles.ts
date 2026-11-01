// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import limiter from '@adonisjs/limiter/services/main'

/**
 * The rule set routes' throttles, on top of the per-IP `api` throttle of
 * /api/v1 (a stolen token or session cannot flood storage with 256 KiB
 * documents): reads 120 per hour and writes 60 per hour, per device on the
 * device routes and per user on the dashboard routes. Store: LIMITER_STORE.
 */
function consume(key: string, requests: number) {
  return limiter.use(env.get('LIMITER_STORE'), { requests, duration: '1 hour' }).consume(key)
}

export function consumeRuleSetRead(owner: { device: number } | { user: number }) {
  return consume(`rule_set_read:${keyOf(owner)}`, 120)
}

export function consumeRuleSetWrite(owner: { device: number } | { user: number }) {
  return consume(`rule_set_write:${keyOf(owner)}`, 60)
}

function keyOf(owner: { device: number } | { user: number }): string {
  return 'device' in owner ? `device_${owner.device}` : `user_${owner.user}`
}
