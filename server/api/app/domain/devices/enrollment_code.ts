// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHmac } from 'node:crypto'
import { base32Encode } from '#domain/auth/base32'

/**
 * The one-time code a user types (or scans) on a new device to enrol it.
 *
 * - 8 characters of RFC 4648 base32 (`A-Z2-7`), 40 random bits, valid
 *   10 minutes, single use.
 * - The first 3 characters (15 bits) are the **lookup** part: they find the
 *   code among the pending ones (unique among them). The whole code is the
 *   proof. So a wrong guess always lands on at most one pending code, which
 *   is what lets each code count its own failed attempts and die at the
 *   fifth, however many addresses the guesses come from: an attacker wins at
 *   most 5 / 2^25 per pending code.
 * - Stored only as HMAC-SHA256 digests keyed with the instance secret
 *   (APP_KEY): a leaked database row cannot be reversed offline.
 */

export const ENROLLMENT_CODE_LENGTH = 8
export const ENROLLMENT_CODE_PATTERN = /^[A-Z2-7]{8}$/
/** Random bytes behind a code: exactly 8 base32 characters. */
export const ENROLLMENT_CODE_BYTES = 5
export const ENROLLMENT_LOOKUP_LENGTH = 3
export const ENROLLMENT_CODE_TTL_MINUTES = 10
/** The fifth wrong guess kills the code. */
export const ENROLLMENT_CODE_MAX_ATTEMPTS = 5

export interface EnrollmentCodeDigests {
  /** HMAC of the lookup part: finds the pending code. */
  readonly lookupHash: string
  /** HMAC of the whole code: proves it. */
  readonly codeHash: string
}

/** The code for 5 random bytes (the caller draws them: no randomness in the domain). */
export function enrollmentCodeFromBytes(bytes: Uint8Array): string {
  if (bytes.length !== ENROLLMENT_CODE_BYTES) {
    throw new RangeError(`An enrolment code needs exactly ${ENROLLMENT_CODE_BYTES} bytes`)
  }
  return base32Encode(bytes)
}

export function isEnrollmentCode(value: unknown): value is string {
  return typeof value === 'string' && ENROLLMENT_CODE_PATTERN.test(value)
}

/**
 * Both digests of a well-formed code. Domain-separated labels keep the two
 * HMACs (and any other use of the same secret) apart.
 */
export function enrollmentCodeDigests(code: string, pepper: string): EnrollmentCodeDigests {
  if (!isEnrollmentCode(code)) throw new RangeError('Not an enrolment code')
  const hmac = (label: string, value: string) =>
    createHmac('sha256', pepper).update(`monki-focus/${label}/v1|${value}`).digest('hex')
  return {
    lookupHash: hmac('enrollment-lookup', code.slice(0, ENROLLMENT_LOOKUP_LENGTH)),
    codeHash: hmac('enrollment-code', code),
  }
}
