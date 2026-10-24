// SPDX-License-Identifier: AGPL-3.0-or-later

/** Every fixture kind. A fixture whose kind is not listed here is an error, never skipped. */
export const FIXTURE_KINDS = [
  'decision',
  'specificity',
  'url-normalize',
  'schedule',
  'escalation',
  'rule-change',
  'candidates',
  'activity',
  'invalid',
  'unlock-token',
] as const

export type FixtureKind = (typeof FIXTURE_KINDS)[number]

/**
 * Directories under `fixtures/` that hold no JSON fixtures of a kind:
 * `detectors/` keeps the sanitised Android UI dumps (`.xml` + `.expect.json`)
 * that the `:detectors` module replays. Fixture runners skip them.
 */
export const NON_KIND_FIXTURE_DIRECTORIES = ['detectors'] as const

/** Kinds whose fixtures live in this package (`unlock-token` vectors live in packages/protocol). */
export type LoadableFixtureKind = Exclude<FixtureKind, 'unlock-token'>

export const UNLOCK_TOKEN_REDIRECT =
  'unlock-token vectors live in packages/protocol (@monki-focus/protocol), not in packages/rules'

export function isFixtureKind(value: unknown): value is FixtureKind {
  return typeof value === 'string' && (FIXTURE_KINDS as readonly string[]).includes(value)
}

/** Throws (loudly) unless `kind` is a kind this package can load. */
export function assertLoadableFixtureKind(kind: unknown): asserts kind is LoadableFixtureKind {
  if (!isFixtureKind(kind)) throw new Error(`Unknown fixture kind: ${String(kind)}`)
  if (kind === 'unlock-token') throw new Error(UNLOCK_TOKEN_REDIRECT)
}
