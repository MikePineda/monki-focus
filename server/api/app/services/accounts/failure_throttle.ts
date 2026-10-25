// SPDX-License-Identifier: AGPL-3.0-or-later
import { errors } from '@adonisjs/limiter'
import limiter from '@adonisjs/limiter/services/main'

/** One bucket of a failure throttle. */
export interface FailureRule {
  /** Built from purposes, client IP buckets and user ids: never an email in clear. */
  key: string
  /** Failures allowed per `duration`... */
  failures: number
  duration: string
  /** ...then the key is blocked this long. */
  blockDuration: string
  /**
   * Whether a success clears the bucket. True for per-account buckets
   * (the right password ends the guessing); false for per-IP ones, or one
   * successful login to the attacker's own account would reset the IP.
   */
  resetOnSuccess: boolean
}

/**
 * Runs `attempt` unless any bucket is exhausted (then 429 without running
 * it, so a blocked guess costs nothing and reveals nothing). Only failures
 * (a thrown error) count. Like the limiter's own `penalize`, but each
 * bucket decides whether a success resets it.
 */
export async function throttleFailures<T>(rules: FailureRule[], attempt: () => Promise<T>) {
  const buckets = rules.map((rule) => ({
    rule,
    limiter: limiter.use({
      requests: rule.failures,
      duration: rule.duration,
      blockDuration: rule.blockDuration,
    }),
  }))

  for (const { rule, limiter: bucket } of buckets) {
    const state = await bucket.get(rule.key)
    if (state && state.remaining <= 0) throw new errors.E_TOO_MANY_REQUESTS(state)
  }

  let result: T
  try {
    result = await attempt()
  } catch (error) {
    for (const { rule, limiter: bucket } of buckets) {
      const state = await bucket.increment(rule.key)
      if (state.consumed >= state.limit) await bucket.block(rule.key, rule.blockDuration)
    }
    throw error
  }

  for (const { rule, limiter: bucket } of buckets) {
    if (rule.resetOnSuccess) await bucket.delete(rule.key)
  }
  return result
}
