// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Reference checker for fixture *shape*: invariants that JSON Schema cannot
 * express (cross-field consistency). It is not an engine; it only proves that
 * each fixture is internally coherent with SEMANTICS.md, so that a wrong
 * expectation cannot slip into every platform at once.
 */
import type {
  ActivityFixture,
  Decision,
  DecisionFixture,
  EscalationFixture,
  EscalationState,
  Gate,
  RuleChangeFixture,
  Ruleset,
} from './generated/SchemaTypes.ts'
import { isFixtureKind } from './FixtureKind.ts'

const BLOCK_SECONDS = 300

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function epochSeconds(instant: string): number {
  return Date.parse(instant) / 1000
}

/** Half-up rounding of a non-negative ratio, the pulse formula of SEMANTICS.md §10.5. */
function pulseOf(entries: { seconds: number; level: number }[]): number | null {
  const total = entries.reduce((sum, entry) => sum + entry.seconds, 0)
  if (total === 0) return null
  const weighted = entries.reduce((sum, entry) => sum + entry.seconds * entry.level, 0)
  return Math.floor((weighted * 2 + total) / (total * 2))
}

const ACCESS_REASONS: Record<Decision['access'], readonly Decision['reason'][]> = {
  block: ['rule_match', 'schedule_bedtime', 'budget_exhausted'],
  gate: ['intention_required'],
  allow: [
    'no_rule',
    'rule_match',
    'intention_active',
    'unlock_active',
    'emergency_active',
    'permalink_never_hidden',
    'path_unknown_allow',
    'not_a_feed',
  ],
}

/** The fixed mapping of SEMANTICS.md §5.3. */
export function explanationKeyOf(
  decision: Pick<Decision, 'access' | 'content' | 'reason'>
): string {
  if (decision.reason === 'rule_match') {
    if (decision.access === 'block') return 'decision.blocked_by_rule'
    return decision.content === 'hide-feed' ? 'decision.feed_hidden' : 'decision.allowed_by_rule'
  }
  return `decision.${decision.reason}`
}

function checkGate(gate: Gate, guardianLinked: boolean, where: string, problems: string[]): void {
  if (gate.requiresTypedIntention !== gate.level >= 2) {
    problems.push(`${where}: requiresTypedIntention must be true exactly from level 2`)
  }
  if (gate.requiresGuardianKey !== (gate.level === 3 && guardianLinked)) {
    problems.push(`${where}: requiresGuardianKey only at level 3 with a linked guardian`)
  }
  if (gate.level === 3 && !guardianLinked && gate.pauseSeconds !== 60) {
    problems.push(`${where}: level 3 without a guardian pauses 60 seconds`)
  }
}

function checkRuleset(ruleset: Ruleset, where: string, problems: string[]): void {
  const ids = ruleset.rules.map((rule) => rule.id)
  if (new Set(ids).size !== ids.length) problems.push(`${where}: rule ids must be unique`)
}

function checkDecision(fixture: DecisionFixture, problems: string[]): void {
  const { then, given } = fixture
  checkRuleset(given.ruleset, 'given.ruleset', problems)
  const groups = given.state.escalation.map((state) => state.targetGroup)
  if (new Set(groups).size !== groups.length)
    problems.push('given.state.escalation: one state per targetGroup')

  if (!ACCESS_REASONS[then.access].includes(then.reason)) {
    problems.push(`then.reason ${then.reason} cannot produce access ${then.access}`)
  }
  const expectedKey = explanationKeyOf(then)
  if (then.explanationKey !== expectedKey) {
    problems.push(`then.explanationKey must be ${expectedKey} for reason ${then.reason}`)
  }
  if (
    ['permalink_never_hidden', 'path_unknown_allow', 'not_a_feed'].includes(then.reason) &&
    then.content !== 'show'
  ) {
    problems.push(`then.content must be show for reason ${then.reason}`)
  }

  const nullRule = then.reason === 'no_rule' || then.reason === 'schedule_bedtime'
  const eitherRule = then.reason === 'unlock_active' || then.reason === 'emergency_active'
  if (nullRule && then.ruleId !== null)
    problems.push(`then.ruleId must be null for reason ${then.reason}`)
  if (!nullRule && !eitherRule && then.ruleId === null) {
    problems.push(`then.ruleId must name a rule for reason ${then.reason}`)
  }
  if (then.ruleId !== null) {
    const rule = given.ruleset.rules.find((candidate) => candidate.id === then.ruleId)
    if (!rule) {
      problems.push(`then.ruleId ${then.ruleId} is not a rule of given.ruleset`)
    } else {
      const expectedModes: Partial<Record<Decision['reason'], string>> = {
        intention_required: 'friction',
        intention_active: 'friction',
        permalink_never_hidden: 'hide-feed',
        path_unknown_allow: 'hide-feed',
        not_a_feed: 'hide-feed',
      }
      if (then.reason === 'rule_match') {
        expectedModes.rule_match =
          then.access === 'block' ? 'block' : then.content === 'hide-feed' ? 'hide-feed' : 'allow'
      }
      const expected = expectedModes[then.reason]
      if (expected !== undefined && rule.mode !== expected) {
        problems.push(
          `then.ruleId ${rule.id} has mode ${rule.mode}, reason ${then.reason} needs ${expected}`
        )
      }
      if (then.reason === 'budget_exhausted' && rule.dailyBudgetMinutes === undefined) {
        problems.push(`then.ruleId ${rule.id} has no dailyBudgetMinutes`)
      }
    }
  }
  if (then.gate) checkGate(then.gate, given.state.guardianLinked, 'then.gate', problems)
}

function checkStateShape(state: EscalationState, where: string, problems: string[]): void {
  const needs: Partial<Record<EscalationState['phase'], (keyof EscalationState)[]>> = {
    pausing: ['gate', 'pauseEndsAt'],
    asking: ['gate'],
    active: ['intentionExpiresAt'],
    override_waiting: ['overrideReadyAt'],
    override_active: ['overrideEndsAt'],
  }
  for (const field of needs[state.phase] ?? []) {
    if (state[field] === null) problems.push(`${where}: phase ${state.phase} needs ${field}`)
  }
  if (state.phase === 'idle' && state.gate !== null) problems.push(`${where}: idle has no gate`)
  if (state.gate !== null && state.lastFrictionType !== state.gate.frictionType) {
    problems.push(`${where}: lastFrictionType must equal the shown gate's frictionType`)
  }
}

function checkEscalation(fixture: EscalationFixture, problems: string[]): void {
  const { given, steps } = fixture
  const group = given.state.targetGroup
  checkStateShape(given.state, 'given.state', problems)
  let previousAt = Number.NEGATIVE_INFINITY
  let previousState = given.state
  let previousFriction = given.state.lastFrictionType
  steps.forEach((step, index) => {
    const where = `steps[${index}]`
    const at = epochSeconds(step.at)
    if (at < previousAt) problems.push(`${where}.at is earlier than the step before`)
    previousAt = at
    const state = step.then.state
    if (state.targetGroup !== group) problems.push(`${where}: targetGroup must stay ${group}`)
    checkStateShape(state, `${where}.then.state`, problems)
    const showsNewGate =
      (step.event.type === 'visit' || step.event.type === 'extend') &&
      state.gate !== null &&
      state.pauseEndsAt !== previousState.pauseEndsAt
    if (showsNewGate && state.gate) {
      if (state.gate.frictionType === previousFriction) {
        problems.push(`${where}: frictionType ${state.gate.frictionType} repeats the previous gate`)
      }
      previousFriction = state.gate.frictionType
      if (step.event.type === 'visit')
        checkGate(state.gate, given.guardianLinked, `${where}.then.state.gate`, problems)
    }
    if (
      step.then.effects.includes('record_bypass') &&
      step.event.type !== 'emergency_wait_elapsed'
    ) {
      problems.push(`${where}: only emergency_wait_elapsed records a bypass`)
    }
    previousState = state
  })
}

function checkRuleChange(fixture: RuleChangeFixture, problems: string[]): void {
  const { given, then } = fixture
  checkRuleset(given.old, 'given.old', problems)
  checkRuleset(given.new, 'given.new', problems)
  checkRuleset(then.effectiveToday, 'then.effectiveToday', problems)
  if (then.effectiveFrom === null && canonical(then.effectiveToday) !== canonical(given.new)) {
    problems.push('then.effectiveToday must equal given.new when nothing is deferred')
  }
  if (then.effectiveFrom !== null && epochSeconds(then.effectiveFrom) <= epochSeconds(given.now)) {
    problems.push('then.effectiveFrom must be after given.now')
  }
  if (then.effectiveToday.revision !== given.new.revision) {
    problems.push('then.effectiveToday carries the revision of given.new')
  }
}

function sortedBy<T>(items: T[], key: (item: T) => string): boolean {
  return items.every((item, index) => index === 0 || key(items[index - 1] as T) <= key(item))
}

function checkBlockCap(
  blocks: { blockStart: string; seconds: number; deviceId: string }[],
  perDevice: boolean,
  problems: string[]
): void {
  const totals = new Map<string, number>()
  for (const block of blocks) {
    const key = perDevice ? `${block.deviceId}|${block.blockStart}` : block.blockStart
    totals.set(key, (totals.get(key) ?? 0) + block.seconds)
  }
  for (const [key, total] of totals) {
    if (total > BLOCK_SECONDS)
      problems.push(`then.blocks: ${key} adds up to ${total} > 300 seconds`)
  }
}

function checkActivity(fixture: ActivityFixture, problems: string[]): void {
  switch (fixture.operation) {
    case 'pulse': {
      const expected = pulseOf(fixture.given.entries)
      if (fixture.then.pulse !== expected) problems.push(`then.pulse must be ${String(expected)}`)
      break
    }
    case 'daily-totals': {
      fixture.then.days.forEach((day, index) => {
        const levels = [0, 25, 50, 75, 100] as const
        const entries = levels.map((level) => ({ level, seconds: day.secondsByLevel[level] }))
        const sum = entries.reduce((total, entry) => total + entry.seconds, 0)
        if (sum !== day.seconds) problems.push(`then.days[${index}].seconds must equal its levels`)
        if (day.pulse !== pulseOf(entries)) problems.push(`then.days[${index}].pulse is wrong`)
      })
      if (!sortedBy(fixture.then.days, (day) => day.date))
        problems.push('then.days must be sorted by date')
      break
    }
    case 'blocks':
    case 'cross-device-cap': {
      const blocks = fixture.then.blocks
      checkBlockCap(blocks, fixture.operation === 'blocks', problems)
      const order = (b: (typeof blocks)[number]) =>
        `${b.blockStart}|${b.deviceId}|${b.activityKey ?? ''}|${b.categoryPath}`
      if (!sortedBy(blocks, order))
        problems.push(
          'then.blocks must be sorted by blockStart, deviceId, activityKey, categoryPath'
        )
      break
    }
    case 'heartbeat-merge':
    case 'active-time': {
      if (!sortedBy(fixture.then.events, (event) => event.timestamp)) {
        problems.push('then.events must be sorted by timestamp')
      }
      break
    }
    case 'browser-dedupe': {
      const segments = fixture.then.segments
      segments.forEach((segment, index) => {
        if (epochSeconds(segment.start) >= epochSeconds(segment.end)) {
          problems.push(`then.segments[${index}] must end after it starts`)
        }
      })
      if (!sortedBy(segments, (segment) => `${segment.start}|${segment.activityKey}`)) {
        problems.push('then.segments must be sorted by start')
      }
      break
    }
    case 'probe': {
      const { given, then } = fixture
      const tab = given.tab
      const counts =
        tab !== null &&
        given.windowFocused &&
        given.idleState !== 'locked' &&
        (given.idleState === 'active' || (tab.audible && given.settings.countAudibleWhileIdle))
      if (!counts && then.heartbeat !== null && tab !== null && /^https?:/i.test(tab.url)) {
        problems.push('then.heartbeat must be null: unfocused, locked or idle without sound')
      }
      if (then.heartbeat !== null) {
        if (then.heartbeat.timestamp !== given.now)
          problems.push('then.heartbeat.timestamp must be given.now')
        if (then.heartbeat.duration !== 0) problems.push('then.heartbeat.duration must be 0')
        if ('title' in then.heartbeat.data && !given.settings.storeTitles) {
          problems.push('then.heartbeat must not carry a title unless storeTitles')
        }
      }
      break
    }
    case 'categorise':
      break
  }
}

/** Returns every invariant the fixture violates; an empty list means coherent. */
export function checkFixtureInvariants(fixture: unknown): string[] {
  const problems: string[] = []
  const envelope = fixture as { id?: unknown; kind?: unknown } | null
  if (envelope === null || typeof envelope !== 'object') return ['fixture must be an object']
  if (!isFixtureKind(envelope.kind)) return [`unknown fixture kind: ${String(envelope.kind)}`]
  if (typeof envelope.id !== 'string' || !envelope.id.startsWith(`${envelope.kind}.`)) {
    problems.push(`id must start with ${envelope.kind}.`)
  }
  switch (envelope.kind) {
    case 'decision':
    case 'specificity':
      checkDecision(fixture as DecisionFixture, problems)
      break
    case 'escalation':
      checkEscalation(fixture as EscalationFixture, problems)
      break
    case 'rule-change':
      checkRuleChange(fixture as RuleChangeFixture, problems)
      break
    case 'activity':
      checkActivity(fixture as ActivityFixture, problems)
      break
    case 'url-normalize':
    case 'schedule':
      break
    case 'unlock-token':
      problems.push('unlock-token vectors live in packages/protocol')
      break
  }
  return problems
}
