// SPDX-License-Identifier: AGPL-3.0-or-later
import vine from '@vinejs/vine'
import type { FieldContext } from '@vinejs/vine/types'
import { SUPPORTED_LOCALES } from '#http/supported_locales'
import { isIanaTimeZone } from '#domain/accounts/time_zone'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordProblems,
  type PasswordProblem,
} from '#domain/accounts/password_policy'

/**
 * The account fields every dashboard validator shares. Error rules are
 * stable names translated in resources/lang/<locale>/validator.json.
 */

/** Validation rule name per password problem (the length ones are VineJS's own). */
const PASSWORD_RULES: Partial<Record<PasswordProblem, string>> = {
  too_common: 'passwordTooCommon',
  too_repetitive: 'passwordTooRepetitive',
  contains_email: 'passwordContainsEmail',
}

const timeZoneRule = vine.createRule((value: unknown, _: undefined, field: FieldContext) => {
  if (typeof value !== 'string' || !isIanaTimeZone(value)) {
    field.report('The {{ field }} field must be an IANA time zone', 'timeZone', field)
  }
})

/**
 * The password policy beyond length. The email comes from a sibling
 * `email` field (registration) or from the validator's `meta.email`
 * (a signed-in user changing theirs).
 */
const strongPasswordRule = vine.createRule((value: unknown, _: undefined, field: FieldContext) => {
  if (typeof value !== 'string') return
  const meta = field.meta as { email?: unknown } | undefined
  const sibling = (field.parent as { email?: unknown } | undefined)?.email
  const email = typeof meta?.email === 'string' ? meta.email : sibling
  for (const problem of passwordProblems(value, {
    email: typeof email === 'string' ? email : null,
  })) {
    const rule = PASSWORD_RULES[problem]
    if (rule) {
      field.report('The {{ field }} field is too easy to guess', rule, field)
      return
    }
  }
})

/** Trimmed, lowercased email address. */
export const email = () => vine.string().trim().toLowerCase().email().maxLength(254)

/** A new password: 12-128 characters and the rest of the policy. */
export const newPassword = () =>
  vine
    .string()
    .minLength(PASSWORD_MIN_LENGTH)
    .maxLength(PASSWORD_MAX_LENGTH)
    .use(strongPasswordRule())

/** A password being checked (login, reauth): bounded, so hashing cost stays bounded. */
export const currentPassword = () => vine.string().minLength(1).maxLength(PASSWORD_MAX_LENGTH)

export const fullName = () => vine.string().trim().minLength(1).maxLength(120)

export const locale = () => vine.enum(SUPPORTED_LOCALES)

/** IANA time zone name (`Europe/Madrid`, `UTC`). */
export const timeZone = () => vine.string().trim().use(timeZoneRule())

/** ISO weekday the user's week starts on: 1 = Monday ... 7 = Sunday. */
export const weekStart = () => vine.number().withoutDecimals().min(1).max(7)

/** A 6-digit authenticator code (spaces allowed). */
export const totpCode = () =>
  vine
    .string()
    .trim()
    .regex(/^\d{3}\s?\d{3}$/)

/** A recovery code as printed (`abcd-efgh-ijkl-mnop`), any case or spacing. */
export const recoveryCode = () => vine.string().trim().minLength(16).maxLength(40)
