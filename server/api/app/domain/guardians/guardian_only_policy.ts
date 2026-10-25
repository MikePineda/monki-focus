// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * A pairing code opens a sign-up even while registration is closed, but
 * only to guard someone: the account it creates is **guardian-only**. While
 * REGISTRATION_OPEN is off it cannot become a ward itself (no pairing
 * codes, no device enrolment), so one code can never chain into more
 * sign-ups. An admin's invitation lifts it for good; opening registration
 * lifts it while open.
 */
export function mayStartOwnProtection(account: {
  readonly guardianOnly: boolean
  readonly registrationOpen: boolean
}): boolean {
  return !account.guardianOnly || account.registrationOpen
}
