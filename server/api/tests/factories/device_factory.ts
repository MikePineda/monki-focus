// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import Device from '#models/device'
import type User from '#models/user'
import DeviceTokens from '#services/devices/device_tokens'
import { UserFactory } from '#tests/factories/user_factory'

/** Synthetic kids (16 base64url characters), never a real instance's. */
export const SYNTHETIC_KIDS = { unlock: ['TESTunlockKid001'], policy: ['TESTpolicyKid001'] }

/** An enrolled device; `protected` has protection on, `revoked` is revoked. */
export const DeviceFactory = factory
  .define(Device, ({ faker }) => ({
    uuid: randomUUID(),
    name: `Test device ${faker.string.alphanumeric(4)}`,
    platform: 'android' as const,
    clientVersion: '0.1.0',
    rulesHash: null,
    policyHash: null,
    protectionActive: false,
    a11yEnabled: null,
    riskState: [],
    enrolledKids: SYNTHETIC_KIDS,
    pinnedKids: null,
    keyPinMismatch: false,
    deadmanHours: 6,
    lastBoot: null,
    lastSeenAt: DateTime.utc(),
    announcedOfflineAt: null,
    clockOffsetMs: null,
    revokedAt: null,
  }))
  .state('protected', (device) => {
    device.protectionActive = true
  })
  .state('revoked', (device) => {
    device.revokedAt = DateTime.utc()
  })
  .relation('user', () => UserFactory)
  .build()

/**
 * Laravel's "device token factory": a device of `user` (a new user when
 * omitted) and its bearer token, issued exactly like enrolment does.
 */
export async function enrolledDevice(
  user?: User,
  merge: Partial<Pick<Device, 'protectionActive' | 'lastSeenAt' | 'deadmanHours'>> = {}
) {
  const owner = user ?? (await UserFactory.create())
  const device = await DeviceFactory.merge({ userId: owner.id, ...merge }).create()
  const token = await new DeviceTokens().issue(device)
  return { user: owner, device, token }
}
