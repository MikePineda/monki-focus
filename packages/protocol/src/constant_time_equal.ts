// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Compares two byte strings in time that depends only on their lengths, not
 * on where they first differ. Used for footer comparison, as the PASETO spec
 * requires. Lengths are not secret here (they are visible in the token).
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false
  }
  let difference = 0
  for (let index = 0; index < a.byteLength; index++) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0)
  }
  return difference === 0
}
