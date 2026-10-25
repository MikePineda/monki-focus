// SPDX-License-Identifier: AGPL-3.0-or-later
import { SUPPORTED_LOCALES, type SupportedLocale } from '#http/supported_locales'
import { isIanaTimeZone } from '#domain/accounts/time_zone'
import { passwordProblems } from '#domain/accounts/password_policy'

/** The SEED_* and SMOKE_* values (already type-checked by start/env_schema.ts). */
export interface SeedEnv {
  SEED_ADMIN_EMAIL?: string
  SEED_ADMIN_NAME?: string
  SEED_ADMIN_PASSWORD?: string
  SEED_ADMIN_LOCALE?: string
  SEED_ADMIN_TIME_ZONE?: string
  SMOKE_EMAIL?: string
  SMOKE_PASSWORD?: string
}

export interface SeedUser {
  email: string
  fullName: string | null
  password: string
  locale: SupportedLocale
  timeZone: string
}

export interface SeedPlan {
  admin: SeedUser | null
  smoke: SeedUser | null
}

/** Blank counts as unset. */
function given(value: string | undefined): string | undefined {
  return value?.trim() ? value.trim() : undefined
}

function fail(problem: string): never {
  throw new Error(`Invalid production bootstrap env: ${problem}`)
}

/** Refuses a weak password, naming the variable and the reason, never the value. */
function strongPassword(name: string, password: string, email: string): string {
  const problems = passwordProblems(password, { email })
  if (problems.length > 0) fail(`${name} is too weak (${problems.join(', ')})`)
  return password
}

/**
 * What one seeder run creates, from env only: the first admin
 * (SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD, all-or-nothing) and/or the
 * post-deploy smoke user (SMOKE_EMAIL + SMOKE_PASSWORD), which may never be
 * the admin. Weak passwords and unknown time zones stop the deploy; errors
 * name variables, never their values.
 */
export function readSeedPlan(input: SeedEnv): SeedPlan {
  const adminEmail = given(input.SEED_ADMIN_EMAIL)?.toLowerCase()
  const adminPassword = given(input.SEED_ADMIN_PASSWORD)
  if (Boolean(adminEmail) !== Boolean(adminPassword)) {
    fail('set both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD, or neither')
  }

  const smokeEmail = given(input.SMOKE_EMAIL)?.toLowerCase()
  const smokePassword = given(input.SMOKE_PASSWORD)
  if (Boolean(smokeEmail) !== Boolean(smokePassword)) {
    fail('set both SMOKE_EMAIL and SMOKE_PASSWORD, or neither')
  }

  if (!adminEmail && !smokeEmail) {
    fail('nothing to seed (set SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD and/or SMOKE_*)')
  }
  if (adminEmail && adminEmail === smokeEmail) {
    fail('SMOKE_EMAIL must differ from SEED_ADMIN_EMAIL')
  }

  const locale = given(input.SEED_ADMIN_LOCALE) ?? 'en'
  if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
    fail(`SEED_ADMIN_LOCALE must be one of ${SUPPORTED_LOCALES.join(', ')}`)
  }
  const timeZone = given(input.SEED_ADMIN_TIME_ZONE) ?? 'UTC'
  if (!isIanaTimeZone(timeZone)) fail('SEED_ADMIN_TIME_ZONE is not an IANA time zone')

  return {
    admin: adminEmail
      ? {
          email: adminEmail,
          fullName: given(input.SEED_ADMIN_NAME) ?? null,
          password: strongPassword('SEED_ADMIN_PASSWORD', adminPassword!, adminEmail),
          locale: locale as SupportedLocale,
          timeZone,
        }
      : null,
    smoke: smokeEmail
      ? {
          email: smokeEmail,
          fullName: null,
          password: strongPassword('SMOKE_PASSWORD', smokePassword!, smokeEmail),
          locale: 'en',
          timeZone: 'UTC',
        }
      : null,
  }
}
