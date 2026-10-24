// SPDX-License-Identifier: AGPL-3.0-or-later
import type {
  ActivityFixture,
  DecisionFixture,
  EscalationFixture,
  RuleChangeFixture,
  ScheduleFixture,
  UrlNormalizeFixture,
} from './generated/SchemaTypes.ts'
import type { LoadableFixtureKind } from './FixtureKind.ts'

/** The fixture type of each loadable kind (`specificity` shares the decision shape). */
export interface FixtureByKind {
  'decision': DecisionFixture & { kind: 'decision' }
  'specificity': DecisionFixture & { kind: 'specificity' }
  'url-normalize': UrlNormalizeFixture
  'schedule': ScheduleFixture
  'escalation': EscalationFixture
  'rule-change': RuleChangeFixture
  'activity': ActivityFixture
}

export type Fixture = FixtureByKind[LoadableFixtureKind]
