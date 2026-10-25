// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import {
  MAX_RECONNECT_MS,
  MIN_RECONNECT_MS,
  ReconnectBackoff,
} from '../../../../src/background/native/ReconnectBackoff'

describe('reconnect backoff', () => {
  it.each([0, 0.5, 0.999])('delays_stay_between_1_and_60_seconds_with_random_%s', (random) => {
    const backoff = new ReconnectBackoff(() => random)

    const delays = Array.from({ length: 30 }, () => backoff.next())

    expect(delays.every((delay) => delay >= MIN_RECONNECT_MS && delay <= MAX_RECONNECT_MS)).toBe(
      true
    )
  })

  it('delays_grow_until_the_cap_and_jitter_spreads_them', () => {
    const low = new ReconnectBackoff(() => 0)
    const high = new ReconnectBackoff(() => 0.999)

    const lows = Array.from({ length: 8 }, () => low.next())
    const highs = Array.from({ length: 8 }, () => high.next())

    expect(lows).toEqual([1000, 1000, 2000, 4000, 8000, 16_000, 30_000, 30_000])
    expect(highs.at(-1)).toBe(59_970)
  })

  it('reset_starts_again_from_one_second', () => {
    const backoff = new ReconnectBackoff(() => 0.5)
    for (let attempt = 0; attempt < 5; attempt += 1) backoff.next()

    backoff.reset()

    expect(backoff.next()).toBe(1000)
  })
})
