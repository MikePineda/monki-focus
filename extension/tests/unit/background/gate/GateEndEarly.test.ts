// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { GateView } from '../../../../src/shared/GateContract'
import { REDDIT_GROUP, REDDIT_POST, TAB, gateHarness } from '../../../support/gateHarness'

describe('GateController.endEarly', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('ending_an_intention_now_counts_it_as_kept_and_gates_the_site_again', async () => {
    const harness = gateHarness()
    const view = (await harness.controller.load(
      TAB,
      await harness.handoff(REDDIT_POST)
    )) as Extract<GateView, { kind: 'friction' }>
    harness.clock.advanceSeconds(view.gate.pauseSeconds)
    await harness.controller.pauseDone(TAB)
    await harness.controller.commit(TAB, 10, 'reply to one message')

    expect(await harness.controller.endEarly(REDDIT_GROUP)).toBe(true)

    expect((await harness.escalation.get(REDDIT_GROUP)).phase).toBe('idle')
    expect(harness.state.log.map((entry) => entry.kind)).toEqual(['visit', 'committed', 'kept'])
  })

  it('a_group_without_an_active_intention_is_left_alone', async () => {
    const harness = gateHarness()

    expect(await harness.controller.endEarly(REDDIT_GROUP)).toBe(false)
    expect(harness.state.log).toEqual([])
  })
})
