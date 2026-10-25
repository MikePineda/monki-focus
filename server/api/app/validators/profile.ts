// SPDX-License-Identifier: AGPL-3.0-or-later
import vine from '@vinejs/vine'
import {
  currentPassword,
  fullName,
  locale,
  newPassword,
  timeZone,
  weekStart,
} from '#validators/account_fields'

/** PATCH /me: every field optional, unknown fields ignored. */
export const updateProfileValidator = vine.create({
  fullName: fullName().nullable().optional(),
  locale: locale().optional(),
  timeZone: timeZone().optional(),
  weekStart: weekStart().optional(),
})

/** PUT /me/password. Pass `meta: { email }` so the new one cannot contain it. */
export const changePasswordValidator = vine.create({
  currentPassword: currentPassword(),
  password: newPassword(),
})

/** Sensitive actions that only re-check the password (DELETE /me, 2FA enrolment). */
export const reauthValidator = vine.create({
  password: currentPassword(),
})

/** GET /me/export. `aw` (ActivityWatch) joins with the analytics package. */
export const exportValidator = vine.create({
  format: vine.enum(['native'] as const).optional(),
})
