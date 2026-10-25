// SPDX-License-Identifier: AGPL-3.0-or-later

/** Length bounds, counted in Unicode code points. The maximum bounds the cost of hashing. */
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

/** Reason codes (never text): the validator and the seeder map them to messages. */
export type PasswordProblem =
  'too_short' | 'too_long' | 'too_common' | 'too_repetitive' | 'contains_email'

/**
 * Words that make a password guessable whatever digits or symbols surround
 * them: `Password-2026!` reduces to `password`. Short on purpose (the length
 * rule does most of the work); it catches the defaults people try first.
 */
const GUESSABLE_WORDS = new Set([
  'password',
  'passwort',
  'contrasena',
  'qwerty',
  'qwertyuiop',
  'asdfgh',
  'letmein',
  'welcome',
  'iloveyou',
  'admin',
  'administrator',
  'changeme',
  'secret',
  'monkey',
  'dragon',
  'monkifocus',
  'focus',
  'abc',
  'abcdef',
  'test',
  'user',
  'login',
])

/** Fewer distinct characters than this is a repeated pattern (`aaaaaaaaaaaa`, `121212121212`). */
const MIN_DISTINCT_CHARACTERS = 5

/** The shortest local part of an email that counts as "contained". */
const MIN_EMAIL_LOCAL_PART = 4

function isAllDigits(text: string) {
  return /^\d+$/.test(text)
}

/**
 * What is wrong with a new password, in order (empty = acceptable). The
 * email, when given, must not appear in it. Pure: callers pass every input.
 */
export function passwordProblems(
  password: string,
  context: { email?: string | null } = {}
): PasswordProblem[] {
  const problems: PasswordProblem[] = []
  const length = [...password].length
  if (length < PASSWORD_MIN_LENGTH) problems.push('too_short')
  if (length > PASSWORD_MAX_LENGTH) problems.push('too_long')

  const lower = password.toLowerCase()
  const letters = lower.normalize('NFD').replace(/[^a-z]/g, '')
  if (GUESSABLE_WORDS.has(letters) || isAllDigits(password)) problems.push('too_common')

  if (new Set(password).size < MIN_DISTINCT_CHARACTERS) problems.push('too_repetitive')

  const localPart = context.email?.split('@')[0]?.toLowerCase() ?? ''
  if (localPart.length >= MIN_EMAIL_LOCAL_PART && lower.includes(localPart)) {
    problems.push('contains_email')
  }

  return problems
}
