// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Every v1 schema as imported JSON, in `SCHEMA_NAMES` order. No file system:
 * bundlers inline these, so a validator can be built in a browser or a
 * service worker. A test keeps this list equal to `schema/v1/`.
 */
import activity from '../schema/v1/activity.schema.json' with { type: 'json' }
import activityFixture from '../schema/v1/activity-fixture.schema.json' with { type: 'json' }
import bedtime from '../schema/v1/bedtime.schema.json' with { type: 'json' }
import candidatesFixture from '../schema/v1/candidates-fixture.schema.json' with { type: 'json' }
import categoryAssignment from '../schema/v1/category-assignment.schema.json' with { type: 'json' }
import categoryCatalog from '../schema/v1/category-catalog.schema.json' with { type: 'json' }
import decision from '../schema/v1/decision.schema.json' with { type: 'json' }
import decisionContext from '../schema/v1/decision-context.schema.json' with { type: 'json' }
import decisionFixture from '../schema/v1/decision-fixture.schema.json' with { type: 'json' }
import detectorPack from '../schema/v1/detector-pack.schema.json' with { type: 'json' }
import escalation from '../schema/v1/escalation.schema.json' with { type: 'json' }
import escalationFixture from '../schema/v1/escalation-fixture.schema.json' with { type: 'json' }
import fixture from '../schema/v1/fixture.schema.json' with { type: 'json' }
import invalidFixture from '../schema/v1/invalid-fixture.schema.json' with { type: 'json' }
import rule from '../schema/v1/rule.schema.json' with { type: 'json' }
import ruleChangeFixture from '../schema/v1/rule-change-fixture.schema.json' with { type: 'json' }
import ruleset from '../schema/v1/ruleset.schema.json' with { type: 'json' }
import schedule from '../schema/v1/schedule.schema.json' with { type: 'json' }
import scheduleFixture from '../schema/v1/schedule-fixture.schema.json' with { type: 'json' }
import siteProfile from '../schema/v1/site-profile.schema.json' with { type: 'json' }
import surfaceRegistry from '../schema/v1/surface-registry.schema.json' with { type: 'json' }
import target from '../schema/v1/target.schema.json' with { type: 'json' }
import time from '../schema/v1/time.schema.json' with { type: 'json' }
import urlNormalizeFixture from '../schema/v1/url-normalize-fixture.schema.json' with { type: 'json' }
import type { JsonSchemaDocument } from './JsonSchemaDocument.ts'

export const bundledSchemas: readonly JsonSchemaDocument[] = [
  activity,
  activityFixture,
  bedtime,
  candidatesFixture,
  categoryAssignment,
  categoryCatalog,
  decision,
  decisionContext,
  decisionFixture,
  detectorPack,
  escalation,
  escalationFixture,
  fixture,
  invalidFixture,
  rule,
  ruleChangeFixture,
  ruleset,
  schedule,
  scheduleFixture,
  siteProfile,
  surfaceRegistry,
  target,
  time,
  urlNormalizeFixture,
]
