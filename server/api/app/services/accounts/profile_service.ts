// SPDX-License-Identifier: AGPL-3.0-or-later
import type User from '#models/user'
import { revokeSessions } from '#services/accounts/session_revocation'
import type { SupportedLocale } from '#http/supported_locales'

export interface ProfileChanges {
  fullName?: string | null
  locale?: SupportedLocale
  timeZone?: string
  weekStart?: number
}

/**
 * The user's own settings. Anything that ends other sessions bumps
 * `session_version`; the caller re-stamps its own session when it should
 * survive (a password change keeps this device signed in).
 */
export default class ProfileService {
  async update(user: User, changes: ProfileChanges) {
    if (changes.fullName !== undefined) user.fullName = changes.fullName
    if (changes.locale !== undefined) user.locale = changes.locale
    if (changes.timeZone !== undefined) user.timeZone = changes.timeZone
    if (changes.weekStart !== undefined) user.weekStart = changes.weekStart
    await user.save()
    return user
  }

  /** Sets a new password (hashed on save) and ends every session; the caller re-stamps its own. */
  async changePassword(user: User, password: string) {
    user.password = password
    await user.save()
    return revokeSessions(user)
  }
}
