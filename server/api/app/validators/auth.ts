// SPDX-License-Identifier: AGPL-3.0-or-later
import vine from '@vinejs/vine'
import {
  currentPassword,
  email,
  fullName,
  locale,
  newPassword,
  recoveryCode,
  timeZone,
  totpCode,
  weekStart,
} from '#validators/account_fields'

export const loginValidator = vine.create({
  email: email(),
  password: currentPassword(),
})

/** The second login step: an authenticator code or one recovery code. */
export const twoFactorLoginValidator = vine.create({
  code: totpCode().optional().requiredIfMissing('recoveryCode'),
  recoveryCode: recoveryCode().optional(),
})

/**
 * Sign-up: with an invitation link's secret part, or without one only while
 * REGISTRATION_OPEN is on.
 */
export const registerValidator = vine.create({
  invitation: vine.string().trim().minLength(1).maxLength(128).optional(),
  email: email(),
  fullName: fullName(),
  password: newPassword(),
  locale: locale().optional(),
  timeZone: timeZone().optional(),
  weekStart: weekStart().optional(),
})
