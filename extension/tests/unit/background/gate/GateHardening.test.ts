// SPDX-License-Identifier: AGPL-3.0-or-later
import { initialEscalationState } from '@monki-focus/engine'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import {
  BYPASS_UNRECORDED_NAME,
  BypassRecorder,
  PENDING_BYPASSES_NAME,
} from '../../../../src/background/gate/BypassRecorder'
import { ESCALATION_NAME } from '../../../../src/background/gate/EscalationStore'
import type { BypassEventPayload, MonkiDb } from '../../../../src/background/storage/db'
import { DbConnection } from '../../../../src/background/storage/DbConnection'
import type { GateView } from '../../../../src/shared/GateContract'
import {
  GATE_URL,
  REDDIT_GROUP,
  REDDIT_POST,
  TAB,
  gateHarness,
  gatedRuleset,
} from '../../../support/gateHarness'

type Harness = ReturnType<typeof gateHarness>

async function arrive(harness: Harness, url = REDDIT_POST): Promise<GateView> {
  return harness.controller.load(TAB, await harness.handoff(url))
}

async function commitIntention(harness: Harness, minutes: 5 | 10 | 15 = 5): Promise<void> {
  const view = await arrive(harness)
  if (view.kind !== 'friction') throw new Error(`expected friction, got ${view.kind}`)
  harness.clock.advanceSeconds(view.gate.pauseSeconds)
  await harness.controller.pauseDone(TAB)
  await harness.controller.commit(TAB, minutes, '')
}

async function waitForOverride(harness: Harness): Promise<GateView> {
  await arrive(harness)
  await harness.controller.emergency(TAB)
  harness.clock.advanceSeconds(120)
  return harness.controller.emergencyDone(TAB)
}

const EVENT: BypassEventPayload = {
  dedupeKey: 'bypass-1',
  kind: 'emergency_override',
  occurredAt: '2026-01-05T09:02:00Z',
  details: { targetGroup: REDDIT_GROUP },
}

describe('gate hardening', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  describe('close and leave never depend on storage', () => {
    it('close_with_the_intention_log_failing_still_closes_the_tab', async () => {
      const harness = gateHarness()
      await arrive(harness)
      harness.state.logFails = true

      expect(await harness.controller.close(TAB)).toEqual({ closed: true })

      expect(harness.state.closed).toEqual([TAB])
      expect(harness.state.diagnostics).toContain('log.unavailable')
      expect((await harness.escalation.get(REDDIT_GROUP)).phase).toBe('idle')
    })

    it('close_with_escalation_writes_failing_still_closes_the_tab', async () => {
      const harness = gateHarness()
      await arrive(harness)
      harness.state.escalationWritesFail = true

      expect(await harness.controller.close(TAB)).toEqual({ closed: true })
      expect(harness.state.closed).toEqual([TAB])
    })

    it('leave_from_the_overlay_with_the_log_failing_still_closes_the_tab', async () => {
      const harness = gateHarness()
      await commitIntention(harness)
      harness.clock.advanceSeconds(300)
      await harness.controller.expired(REDDIT_POST)
      harness.state.logFails = true

      expect(await harness.controller.leaveFromPage(TAB, REDDIT_POST)).toEqual({ closed: true })
      expect(harness.state.closed).toEqual([TAB])
    })

    it('a_failed_database_open_is_retried', async () => {
      const db = {} as MonkiDb
      const open = vi
        .fn<() => Promise<MonkiDb>>()
        .mockRejectedValueOnce(new Error('blocked'))
        .mockResolvedValue(db)
      const connection = new DbConnection(open)

      await expect(connection.get()).rejects.toThrow('blocked')
      expect(await connection.get()).toBe(db)
      expect(await connection.get()).toBe(db)
      expect(open).toHaveBeenCalledTimes(2)
    })
  })

  describe('the emergency override is always granted and recorded', () => {
    it('with_the_outbox_down_the_bypass_waits_in_local_storage_and_the_override_is_granted', async () => {
      const harness = gateHarness()
      harness.state.outboxFails = true

      expect(await waitForOverride(harness)).toEqual({ kind: 'pass', url: REDDIT_POST })

      const pending = (await fakeBrowser.storage.local.get(PENDING_BYPASSES_NAME))[
        PENDING_BYPASSES_NAME
      ] as { event: BypassEventPayload }[]
      expect(pending.map((entry) => entry.event.details.targetGroup)).toEqual([REDDIT_GROUP])
      expect(harness.state.changes).toBeGreaterThan(0)
    })

    it('queued_bypasses_reach_the_outbox_once_it_opens', async () => {
      const recorded: BypassEventPayload[] = []
      let down = true
      const recorder = new BypassRecorder(
        () =>
          down
            ? Promise.reject(new Error('idb.unavailable'))
            : Promise.resolve({
                enqueueBypass: (event: BypassEventPayload) => {
                  recorded.push(event)
                  return Promise.resolve()
                },
              }),
        fakeBrowser.storage.local,
        () => undefined
      )
      expect(await recorder.record(EVENT, EVENT.occurredAt)).toBe('fallback')

      down = false
      expect(await recorder.drain()).toBe(1)

      expect(recorded).toEqual([EVENT])
      expect(
        (await fakeBrowser.storage.local.get(PENDING_BYPASSES_NAME))[PENDING_BYPASSES_NAME]
      ).toEqual([])
    })

    it('with_nowhere_to_record_the_override_is_still_granted_and_flagged', async () => {
      const flags: Record<string, unknown> = {}
      const storage = {
        get: () => Promise.resolve({}),
        set: (items: Record<string, unknown>) => {
          if (PENDING_BYPASSES_NAME in items) return Promise.reject(new Error('quota'))
          Object.assign(flags, items)
          return Promise.resolve()
        },
      }
      const diagnose = vi.fn()
      const recorder = new BypassRecorder(
        () => Promise.reject(new Error('idb.unavailable')),
        storage,
        diagnose
      )

      expect(await recorder.record(EVENT, EVENT.occurredAt)).toBe('unrecorded')
      expect(flags).toEqual({ [BYPASS_UNRECORDED_NAME]: true })
      expect(diagnose).toHaveBeenCalledWith('bypass.unrecorded')
    })

    it('when_the_grant_cannot_be_stored_the_tab_still_gets_through', async () => {
      const harness = gateHarness()
      await arrive(harness)
      await harness.controller.emergency(TAB)
      harness.clock.advanceSeconds(120)
      harness.state.escalationWritesFail = true

      expect(await harness.controller.emergencyDone(TAB)).toEqual({
        kind: 'pass',
        url: REDDIT_POST,
      })
      expect(harness.state.bypasses).toHaveLength(1)
      expect(harness.state.passes.at(-1)).toEqual({ tabId: TAB, url: REDDIT_POST })
      expect(harness.state.diagnostics).toContain('escalation.unsaved')
    })
  })

  describe('stored escalation is validated entry by entry', () => {
    it('one_corrupt_entry_leaves_the_other_groups_levels_intact', async () => {
      const harness = gateHarness()
      const xState = {
        ...initialEscalationState('starter-x-friction'),
        attemptCount: 2,
        lastAttemptAt: '2026-01-05T08:59:00Z',
        lastActivityAt: '2026-01-05T08:59:00Z',
      }
      await fakeBrowser.storage.local.set({
        [ESCALATION_NAME]: [
          { ...initialEscalationState(REDDIT_GROUP), phase: 'dancing' },
          { ...initialEscalationState('bad-instant'), lastActivityAt: 'yesterday' },
          xState,
        ],
      })

      expect(await harness.escalation.all()).toEqual([xState])
      expect(
        harness.state.diagnostics.filter((code) => code === 'escalation.invalidEntryDropped')
      ).toHaveLength(2)
      const view = await arrive(harness, 'https://x.com/home')
      expect(view).toMatchObject({ kind: 'friction', gate: { level: 2 } })
      expect((await harness.decisions.decide(REDDIT_POST)).access).toBe('gate')
    })
  })

  describe('a clock set back fails toward friction', () => {
    it('an_active_intention_ends_when_the_clock_goes_back', async () => {
      const harness = gateHarness()
      await commitIntention(harness, 15)
      expect((await harness.decisions.decide(REDDIT_POST)).reason).toBe('intention_active')
      const changes = harness.state.changes

      harness.clock.set('2026-01-05T08:00:00Z')
      await harness.controller.checkClock()

      expect((await harness.escalation.get(REDDIT_GROUP)).phase).toBe('idle')
      expect((await harness.decisions.decide(REDDIT_POST)).access).toBe('gate')
      expect(harness.state.changes).toBeGreaterThan(changes)
      expect(harness.state.diagnostics).toContain('clock.rewound')
    })

    it('an_active_override_ends_when_the_clock_goes_back', async () => {
      const harness = gateHarness()
      await waitForOverride(harness)

      harness.clock.set('2026-01-05T08:00:00Z')
      await harness.controller.checkClock()

      const state = await harness.escalation.get(REDDIT_GROUP)
      expect(state.phase).toBe('idle')
      expect(state.attemptCount).toBe(1)
      expect((await harness.decisions.decide(REDDIT_POST)).access).toBe('gate')
    })
  })

  describe('open tabs follow the redirects', () => {
    it('a_sweep_sends_open_tabs_that_are_now_gated_to_the_gate', async () => {
      const harness = gateHarness()
      harness.state.openTabs = [
        { id: 9, url: REDDIT_POST },
        { id: 10, url: 'https://www.youtube.com/watch?v=abcdefghijk' },
      ]

      expect(await harness.controller.sweep()).toBe(1)

      expect(harness.state.navigations).toEqual([{ tabId: 9, url: GATE_URL }])
    })

    it('a_timed_out_page_with_the_overlay_is_left_to_it_and_one_without_goes_to_the_gate', async () => {
      const harness = gateHarness()
      await commitIntention(harness)
      harness.state.openTabs = [{ id: 9, url: REDDIT_POST }]
      harness.clock.advanceSeconds(300)
      await harness.controller.tick()
      expect((await harness.escalation.get(REDDIT_GROUP)).phase).toBe('timed_out')

      expect(await harness.controller.sweep()).toBe(0)
    })
  })

  describe('gate commands stay in their lane', () => {
    it('search_only_works_from_a_friction_view', async () => {
      const harness = gateHarness()
      await waitForOverride(harness)
      harness.state.passes.length = 0
      harness.clock.advanceSeconds(16 * 60)

      await harness.controller.tick()
      await harness.controller.emergency(TAB)
      const view = await harness.controller.search(TAB, 'bread')

      expect(view.kind).toBe('waiting')
      expect(harness.state.passes).toEqual([])
    })

    it('a_url_too_long_for_an_exact_pass_has_nothing_to_continue_to', async () => {
      const harness = gateHarness()
      const long = `https://www.youtube.com/watch?v=abcdefghijk&t=${'1'.repeat(1100)}`

      expect(await harness.controller.load(TAB, await harness.handoff(long))).toEqual({
        kind: 'none',
      })
      expect(harness.state.diagnostics).toContain('pass.urlTooLong')
    })
  })

  describe('an engine error on the gate', () => {
    it('offers_continue_with_feeds_hidden_and_emergency', async () => {
      const harness = gateHarness({ ruleset: gatedRuleset({ timeZone: 'Not/AZone' }) })

      expect(await arrive(harness)).toMatchObject({
        kind: 'blocked',
        reason: 'engine_error',
        emergencyAvailable: true,
        continueAvailable: true,
      })
      expect(await harness.controller.continueThroughError(TAB)).toEqual({
        kind: 'pass',
        url: REDDIT_POST,
      })
      expect(await harness.controller.emergency(TAB)).toEqual({ kind: 'pass', url: REDDIT_POST })
    })
  })
})
