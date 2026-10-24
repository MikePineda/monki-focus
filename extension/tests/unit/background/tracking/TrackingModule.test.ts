// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { IDLE_DETECTION_SECONDS } from '../../../../src/background/tracking/IdleWatcher'
import { BUCKET, startTracking, type TrackingHarness } from '../../../support/trackingHarness'

const START = '2026-01-05T09:00:00Z'
const DAY = ['2026-01-05T00:00:00Z', '2026-01-06T00:00:00Z'] as const

async function eventsOf(harness: TrackingHarness) {
  return (await harness.events.between(BUCKET, ...DAY)).map((event) => ({
    timestamp: event.timestamp,
    duration: event.duration,
    domain: 'domain' in event.data ? event.data.domain : null,
  }))
}

/** Opens `url` in the focused window and lets the immediate pulse land. */
async function visit(harness: TrackingHarness, url: string, extra: { audible?: boolean } = {}) {
  harness.browser.activate({ url, ...extra })
  await harness.settle()
}

describe('tracking module', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('start_registers_the_pulse_alarm_every_half_minute_and_idle_detection_at_60_s', async () => {
    const harness = await startTracking({ now: START })

    await vi.waitFor(async () =>
      expect(await fakeBrowser.alarms.get('pulse')).toMatchObject({ periodInMinutes: 0.5 })
    )
    expect(await fakeBrowser.alarms.get('aggregate')).toMatchObject({ periodInMinutes: 5 })
    expect(harness.browser.detectionInterval).toBe(IDLE_DETECTION_SECONDS)
  })

  it('focused_tab_time_accumulates_into_one_event', async () => {
    const harness = await startTracking({ now: START })
    await visit(harness, 'https://news.example/')

    await harness.alarmPulseAfter(30)
    await harness.alarmPulseAfter(30)

    expect(await eventsOf(harness)).toEqual([
      { timestamp: START, duration: 60, domain: 'news.example' },
    ])
  })

  it('switching_tabs_closes_the_previous_site_at_the_switch', async () => {
    const harness = await startTracking({ now: START })
    await visit(harness, 'https://news.example/')
    await harness.alarmPulseAfter(30)

    harness.clock.advanceSeconds(10)
    await visit(harness, 'https://docs.example/guide')

    expect(await eventsOf(harness)).toEqual([
      { timestamp: START, duration: 40, domain: 'news.example' },
      { timestamp: '2026-01-05T09:00:40Z', duration: 0, domain: 'docs.example' },
    ])
  })

  it('navigating_in_the_same_tab_opens_a_new_event_when_the_path_changes', async () => {
    const harness = await startTracking({ now: START })
    await visit(harness, 'https://news.example/a')

    harness.clock.advanceSeconds(12)
    harness.browser.navigate('https://news.example/b')
    await harness.settle()

    const events = await harness.events.between(BUCKET, ...DAY)
    expect(
      events.map((event) => [event.duration, 'path' in event.data && event.data.path])
    ).toEqual([
      [12, '/a'],
      [0, '/b'],
    ])
  })

  it('losing_focus_ends_the_event_when_focus_left_once_the_grace_passes', async () => {
    const harness = await startTracking({ now: START })
    await visit(harness, 'https://news.example/')
    await harness.alarmPulseAfter(30)

    harness.clock.advanceSeconds(5)
    harness.browser.blur()
    harness.clock.advanceSeconds(2)
    harness.timer.fireAll()
    await harness.settle()
    await harness.alarmPulseAfter(30)

    expect(await eventsOf(harness)).toEqual([
      { timestamp: START, duration: 35, domain: 'news.example' },
    ])
  })

  it('window_none_that_recovers_within_the_grace_keeps_one_event', async () => {
    const harness = await startTracking({ now: START })
    await visit(harness, 'https://news.example/')
    await harness.alarmPulseAfter(30)

    harness.browser.blur()
    harness.clock.advanceSeconds(1)
    harness.browser.refocus()
    await harness.settle()
    harness.timer.fireAll()
    await harness.alarmPulseAfter(29)

    expect(await eventsOf(harness)).toEqual([
      { timestamp: START, duration: 60, domain: 'news.example' },
    ])
  })

  it('a_pulse_inside_the_grace_still_counts_the_window', async () => {
    const harness = await startTracking({ now: START })
    await visit(harness, 'https://news.example/')

    harness.clock.advanceSeconds(29)
    harness.browser.blur()
    await harness.alarmPulseAfter(1)

    expect(await eventsOf(harness)).toEqual([
      { timestamp: START, duration: 30, domain: 'news.example' },
    ])
  })

  it('idle_time_on_a_silent_tab_is_never_counted', async () => {
    const harness = await startTracking({ now: START })
    await visit(harness, 'https://news.example/')
    await harness.alarmPulseAfter(30)

    harness.clock.advanceSeconds(30)
    harness.browser.setIdle('idle')
    await harness.settle()
    await harness.alarmPulseAfter(30)
    await harness.alarmPulseAfter(30)

    expect(await eventsOf(harness)).toEqual([
      { timestamp: START, duration: 30, domain: 'news.example' },
    ])
  })

  it('audible_active_tab_keeps_counting_while_idle', async () => {
    const harness = await startTracking({ now: START })
    await visit(harness, 'https://lectures.example/talk', { audible: true })

    harness.browser.setIdle('idle')
    await harness.settle()
    await harness.alarmPulseAfter(30)
    await harness.alarmPulseAfter(30)

    expect(await eventsOf(harness)).toEqual([
      { timestamp: START, duration: 60, domain: 'lectures.example' },
    ])
  })

  it('service_worker_death_restores_the_open_heartbeat_from_session_storage', async () => {
    const first = await startTracking({ now: START })
    await visit(first, 'https://news.example/')
    await first.alarmPulseAfter(30)

    // The worker dies: every module is evaluated again; storage.session and
    // IndexedDB survive, in-memory state does not.
    vi.resetModules()
    const second = await startTracking({
      now: START,
      db: first.db,
      clock: first.clock,
      activeTab: { url: 'https://news.example/' },
      load: () => import('../../../../src/background/tracking/TrackingModule'),
    })
    await second.alarmPulseAfter(30)

    expect(await eventsOf(second)).toEqual([
      { timestamp: START, duration: 60, domain: 'news.example' },
    ])
  })

  it('titles_never_reach_the_event_store_by_default', async () => {
    const harness = await startTracking({ now: START })
    harness.browser.activate({ url: 'https://news.example/', title: 'A private headline' })
    await harness.settle()
    await harness.alarmPulseAfter(30)

    const events = await harness.events.between(BUCKET, ...DAY)
    expect(events).toHaveLength(1)
    expect(JSON.stringify(events)).not.toContain('headline')
  })

  it('stats_today_reports_the_time_of_a_visited_domain', async () => {
    const harness = await startTracking({ now: START })
    await visit(harness, 'https://www.reddit.com/r/sub/')
    await harness.alarmPulseAfter(30)
    await harness.alarmPulseAfter(30)
    await harness.alarmPulseAfter(30)

    const stats = await harness.module.commands.today()

    expect(stats).toMatchObject({
      date: '2026-01-05',
      pulse: 0,
      totalSeconds: 90,
      levels: { 0: 90, 1: 0, 2: 0, 3: 0, 4: 0 },
      topActivities: [{ activityKey: 'reddit.com', seconds: 90, level: 0 }],
    })
  })

  it('stats_week_ends_with_today', async () => {
    const harness = await startTracking({ now: START })
    await visit(harness, 'https://github.com/')
    await harness.alarmPulseAfter(30)

    const week = await harness.module.commands.week()

    expect(week.days.at(-1)).toEqual({ date: '2026-01-05', pulse: 100, totalSeconds: 30 })
  })
})
