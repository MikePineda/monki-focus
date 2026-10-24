// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * @monki-focus/rules (also `@monki-focus/rules/node`): schemas, data and
 * conformance fixtures shared by every platform, plus the Node readers
 * (`loadFixtures`, `loadSchemas`, typed data loaders). Browsers and service
 * workers import `@monki-focus/rules/pure` instead. No decision logic lives
 * here (that is @monki-focus/engine).
 */
export * from './pure.ts'
export type { Fixture, FixtureByKind } from './Fixture.ts'
export type { FixtureKind, LoadableFixtureKind } from './FixtureKind.ts'
export { FIXTURE_KINDS, isFixtureKind } from './FixtureKind.ts'
export type { FixtureFile } from './FixtureFiles.ts'
export { listFixtureFiles } from './FixtureFiles.ts'
export type { LoadFixturesOptions } from './FixtureLoader.ts'
export { loadFixtures } from './FixtureLoader.ts'
export { checkFixtureInvariants, explanationKeyOf } from './FixtureInvariants.ts'
export { loadSchemas } from './SchemaFiles.ts'
export { loadAliasMap, schemaValidator } from './PackageSchemaValidator.ts'
export type { SiteProfileFile } from './RulesData.ts'
export {
  loadDefaultCategories,
  loadSiteProfiles,
  loadStarterPreset,
  loadSurfaceRegistry,
} from './RulesData.ts'
export { packageRoot } from './PackageRoot.ts'
