// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import type User from '#models/user'
import { CodedError } from '#exceptions/coded_error'
import { mayStartOwnProtection } from '#domain/guardians/guardian_only_policy'

/**
 * Refuses (403 `E_GUARDIAN_ONLY_ACCOUNT`) what would make a guardian-only
 * account a ward while REGISTRATION_OPEN is off: minting pairing codes and
 * enrolling devices. Called first by both, before any throttle is spent.
 */
export function assertMayStartOwnProtection(user: User): void {
  const allowed = mayStartOwnProtection({
    guardianOnly: user.guardianOnly,
    registrationOpen: env.get('REGISTRATION_OPEN') === true,
  })
  if (!allowed) {
    throw new CodedError('E_GUARDIAN_ONLY_ACCOUNT', 403, 'This account may only guard someone')
  }
}
