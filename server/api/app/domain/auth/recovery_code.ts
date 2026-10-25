// SPDX-License-Identifier: AGPL-3.0-or-later
import { base32Encode } from '#domain/auth/base32'

/** Codes issued per user (each works once). */
export const RECOVERY_CODE_COUNT = 10

/** Random bytes behind each code: 10 bytes = 80 bits, 16 base32 characters. */
export const RECOVERY_CODE_BYTES = 10

/**
 * Formats random bytes as a code people can copy: lowercase base32 in four
 * groups of four (`abcd-efgh-ijkl-mnop`).
 */
export function formatRecoveryCode(bytes: Uint8Array): string {
  const text = base32Encode(bytes).toLowerCase()
  return text.match(/.{1,4}/g)!.join('-')
}

/**
 * The canonical form a typed code is digested in: lowercase, without
 * spaces or dashes, so `ABCD EFGH-ijkl mnop` matches. Null when it cannot
 * be a recovery code.
 */
export function normalizeRecoveryCode(input: string): string | null {
  const clean = input.replace(/[\s-]/g, '').toLowerCase()
  return /^[a-z2-7]{16}$/.test(clean) ? clean : null
}
