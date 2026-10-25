// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Device tokens do not expire (a device offline for weeks must still be
 * able to report back), but devices rotate them: once a token is 30 days
 * old the heartbeat says so (`tokenRotationDue`) and the device calls
 * `POST /device/token/rotate`. A copy stolen earlier then dies with the
 * old token; if the thief rotates first, the real device starts getting
 * 401, which is visible. The old token keeps working for a short grace
 * (so in-flight requests finish) and can never rotate again, so it cannot
 * mint a second permanent token: a device whose rotation response was lost
 * keeps the old token for the grace, then enrols again. Epoch seconds.
 */

export const TOKEN_ROTATION_DAYS = 30
export const TOKEN_ROTATION_SECONDS = TOKEN_ROTATION_DAYS * 24 * 3600

/** How long the previous token keeps working after a rotation. */
export const ROTATION_GRACE_SECONDS = 10 * 60

export function isRotationDue(issuedAt: number, now: number): boolean {
  return now - issuedAt >= TOKEN_ROTATION_SECONDS
}

/** When the previous token stops working: the grace from now. A token in its grace never rotates again. */
export function previousTokenValidUntil(now: number): number {
  return now + ROTATION_GRACE_SECONDS
}
