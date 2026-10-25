// SPDX-License-Identifier: AGPL-3.0-or-later
import type User from '#models/user'

/**
 * What the dashboard sees of its own user. An allowlist: the password
 * hash, the TOTP secret, the session version and the ntfy topic never
 * leave the server through it.
 */
export function userResource(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    locale: user.locale,
    timeZone: user.timeZone,
    weekStart: user.weekStart,
    isAdmin: user.isAdmin,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt.toUTC().toISO(),
  }
}
