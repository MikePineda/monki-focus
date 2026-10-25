// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { IntentionNotes } from '../../../../src/background/gate/IntentionNotes'
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

function friction(view: GateView) {
  if (view.kind !== 'friction') throw new Error(`expected a friction view, got ${view.kind}`)
  return view
}

/** Arrives at the gate for `url` through the DNR hand-off. */
async function arrive(harness: Harness, url = REDDIT_POST): Promise<GateView> {
  return harness.controller.load(TAB, await harness.handoff(url))
}

/** Arrives, waits out the pause and answers the asking view. */
async function arriveAndAsk(harness: Harness): Promise<GateView> {
  const view = friction(await arrive(harness))
  harness.clock.advanceSeconds(view.gate.pauseSeconds)
  return harness.controller.pauseDone(TAB)
}

describe('GateController', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('first_visit_starts_a_level_0_countdown_pause_from_the_engine', async () => {
    const harness = gateHarness()

    const view = friction(await arrive(harness))

    expect(view.phase).toBe('pausing')
    expect(view.gate).toMatchObject({ level: 0, pauseSeconds: 5, frictionType: 'countdown' })
    expect(view.pauseEndsAtMs).toBe(Date.parse('2026-01-05T09:00:05Z'))
    expect(view.context).toEqual({ site: 'reddit.com', visitsToday: 1, minutesToday: 12 })
    expect((await harness.escalation.get(REDDIT_GROUP)).attemptCount).toBe(1)
  })

  it('reloading_the_gate_does_not_reset_the_pause', async () => {
    const harness = gateHarness()
    const first = friction(await arrive(harness))
    harness.clock.advanceSeconds(3)

    const reloaded = friction(await harness.controller.load(TAB, null))

    expect(reloaded.pauseEndsAtMs).toBe(first.pauseEndsAtMs)
    expect((await harness.escalation.get(REDDIT_GROUP)).attemptCount).toBe(1)
  })

  it('service_worker_death_mid_pause_keeps_the_pause_and_the_destination', async () => {
    const harness = gateHarness()
    const first = friction(await arrive(harness))
    harness.clock.advanceSeconds(2)

    harness.restart()
    const after = friction(await harness.controller.load(TAB, null))

    expect(after.phase).toBe('pausing')
    expect(after.pauseEndsAtMs).toBe(first.pauseEndsAtMs)
  })

  it('pause_done_before_the_pause_ends_changes_nothing', async () => {
    const harness = gateHarness()
    await arrive(harness)
    harness.clock.advanceSeconds(2)

    expect(friction(await harness.controller.pauseDone(TAB)).phase).toBe('pausing')
  })

  it('pause_done_after_the_pause_asks_for_the_intention', async () => {
    expect(friction(await arriveAndAsk(gateHarness())).phase).toBe('asking')
  })

  it('gate_ignores_destination_in_query', async () => {
    const harness = gateHarness()

    const forged = await harness.controller.load(TAB, {
      ticket: 'abcdefghijklmnopqrstuvwxyzabcdef',
      to: 'https://evil.example/',
    })

    expect(forged).toEqual({ kind: 'none' })
    expect(harness.state.passes).toEqual([])
    expect(harness.state.navigations).toEqual([])
  })

  it('a_gate_opened_without_a_hand_off_has_nothing_to_continue_to', async () => {
    expect(await gateHarness().controller.load(TAB, null)).toEqual({ kind: 'none' })
  })

  it('committing_lifts_the_gate_passes_the_tab_and_records_the_commitment', async () => {
    const harness = gateHarness()
    await arriveAndAsk(harness)

    const result = await harness.controller.commit(TAB, 10, 'reply to one message')

    expect(result).toEqual({ accepted: true, view: { kind: 'pass', url: REDDIT_POST } })
    expect(harness.state.passes).toEqual([{ tabId: TAB, url: REDDIT_POST }])
    const state = await harness.escalation.get(REDDIT_GROUP)
    expect(state.phase).toBe('active')
    expect(state.intentionExpiresAt).toBe('2026-01-05T09:10:05Z')
    expect(harness.state.log.map((entry) => entry.kind)).toEqual(['visit', 'committed'])
  })

  it('level_2_needs_three_words_different_from_the_last_intention', async () => {
    const harness = gateHarness()
    for (const intention of ['check one thing now', 'look up a recipe']) {
      await arriveAndAsk(harness)
      await harness.controller.commit(TAB, 5, intention)
      await harness.controller.leave(TAB)
    }
    const third = friction(await arriveAndAsk(harness))
    expect(third.gate).toMatchObject({ level: 2, requiresTypedIntention: true })

    expect(await harness.controller.commit(TAB, 5, 'just browsing')).toEqual({
      accepted: false,
      rejection: 'intention.tooFewWords',
    })
    expect(await harness.controller.commit(TAB, 5, 'Look up a  RECIPE')).toEqual({
      accepted: false,
      rejection: 'intention.sameAsLast',
    })
    expect((await harness.controller.commit(TAB, 5, 'reply to one message')).accepted).toBe(true)
    expect((await harness.escalation.get(REDDIT_GROUP)).phase).toBe('active')
  })

  it('close_ends_the_attempt_records_a_close_and_closes_the_tab', async () => {
    const harness = gateHarness()
    await arrive(harness)

    expect(await harness.controller.close(TAB)).toEqual({ closed: true })

    expect(harness.state.closed).toEqual([TAB])
    expect((await harness.escalation.get(REDDIT_GROUP)).phase).toBe('idle')
    expect(harness.state.log.at(-1)?.kind).toBe('closed')
  })

  it('the_next_visit_after_a_close_is_level_1', async () => {
    const harness = gateHarness()
    await arrive(harness)
    await harness.controller.close(TAB)

    const view = friction(await arrive(harness))

    expect(view.gate).toMatchObject({ level: 1, pauseSeconds: 15 })
    expect(view.context.visitsToday).toBe(2)
  })

  it('a_more_specific_friction_rule_inherits_the_escalation_of_the_pages_friction_candidates', async () => {
    const harness = gateHarness()
    await arrive(harness)
    await harness.controller.close(TAB)
    const subRule = {
      id: 'reddit-sub-friction',
      target: { kind: 'site' as const, domain: 'reddit.com', path: '/r/examplesub/**' },
      mode: 'friction' as const,
      schedules: [],
      enabled: true,
    }
    harness.state.ruleset = {
      ...harness.state.ruleset,
      rules: [...harness.state.ruleset.rules, subRule],
    }

    const view = friction(await arrive(harness))

    expect(view.gate).toMatchObject({ level: 1, pauseSeconds: 15 })
    expect((await harness.escalation.get('reddit-sub-friction')).attemptCount).toBe(2)
  })

  it('a_typed_intention_only_has_to_differ_from_its_own_groups_last_one', async () => {
    const harness = gateHarness()
    for (const intention of ['check one thing now', 'look up a recipe']) {
      await arriveAndAsk(harness)
      await harness.controller.commit(TAB, 5, intention)
      await harness.controller.leave(TAB)
    }
    await arriveAndAsk(harness)
    await new IntentionNotes(fakeBrowser.storage.session).save('starter-x-friction', {
      text: 'reply to one message',
      minutes: 5,
    })

    expect((await harness.controller.commit(TAB, 5, 'Reply to one message')).accepted).toBe(true)
  })

  it('the_level_line_announces_the_next_pause_from_the_engine', async () => {
    const view = friction(await arrive(gateHarness()))

    expect(view.level).toEqual({ level: 0, brokenToday: 0, nextPauseSeconds: 15 })
  })

  it('emergency_from_an_active_intention_waits_then_grants_access_and_records_a_bypass', async () => {
    const harness = gateHarness()
    await arriveAndAsk(harness)
    await harness.controller.commit(TAB, 15, '')
    // A budget runs out mid-intention: the page is blocked.
    harness.state.usage = { localDate: '2026-01-05', secondsByRule: { [REDDIT_GROUP]: 600 } }
    harness.state.ruleset = gatedRuleset({
      rules: gatedRuleset().rules.map((rule) =>
        rule.id === REDDIT_GROUP ? { ...rule, dailyBudgetMinutes: 10 } : rule
      ),
    })
    expect(await harness.controller.load(TAB, null)).toMatchObject({
      kind: 'blocked',
      reason: 'budget_exhausted',
      emergencyAvailable: true,
    })

    const waiting = await harness.controller.emergency(TAB)
    expect(waiting).toMatchObject({ kind: 'waiting', readyAtMs: harness.clock.now() + 120_000 })
    harness.clock.advanceSeconds(60)
    expect((await harness.controller.emergencyDone(TAB)).kind).toBe('waiting')
    harness.clock.advanceSeconds(60)

    expect(await harness.controller.emergencyDone(TAB)).toEqual({ kind: 'pass', url: REDDIT_POST })
    const state = await harness.escalation.get(REDDIT_GROUP)
    expect(state.phase).toBe('override_active')
    expect(harness.state.bypasses).toEqual([
      {
        dedupeKey: 'bypass-1',
        kind: 'emergency_override',
        occurredAt: state.lastActivityAt,
        details: {
          targetGroup: REDDIT_GROUP,
          waitEndedAt: state.lastActivityAt,
          grantedAt: state.lastActivityAt,
          endsAt: state.overrideEndsAt,
        },
      },
    ])
    expect(JSON.stringify(harness.state.bypasses)).not.toContain('reddit.com')
  })

  it('cancelling_the_emergency_wait_goes_back_to_the_gate', async () => {
    const harness = gateHarness()
    await arrive(harness)
    await harness.controller.emergency(TAB)

    const view = await harness.controller.emergencyCancel(TAB)

    expect(view.kind).toBe('friction')
    expect(harness.state.bypasses).toEqual([])
  })

  it('extend_from_the_timeout_doubles_the_pause_then_grants_five_minutes', async () => {
    const harness = gateHarness()
    await arriveAndAsk(harness)
    await harness.controller.commit(TAB, 5, 'reply to one message')
    harness.clock.advanceSeconds(300)
    const expired = await harness.controller.expired(REDDIT_POST)
    expect(expired.session).toMatchObject({
      phase: 'timed_out',
      minutes: 5,
      intention: 'reply to one message',
      nextPauseSeconds: 10,
      site: 'reddit.com',
    })

    expect(await harness.controller.extendFromPage(TAB, REDDIT_POST)).toEqual({ opened: true })
    expect(harness.state.navigations.at(-1)).toEqual({ tabId: TAB, url: GATE_URL })
    const pause = friction(await harness.controller.load(TAB, null))
    expect(pause).toMatchObject({ phase: 'pausing', extension: true })
    expect(pause.gate.pauseSeconds).toBe(10)
    expect(harness.state.log.at(-1)?.kind).toBe('broken')

    harness.clock.advanceSeconds(10)
    expect(await harness.controller.pauseDone(TAB)).toEqual({ kind: 'pass', url: REDDIT_POST })
    expect((await harness.escalation.get(REDDIT_GROUP)).intentionExpiresAt).toBe(
      '2026-01-05T09:10:15Z'
    )
  })

  it('leave_from_the_timeout_keeps_the_intention_and_closes_the_tab', async () => {
    const harness = gateHarness()
    await arriveAndAsk(harness)
    await harness.controller.commit(TAB, 5, '')
    harness.clock.advanceSeconds(300)
    await harness.controller.expired(REDDIT_POST)

    expect(await harness.controller.leaveFromPage(TAB, REDDIT_POST)).toEqual({ closed: true })

    expect((await harness.escalation.get(REDDIT_GROUP)).phase).toBe('idle')
    expect(harness.state.log.at(-1)?.kind).toBe('kept')
  })

  it('an_intention_that_ends_with_no_page_open_is_kept_by_the_timer', async () => {
    const harness = gateHarness()
    await arriveAndAsk(harness)
    await harness.controller.commit(TAB, 5, '')
    expect(await harness.controller.nextTimerAt()).toBe(Date.parse('2026-01-05T09:05:05Z'))
    harness.clock.advanceSeconds(300)

    await harness.controller.tick()

    expect((await harness.escalation.get(REDDIT_GROUP)).phase).toBe('idle')
    expect(harness.state.log.at(-1)?.kind).toBe('kept')
  })

  it('an_intention_that_ends_on_screen_times_out_for_the_overlay', async () => {
    const harness = gateHarness()
    await arriveAndAsk(harness)
    await harness.controller.commit(TAB, 5, '')
    harness.state.openPages = [REDDIT_POST]
    harness.clock.advanceSeconds(300)

    await harness.controller.tick()

    expect((await harness.escalation.get(REDDIT_GROUP)).phase).toBe('timed_out')
  })

  it('a_page_inside_an_intention_reports_its_session', async () => {
    const harness = gateHarness()
    await arriveAndAsk(harness)
    await harness.controller.commit(TAB, 10, 'reply to one message')

    const decision = await harness.decisions.decide(REDDIT_POST)

    expect(await harness.controller.sessionFor(REDDIT_POST, decision)).toEqual({
      phase: 'active',
      endsAtMs: Date.parse('2026-01-05T09:10:05Z'),
      minutes: 10,
      intention: 'reply to one message',
      nextPauseSeconds: 10,
      site: 'reddit.com',
    })
  })

  it('a_gated_page_asks_and_its_tab_goes_to_the_gate', async () => {
    const harness = gateHarness()

    expect(await harness.controller.open(TAB, REDDIT_POST)).toEqual({ opened: true })

    expect(harness.state.navigations).toEqual([{ tabId: TAB, url: GATE_URL }])
    expect(friction(await harness.controller.load(TAB, null)).context.site).toBe('reddit.com')
  })

  it('an_allowed_page_never_goes_to_the_gate', async () => {
    const harness = gateHarness()

    expect(
      await harness.controller.open(TAB, 'https://www.youtube.com/watch?v=abcdefghijk')
    ).toEqual({ opened: false })
    expect(harness.state.navigations).toEqual([])
  })

  it('the_gate_search_opens_the_site_search_and_never_gates_it', async () => {
    const harness = gateHarness()
    await arrive(harness)

    const view = await harness.controller.search(TAB, 'bread recipes')

    const url = 'https://www.reddit.com/search/?q=bread+recipes'
    expect(view).toEqual({ kind: 'pass', url })
    expect(harness.state.passes).toEqual([{ tabId: TAB, url }])
    expect(await harness.controller.open(TAB, url)).toEqual({ opened: false })
  })

  it('a_blocked_rule_offers_only_close_and_emergency', async () => {
    const harness = gateHarness({
      ruleset: gatedRuleset({
        rules: gatedRuleset().rules.map((rule) =>
          rule.id === REDDIT_GROUP ? { ...rule, mode: 'block' as const } : rule
        ),
      }),
    })

    expect(await arrive(harness)).toEqual({
      kind: 'blocked',
      context: { site: 'reddit.com', visitsToday: 0, minutesToday: 12 },
      reason: 'rule_match',
      emergencyAvailable: true,
      continueAvailable: false,
    })
  })
})
