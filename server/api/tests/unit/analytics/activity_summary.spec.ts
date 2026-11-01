// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import type { SyncBlock } from '@monki-focus/analytics'
import { summariseActivity, TOP_ACTIVITY_KEYS } from '#domain/analytics/activity_summary'
import { isLocalDate, localDateRange } from '#services/analytics/local_date_range'

function block(overrides: Partial<SyncBlock> = {}): SyncBlock {
  return {
    deviceId: 'device-a',
    blockStart: '2026-01-05T09:00:00Z',
    activityKey: 'example.com',
    categoryPath: 'development',
    level: 100,
    source: 'web',
    seconds: 120,
    ...overrides,
  }
}

test.group('Activity summary', () => {
  test('test_totals_are_split_per_level_and_the_pulse_is_weighted', ({ assert }) => {
    const summary = summariseActivity(
      [
        block({ seconds: 300 }),
        block({
          blockStart: '2026-01-05T09:05:00Z',
          activityKey: 'video.example',
          categoryPath: 'video',
          level: 0,
          seconds: 100,
        }),
      ],
      ['2026-01-05'],
      'UTC'
    )

    assert.equal(summary.seconds, 400)
    assert.deepEqual(summary.secondsByLevel, { '0': 100, '25': 0, '50': 0, '75': 0, '100': 300 })
    assert.equal(summary.pulse, 75)
    assert.deepEqual(summary.categories, [
      { categoryPath: 'development', level: 100, seconds: 300 },
      { categoryPath: 'video', level: 0, seconds: 100 },
    ])
    assert.deepEqual(
      summary.topActivityKeys.map((entry) => entry.activityKey),
      ['example.com', 'video.example']
    )
  })

  test('test_overlapping_devices_never_add_more_than_300_seconds_per_block', ({ assert }) => {
    const summary = summariseActivity(
      [block({ seconds: 300 }), block({ deviceId: 'device-b', source: 'android', seconds: 300 })],
      ['2026-01-05'],
      'UTC'
    )

    assert.equal(summary.seconds, 300)
  })

  test('test_a_day_without_time_has_zeros_and_a_null_pulse', ({ assert }) => {
    const summary = summariseActivity([], ['2026-01-05', '2026-01-06'], 'UTC')

    assert.isNull(summary.pulse)
    assert.deepEqual(
      summary.days.map((day) => [day.date, day.seconds, day.pulse]),
      [
        ['2026-01-05', 0, null],
        ['2026-01-06', 0, null],
      ]
    )
  })

  test('test_a_block_counts_on_its_local_date', ({ assert }) => {
    const summary = summariseActivity(
      [block({ blockStart: '2026-01-05T23:30:00Z' })],
      ['2026-01-05', '2026-01-06'],
      'Pacific/Auckland'
    )

    assert.deepEqual(
      summary.days.map((day) => day.seconds),
      [0, 120]
    )
  })

  test('test_blocks_without_a_key_count_in_totals_but_not_in_the_top_list', ({ assert }) => {
    const summary = summariseActivity([block({ activityKey: null })], ['2026-01-05'], 'UTC')

    assert.equal(summary.seconds, 120)
    assert.deepEqual(summary.topActivityKeys, [])
  })

  test('test_the_top_list_is_bounded', ({ assert }) => {
    const blocks = Array.from({ length: TOP_ACTIVITY_KEYS + 5 }, (_, index) =>
      block({
        blockStart: `2026-01-05T${String(index).padStart(2, '0')}:00:00Z`,
        activityKey: `site${index}.example`,
        seconds: index + 1,
      })
    )

    const summary = summariseActivity(blocks, ['2026-01-05'], 'UTC')

    assert.lengthOf(summary.topActivityKeys, TOP_ACTIVITY_KEYS)
    assert.equal(summary.topActivityKeys[0].activityKey, `site${TOP_ACTIVITY_KEYS + 4}.example`)
  })
})

test.group('Local date range', () => {
  test('test_a_day_follows_the_user_time_zone', ({ assert }) => {
    const range = localDateRange('2026-01-05', 1, 'America/New_York')

    assert.deepEqual(range.dates, ['2026-01-05'])
    assert.equal(range.from.toISO(), '2026-01-05T05:00:00.000Z')
    assert.equal(range.to.toISO(), '2026-01-06T05:00:00.000Z')
  })

  test('test_a_spring_forward_day_lasts_23_hours', ({ assert }) => {
    const range = localDateRange('2026-03-08', 1, 'America/New_York')

    assert.equal(range.to.diff(range.from, 'hours').hours, 23)
  })

  test('test_a_week_has_seven_local_dates', ({ assert }) => {
    const range = localDateRange('2026-01-05', 7, 'UTC')

    assert.deepEqual(range.dates, [
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
      '2026-01-10',
      '2026-01-11',
    ])
  })

  test('test_an_impossible_date_is_not_a_local_date', ({ assert }) => {
    assert.isFalse(isLocalDate('2026-02-30'))
    assert.isFalse(isLocalDate('2026-1-5'))
    assert.isTrue(isLocalDate('2026-01-05'))
  })
})
