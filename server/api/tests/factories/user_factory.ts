// SPDX-License-Identifier: AGPL-3.0-or-later
import { DateTime } from 'luxon'
import User from '#models/user'
import factory from '@adonisjs/lucid/factories'

/** The passphrase every factory user gets (tests sign in with it). Synthetic. */
export const FACTORY_PASSPHRASE = ['orbit', 'lantern', 'cactus', 'meadow'].join(' ')

/** Synthetic users only: generated addresses on the documentation domain `example.com`. */
export const UserFactory = factory
  .define(User, ({ faker }) => ({
    email: `user-${faker.string.alphanumeric(10).toLowerCase()}@example.com`,
    fullName: `Test user ${faker.string.alphanumeric(4)}`,
    password: FACTORY_PASSPHRASE,
    locale: 'en' as const,
    timeZone: 'UTC',
    weekStart: 1,
    isAdmin: false,
    sessionVersion: 0,
  }))
  .state('admin', (user) => {
    user.isAdmin = true
  })
  .state('spanish', (user) => {
    user.locale = 'es'
  })
  /**
   * Two-step verification marked on (what guardianship checks). No seed:
   * tests that type codes enrol through /me/two-factor instead.
   */
  .state('twoFactor', (user) => {
    user.totpEnabledAt = DateTime.utc()
  })
  .build()
