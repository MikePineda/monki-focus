// SPDX-License-Identifier: AGPL-3.0-or-later
import vine from '@vinejs/vine'
import {
  currentPassword,
  email,
  fullName,
  locale,
  newPassword,
  timeZone,
  weekStart,
} from '#validators/account_fields'
import { MIN_MAX_UNLOCK_MINUTES } from '#domain/guardians/link_settings'

/** A pairing code as typed: 6 digits, optionally `123 456` or `123-456`. */
const pairingCode = () =>
  vine
    .string()
    .trim()
    .regex(/^[0-9]{3}[\s-]?[0-9]{3}$/)

/** POST /guardian/pairings: a signed-in person redeems a ward's code. */
export const redeemPairingValidator = vine.create({ code: pairingCode() })

/** POST /auth/register-guardian: a new account through a ward's code (the account fields of sign-up). */
export const registerGuardianValidator = vine.create({
  code: pairingCode(),
  email: email(),
  fullName: fullName(),
  password: newPassword(),
  locale: locale().optional(),
  timeZone: timeZone().optional(),
  weekStart: weekStart().optional(),
})

/** POST /guardian/links/:id/confirm: the ward's password again. */
export const confirmLinkValidator = vine.create({ password: currentPassword() })

const updateLinkValidators = new Map<number, ReturnType<typeof buildUpdateLinkValidator>>()

function buildUpdateLinkValidator(cap: number) {
  return vine.create({
    maxUnlockMinutes: vine
      .number({ strict: true })
      .withoutDecimals()
      .min(MIN_MAX_UNLOCK_MINUTES)
      .max(cap)
      .optional(),
    allowNotificationActions: vine.boolean({ strict: true }).optional(),
  })
}

/** PATCH /guardian/links/:id, bounded by the instance cap (UNLOCK_TOKEN_MAX_MINUTES, 240 at most). */
export function updateLinkValidator(cap: number) {
  let validator = updateLinkValidators.get(cap)
  if (!validator) {
    validator = buildUpdateLinkValidator(cap)
    updateLinkValidators.set(cap, validator)
  }
  return validator
}
