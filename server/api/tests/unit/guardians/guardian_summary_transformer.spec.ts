// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import {
  guardianSummaryResource,
  type GuardianSummaryInput,
} from '#transformers/guardian_summary_transformer'

const T0 = new Date('2026-01-05T09:00:00Z')

/** Field names that would carry what the guardian must never see. */
const FORBIDDEN_KEY =
  /url|title|domain|host|path|site|^app$|appid|package|bundle|name|email|uuid|token|topic|text|query|dedupe/i

/** Every key of a JSON value, at any depth. */
function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf)
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)])
  }
  return []
}

/** Every string value of a JSON value, at any depth. */
function stringsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringsOf)
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringsOf)
  return []
}

/** A ward's data as a careless (or hostile) caller could hand it over. */
function hostileInput(): GuardianSummaryInput {
  const event = {
    id: 9,
    kind: 'emergency_override',
    source: 'client',
    occurredAt: T0,
    resolvedAt: null,
    acknowledgedAt: null,
    details: {
      scope: 'rule',
      waitSeconds: 120,
      url: 'https://www.example.com/r/feed',
      title: 'A page title',
      domain: 'example.com',
      appId: 'com.example.app',
      note: 'free text with spaces',
      nested: { url: 'https://example.com' },
      host: 'example.com',
    },
    url: 'https://www.example.com/r/feed',
    title: 'A page title',
    deviceName: 'Phone of the ward',
    deviceUuid: '6f1c2d3e-4b5a-4c6d-8e7f-90a1b2c3d4e5',
    dedupeKey: 'c:abc:1',
  }
  return {
    wardUserId: 3,
    generatedAt: T0,
    score: { today: 72, last7Days: 64 },
    unlocks: { requested: 2, approved: 1, denied: 1 },
    bypasses: { last7Days: 1, unresolved: 0, recent: [event] },
  } as unknown as GuardianSummaryInput
}

test.group('Guardian summary transformer', () => {
  test('test_guardian_payload_never_contains_titles_or_urls', ({ assert }) => {
    const resource = guardianSummaryResource(hostileInput())
    const json = JSON.stringify(resource)

    assert.deepEqual(
      keysOf(resource).filter((key) => FORBIDDEN_KEY.test(key)),
      [],
      'no key names a URL, title, domain, app, device or secret'
    )
    const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    for (const value of stringsOf(resource).filter((text) => !timestamp.test(text))) {
      assert.notMatch(value, /https?:|\.|\s|@|\//, `string value ${value}`)
    }
    assert.notInclude(json, 'example.com')
    assert.notInclude(json, 'A page title')
    assert.notInclude(json, 'Phone of the ward')
  })

  test('test_the_summary_is_exactly_score_unlocks_and_bypasses', ({ assert }) => {
    const resource = guardianSummaryResource(hostileInput())

    assert.deepEqual(Object.keys(resource).sort(), [
      'bypasses',
      'generatedAt',
      'score',
      'unlocks',
      'wardUserId',
    ])
    assert.deepEqual(resource.score, { today: 72, last7Days: 64 })
    assert.deepEqual(resource.unlocks, { last7Days: { requested: 2, approved: 1, denied: 1 } })
    assert.deepEqual(Object.keys(resource.bypasses).sort(), ['last7Days', 'recent', 'unresolved'])
    assert.deepEqual(resource.bypasses.recent, [
      {
        id: 9,
        kind: 'emergency_override',
        source: 'client',
        details: { scope: 'rule', waitSeconds: 120 },
        occurredAt: '2026-01-05T09:00:00.000Z',
        resolvedAt: null,
        acknowledgedAt: null,
      },
    ])
  })

  test('test_only_code_like_detail_values_survive', ({ assert }) => {
    const input = hostileInput()
    const event = input.bypasses.recent[0] as { details: Record<string, unknown> }
    event.details = {
      announced: true,
      gapSeconds: 3600,
      platform: 'android',
      scope: 'Reddit Front Page',
      fromHours: 1.5,
      huge: Number.MAX_SAFE_INTEGER + 2,
      list: ['rule'],
    }

    const details = guardianSummaryResource(input).bypasses.recent[0].details

    assert.deepEqual(details, { announced: true, gapSeconds: 3600, platform: 'android' })
  })
})
