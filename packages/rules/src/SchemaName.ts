// SPDX-License-Identifier: AGPL-3.0-or-later

/** Base URI of every v1 schema `$id`. Identifiers only: nothing is fetched from it. */
export const SCHEMA_BASE_URI = 'https://monkifocus.dev/schema/rules/v1/'

/** Schema names are the file names in `schema/v1/` without `.schema.json`. */
export const SCHEMA_NAMES = [
  'activity',
  'activity-fixture',
  'bedtime',
  'category-assignment',
  'category-catalog',
  'decision',
  'decision-context',
  'decision-fixture',
  'detector-pack',
  'escalation',
  'escalation-fixture',
  'fixture',
  'invalid-fixture',
  'rule',
  'rule-change-fixture',
  'ruleset',
  'schedule',
  'schedule-fixture',
  'site-profile',
  'surface-registry',
  'target',
  'time',
  'url-normalize-fixture',
] as const

export type SchemaName = (typeof SCHEMA_NAMES)[number]

export function schemaIdOf(name: SchemaName): string {
  return `${SCHEMA_BASE_URI}${name}.schema.json`
}
