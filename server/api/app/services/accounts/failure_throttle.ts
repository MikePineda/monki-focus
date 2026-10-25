// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import { errors, type Limiter } from '@adonisjs/limiter'
import limiter from '@adonisjs/limiter/services/main'

/** One bucket of a failure throttle. */
export interface FailureRule {
  /** Built from purposes, client IP buckets and user ids: never an email in clear. */
  key: string
  /** Attempts allowed per `duration`... */
  failures: number
  duration: string
  /** ...then the key is blocked this long. */
  blockDuration: string
  /**
   * What a success does to the bucket. True: clears it (per-account
   * buckets: the right password ends the guessing). False: only refunds
   * this attempt (per-IP buckets, or one login to the attacker's own
   * account would reset the IP).
   */
  resetOnSuccess: boolean
}

/**
 * Guards a guessable check (password, code, link). Every bucket is charged
 * **before** the attempt runs, with the store's atomic consume, so a burst
 * of concurrent requests can never evaluate more attempts than the limit:
 * the request that finds a bucket full answers 429 without the check ever
 * running (no hash, no code comparison, nothing learned). A failure keeps
 * its charge; a success clears the `resetOnSuccess` buckets and refunds the
 * others, so only failures count in the end.
 *
 * The store is LIMITER_STORE (Postgres in production), read per call.
 */
export async function throttleFailures<T>(rules: FailureRule[], attempt: () => Promise<T>) {
  const store = env.get('LIMITER_STORE')
  const charged: Array<{ rule: FailureRule; bucket: Limiter }> = []

  try {
    for (const rule of rules) {
      const bucket = limiter.use(store, {
        requests: rule.failures,
        duration: rule.duration,
        blockDuration: rule.blockDuration,
      })
      await bucket.consume(rule.key)
      charged.push({ rule, bucket })
    }
  } catch (error) {
    // Refused before running: the other buckets keep no charge for it.
    if (error instanceof errors.E_TOO_MANY_REQUESTS) {
      for (const { rule, bucket } of charged) await bucket.decrement(rule.key)
    }
    throw error
  }

  const result = await attempt()

  for (const { rule, bucket } of charged) {
    if (rule.resetOnSuccess) await bucket.delete(rule.key)
    else await bucket.decrement(rule.key)
  }
  return result
}
