// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import type User from '#models/user'
import GuardianLink from '#models/guardian_link'
import { ntfyTopicFromBytes } from '#domain/guardians/ntfy_topic'
import { UserFactory } from '#tests/factories/user_factory'

/** A fresh synthetic capability topic under the default prefix. */
export function aTopic() {
  return ntfyTopicFromBytes('mf-', randomBytes(16))
}

/** A guardian link row: active by default; `pending`, `revoking` and `revoked` states. */
export const GuardianLinkFactory = factory
  .define(GuardianLink, () => ({
    status: 'active' as const,
    ntfyTopic: aTopic(),
    maxUnlockMinutes: 30,
    allowNotificationActions: true,
    confirmedAt: DateTime.utc(),
    revocationRequestedAt: null,
    revocationEffectiveAt: null,
    revokedAt: null,
    revokedByUserId: null,
  }))
  .state('pending', (link) => {
    link.status = 'pending'
    link.confirmedAt = null
  })
  .state('revoking', (link) => {
    link.revocationRequestedAt = DateTime.utc()
    link.revocationEffectiveAt = DateTime.utc().plus({ hours: 24 })
  })
  .state('revoked', (link) => {
    link.status = 'revoked'
    link.revokedAt = DateTime.utc()
  })
  .build()

export type LinkFixtureState = 'pending' | 'active' | 'revoking' | 'revoked'

/**
 * A ward and their guardian (two new users unless given) linked in
 * `state`. The guardian has two-step verification on unless
 * `guardianTwoFactor` is false.
 */
export async function guardianPair(
  options: {
    state?: LinkFixtureState
    ward?: User
    guardian?: User
    guardianTwoFactor?: boolean
    /** When the ward confirmed it (active and revoking links; default: now). */
    confirmedAt?: DateTime
  } = {}
) {
  const ward = options.ward ?? (await UserFactory.create())
  const guardian =
    options.guardian ??
    (options.guardianTwoFactor === false
      ? await UserFactory.create()
      : await UserFactory.apply('twoFactor').create())
  const state = options.state ?? 'active'
  const builder = GuardianLinkFactory.merge({
    wardUserId: ward.id,
    guardianUserId: guardian.id,
    ...(options.confirmedAt && state !== 'pending' ? { confirmedAt: options.confirmedAt } : {}),
  })
  const link = await (state === 'active' ? builder : builder.apply(state)).create()
  return { ward, guardian, link }
}
