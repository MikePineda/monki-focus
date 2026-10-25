// SPDX-License-Identifier: AGPL-3.0-or-later
import vine from '@vinejs/vine'
import { currentPassword, recoveryCode, totpCode } from '#validators/account_fields'

/** POST /me/two-factor/confirm: the first code from the newly scanned secret. */
export const confirmTwoFactorValidator = vine.create({
  code: totpCode(),
})

/**
 * Turning TOTP off or regenerating recovery codes: the password and a
 * second factor (an authenticator code or a recovery code).
 */
export const twoFactorReauthValidator = vine.create({
  password: currentPassword(),
  code: totpCode().optional().requiredIfMissing('recoveryCode'),
  recoveryCode: recoveryCode().optional(),
})
