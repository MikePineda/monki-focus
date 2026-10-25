// SPDX-License-Identifier: AGPL-3.0-or-later

const INT32_MAX = 2_147_483_647

/**
 * How far the device's wall clock is behind the server's (positive: the
 * device is late), in milliseconds, clamped to a 32-bit column. Informative
 * only, for the user and the guardian: trusted time on the device comes
 * from signed time tokens, never from this.
 */
export function clockOffsetMs(serverMs: number, clientMs: number): number {
  const offset = Math.round(serverMs - clientMs)
  return Math.max(-INT32_MAX, Math.min(INT32_MAX, offset))
}
