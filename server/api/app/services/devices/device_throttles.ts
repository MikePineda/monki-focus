// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import limiter from '@adonisjs/limiter/services/main'
import { rateLimitBucket } from '#http/rate_limit_bucket'
import type { FailureRule } from '#services/accounts/failure_throttle'

/**
 * The throttles of the device routes, on top of the per-IP `api` throttle
 * of /api/v1. Store: LIMITER_STORE (Postgres in production), read per call.
 *
 * - Enrolment guesses: reserved before the code is looked at
 *   (`throttleFailures`), 10 failures per 15 minutes per IP (IPv6 by /64).
 *   Each code also dies at its fifth wrong guess, whatever the IP
 *   (app/domain/devices/enrollment_code.ts).
 * - Per device (a stolen token cannot flood storage): heartbeats 60 per
 *   hour (the clients send one every 15 minutes and on wake), bypass
 *   batches 120 per hour, token rotations 10 per hour.
 * - Per user: enrolment codes 10 per hour.
 */

export function enrollmentRules(ip: string): FailureRule[] {
  return [
    {
      key: `enroll:ip_${rateLimitBucket(ip)}`,
      failures: 10,
      duration: '15 mins',
      blockDuration: '15 mins',
      resetOnSuccess: false,
    },
  ]
}

function consume(key: string, requests: number, duration: string) {
  return limiter.use(env.get('LIMITER_STORE'), { requests, duration }).consume(key)
}

export function consumeEnrollmentCodeCreation(userId: number) {
  return consume(`enrollment_codes:user_${userId}`, 10, '1 hour')
}

export function consumeHeartbeat(deviceId: number) {
  return consume(`heartbeat:device_${deviceId}`, 60, '1 hour')
}

export function consumeBypassBatch(deviceId: number) {
  return consume(`bypass_events:device_${deviceId}`, 120, '1 hour')
}

export function consumeTokenRotation(deviceId: number) {
  return consume(`token_rotation:device_${deviceId}`, 10, '1 hour')
}
