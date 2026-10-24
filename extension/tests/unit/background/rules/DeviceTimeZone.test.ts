// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import {
  deviceTimeZone,
  FALLBACK_TIME_ZONE,
  isResolvableTimeZone,
} from '../../../../src/background/rules/DeviceTimeZone'

describe('deviceTimeZone', () => {
  it('device_zone_comes_from_intl_by_default', () => {
    expect(deviceTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  it('a_resolvable_zone_is_kept', () => {
    expect(deviceTimeZone(() => 'Etc/GMT-12')).toBe('Etc/GMT-12')
  })

  it.each([undefined, '', 'Mars/Olympus'])('unresolvable_zone_%j_falls_back_to_utc', (zone) => {
    expect(deviceTimeZone(() => zone)).toBe(FALLBACK_TIME_ZONE)
  })

  it('a_throwing_resolver_falls_back_to_utc', () => {
    expect(
      deviceTimeZone(() => {
        throw new Error('no intl')
      })
    ).toBe(FALLBACK_TIME_ZONE)
  })

  it('only_strings_are_resolvable', () => {
    expect(isResolvableTimeZone(42)).toBe(false)
    expect(isResolvableTimeZone('UTC')).toBe(true)
  })
})
