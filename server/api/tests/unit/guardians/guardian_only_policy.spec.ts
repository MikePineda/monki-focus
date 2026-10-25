// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { mayStartOwnProtection } from '#domain/guardians/guardian_only_policy'

test.group('Guardian-only accounts', () => {
  test('test_a_guardian_only_account_starts_no_protection_while_registration_is_closed', ({
    assert,
  }) => {
    assert.isFalse(mayStartOwnProtection({ guardianOnly: true, registrationOpen: false }))
  })

  test('test_open_registration_or_an_ordinary_account_lifts_it', ({ assert }) => {
    assert.isTrue(mayStartOwnProtection({ guardianOnly: true, registrationOpen: true }))
    assert.isTrue(mayStartOwnProtection({ guardianOnly: false, registrationOpen: false }))
  })
})
