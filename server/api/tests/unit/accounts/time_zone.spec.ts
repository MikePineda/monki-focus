// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { isIanaTimeZone } from '#domain/accounts/time_zone'

test.group('Time zones', () => {
  test('test_iana_names_are_accepted ({$self})')
    .with(['UTC', 'Etc/UTC', 'Europe/Madrid', 'America/Argentina/Buenos_Aires', 'Etc/GMT+5'])
    .run(({ assert }, name) => {
      assert.isTrue(isIanaTimeZone(name))
    })

  test('test_offsets_unknown_zones_and_junk_are_refused ({$self})')
    .with(['', '+05:00', '-0300', 'Mars/Olympus_Mons', 'Europe/', '../etc/passwd', 'x'.repeat(65)])
    .run(({ assert }, name) => {
      assert.isFalse(isIanaTimeZone(name))
    })
})
