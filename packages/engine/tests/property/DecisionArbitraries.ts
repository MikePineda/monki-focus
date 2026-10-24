// SPDX-License-Identifier: AGPL-3.0-or-later
/** fast-check generators of synthetic decision inputs (generic domains, ids and zones). */
import fc from 'fast-check'
import type {
  CategoryAssignment,
  DecisionState,
  EscalationState,
  Observation,
  Rule,
  RuleSchedule,
  Ruleset,
  Target,
  VerifiedUnlock,
  Weekday,
} from '@monki-focus/rules'

const DOMAINS = [
  'reddit.com',
  'www.reddit.com',
  'old.reddit.com',
  'x.com',
  'twitter.com',
  'youtube.com',
  'm.youtube.com',
  'instagram.com',
  'news.example.org',
]
const PATHS = [
  '/r/*',
  '/r/AskHistorians/**',
  '/watch',
  '/**',
  '/shorts/**',
  '/home',
  '/*/status/**',
]
const SURFACES = [
  'reddit.feed',
  'reddit.permalink',
  'reddit.search',
  'x.home',
  'x.status',
  'youtube.home',
  'youtube.shorts',
  'youtube.watch',
  'instagram.reels',
  'instagram.reel_from_dm',
]
const PACKAGES = ['com.instagram.android', 'com.reddit.frontpage', 'com.example.reader']
const URLS = [
  'reddit.com',
  'https://www.reddit.com/',
  'https://www.reddit.com/r/AskHistorians/',
  'https://old.reddit.com/r/AskHistorians/comments/xyz789/a_question/',
  'https://www.reddit.com/search/?q=history',
  'x.com/home',
  'https://twitter.com/someone/status/123',
  'm.youtube.com',
  'https://www.youtube.com/shorts/abc123DEF45',
  'https://www.youtube.com/watch?v=abc123DEF45',
  'https://www.instagram.com/reels/',
  'news.example.org',
  'https://news.example.org/today',
  'chrome://settings/',
  'https://www.reddit.com/r%2fAskHistorians',
]
const ZONES = ['UTC', 'Australia/Sydney', 'Europe/London', 'Pacific/Honolulu']
const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const TIMES = ['00:00', '07:00', '09:00', '17:30', '22:00', '22:30']
const RULE_IDS = ['r-a', 'r-b', 'r-c', 'r-d', 'r-e', 'r-f', 'r-g', 'r-h']

/** Instants around the week of 2026-10-26 (whole seconds). */
const START = Date.parse('2026-10-24T00:00:00Z') / 1000
const instant = fc
  .integer({ min: START, max: START + 9 * 86_400 })
  .map((seconds) => `${new Date(seconds * 1000).toISOString().slice(0, 19)}Z`)

const target: fc.Arbitrary<Target> = fc.oneof(
  fc.record({ kind: fc.constant('site' as const), domain: fc.constantFrom(...DOMAINS) }),
  fc.record({
    kind: fc.constant('site' as const),
    domain: fc.constantFrom(...DOMAINS),
    path: fc.constantFrom(...PATHS),
  }),
  fc.record({ kind: fc.constant('surface' as const), surface: fc.constantFrom(...SURFACES) }),
  fc.record({ kind: fc.constant('app' as const), package: fc.constantFrom(...PACKAGES) })
)

const schedule = fc.record({
  days: fc.subarray(WEEKDAYS, { minLength: 1 }),
  start: fc.constantFrom(...TIMES),
  end: fc.constantFrom(...TIMES),
})
const ruleSchedules: fc.Arbitrary<RuleSchedule[]> = fc.oneof(
  fc.constant<RuleSchedule[]>([]),
  fc.array(schedule, { minLength: 1, maxLength: 2 }),
  fc.constant<RuleSchedule[]>([{ ref: 'workHours' }])
)

function ruleWithId(id: string): fc.Arbitrary<Rule> {
  return fc
    .record({
      target,
      mode: fc.constantFrom('allow', 'hide-feed', 'friction', 'block'),
      schedules: ruleSchedules,
      enabled: fc.constantFrom(true, true, true, true, false),
      budget: fc.option(fc.constantFrom(1, 15, 30), { nil: undefined }),
    })
    .map(({ budget, ...rule }): Rule => {
      const base: Rule = { id, ...rule }
      return budget === undefined || rule.mode === 'hide-feed'
        ? base
        : { ...base, dailyBudgetMinutes: budget }
    })
}

const rules: fc.Arbitrary<Rule[]> = fc
  .subarray(RULE_IDS, { maxLength: 6 })
  .chain((ids) => fc.tuple(...ids.map(ruleWithId)))

const categories: fc.Arbitrary<CategoryAssignment[]> = fc.uniqueArray(
  fc.record({
    target,
    level: fc.constantFrom(0, 25, 50, 75, 100),
    category: fc.constantFrom('social', 'reading', 'video'),
  }),
  { maxLength: 3, selector: (assignment) => JSON.stringify(assignment.target) }
)

export const ruleset: fc.Arbitrary<Ruleset> = fc
  .record({
    timeZone: fc.constantFrom(...ZONES),
    pending: fc.option(fc.constantFrom(...ZONES), { nil: undefined }),
    rules,
    categories,
    bedtimeEnabled: fc.boolean(),
    bedtimeStart: fc.constantFrom('22:30', '21:00', '00:00'),
  })
  .map(
    ({
      timeZone,
      pending,
      rules: ruleList,
      categories: assignments,
      bedtimeEnabled,
      bedtimeStart,
    }) => ({
      schemaVersion: 1 as const,
      revision: 1,
      updatedAt: '2026-01-01T00:00:00Z',
      timeZone,
      ...(pending === undefined ? {} : { pendingTimeZone: pending }),
      rules: ruleList,
      categories: assignments,
      bedtime: {
        enabled: bedtimeEnabled,
        days: [...WEEKDAYS],
        start: bedtimeStart,
        end: '07:00',
        warnMinutesBefore: 30,
      },
      workHours: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:00', end: '17:30' },
    })
  )

export const observation: fc.Arbitrary<Observation> = fc.oneof(
  fc.record({ kind: fc.constant('site' as const), urlText: fc.constantFrom(...URLS) }),
  fc.record({
    kind: fc.constant('app' as const),
    package: fc.constantFrom(...PACKAGES),
    surface: fc.option(fc.constantFrom(...SURFACES), { nil: null }),
  })
)

const nullableInstant = fc.option(instant, { nil: null })

const escalationState = (targetGroup: string): fc.Arbitrary<EscalationState> =>
  fc.record({
    targetGroup: fc.constant(targetGroup),
    phase: fc.constantFrom(
      'idle',
      'pausing',
      'asking',
      'active',
      'timed_out',
      'override_waiting',
      'override_active'
    ),
    attemptCount: fc.integer({ min: 0, max: 6 }),
    lastAttemptAt: nullableInstant,
    lastActivityAt: nullableInstant,
    brokenCount: fc.integer({ min: 0, max: 4 }),
    lastFrictionType: fc.option(
      fc.constantFrom('countdown', 'breath', 'reflect', 'type-intention'),
      {
        nil: null,
      }
    ),
    gate: fc.constant(null),
    pauseEndsAt: nullableInstant,
    pendingExtension: fc.boolean(),
    intentionExpiresAt: nullableInstant,
    overrideReadyAt: nullableInstant,
    overrideEndsAt: nullableInstant,
  })

const unlock: fc.Arbitrary<VerifiedUnlock> = fc.record({
  target,
  notBefore: instant,
  expiresAt: instant,
})

export const decisionState: fc.Arbitrary<DecisionState> = fc
  .record({
    groups: fc.subarray([...RULE_IDS, 'bedtime'], { maxLength: 4 }),
    usageDate: fc.option(fc.constantFrom('2026-10-25', '2026-10-26', '2026-10-27'), { nil: null }),
    usageSeconds: fc.dictionary(fc.constantFrom(...RULE_IDS), fc.integer({ min: 0, max: 3600 })),
    unlocks: fc.array(unlock, { maxLength: 2 }),
    guardianLinked: fc.boolean(),
  })
  .chain(({ groups, usageDate, usageSeconds, unlocks, guardianLinked }) =>
    fc.tuple(...groups.map(escalationState)).map((escalation) => ({
      escalation,
      usage: usageDate === null ? null : { localDate: usageDate, secondsByRule: usageSeconds },
      unlocks,
      guardianLinked,
    }))
  )

export const now = instant
