// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { trackingTimingFor } from '../../../../src/background/tracking/TrackingTiming'

describe('tracking timing', () => {
  it('production_pulses_every_30_s_with_a_45_s_pulsetime', () => {
    expect(trackingTimingFor('production')).toMatchObject({
      pulseSeconds: 30,
      pulsetimeSeconds: 45,
    })
  })

  it('only_the_e2e_build_assumes_an_active_user', () => {
    expect(trackingTimingFor('production').assumeUserActive).toBe(false)
    expect(trackingTimingFor('development').assumeUserActive).toBe(false)
    expect(trackingTimingFor('e2e').assumeUserActive).toBe(true)
  })

  it('the_e2e_build_pulses_fast_and_keeps_pulsetime_at_one_and_a_half_pulses', () => {
    const timing = trackingTimingFor('e2e')

    expect(timing.pulseSeconds).toBeLessThan(5)
    expect(timing.pulsetimeSeconds).toBe(timing.pulseSeconds * 1.5)
  })
})
