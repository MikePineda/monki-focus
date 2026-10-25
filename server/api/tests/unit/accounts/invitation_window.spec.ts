// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { invitationExpiresAt, invitationStatus } from '#domain/accounts/invitation_window'

const CREATED = new Date('2026-01-05T09:00:00Z')

test.group('Invitation window', () => {
  test('test_an_invitation_expires_seven_days_after_creation', ({ assert }) => {
    assert.equal(invitationExpiresAt(CREATED).toISOString(), '2026-01-12T09:00:00.000Z')
  })

  test('test_an_invitation_is_pending_until_the_exact_expiry_instant', ({ assert }) => {
    const expiresAt = invitationExpiresAt(CREATED)
    const justBefore = new Date(expiresAt.getTime() - 1)

    assert.equal(invitationStatus({ expiresAt, usedAt: null }, justBefore), 'pending')
    assert.equal(invitationStatus({ expiresAt, usedAt: null }, expiresAt), 'expired')
  })

  test('test_a_used_invitation_reads_used_even_after_expiry', ({ assert }) => {
    const expiresAt = invitationExpiresAt(CREATED)
    const later = new Date('2026-02-01T00:00:00Z')

    assert.equal(invitationStatus({ expiresAt, usedAt: CREATED }, later), 'used')
  })
})
