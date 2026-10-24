// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * @monki-focus/rules: schemas, data and conformance fixtures shared by every
 * platform. No decision logic lives here (that is @monki-focus/engine).
 */
export type * from './generated/SchemaTypes.ts'
export type { Fixture, FixtureByKind } from './Fixture.ts'
export type { FixtureKind, LoadableFixtureKind } from './FixtureKind.ts'
export { FIXTURE_KINDS, isFixtureKind } from './FixtureKind.ts'
export type { FixtureFile } from './FixtureFiles.ts'
export { listFixtureFiles } from './FixtureFiles.ts'
export type { LoadFixturesOptions } from './FixtureLoader.ts'
export { loadFixtures } from './FixtureLoader.ts'
export { checkFixtureInvariants, explanationKeyOf } from './FixtureInvariants.ts'
export type { SchemaName } from './SchemaName.ts'
export { SCHEMA_BASE_URI, SCHEMA_NAMES, schemaIdOf } from './SchemaName.ts'
export type { JsonSchemaDocument } from './SchemaFiles.ts'
export { loadSchemas } from './SchemaFiles.ts'
export type { SchemaValidator, ValidationResult } from './SchemaValidator.ts'
export { MAX_DOCUMENT_BYTES, createSchemaValidator } from './SchemaValidator.ts'
export { schemaValidator } from './PackageSchemaValidator.ts'
export type { SiteProfileFile } from './RulesData.ts'
export {
  loadDefaultCategories,
  loadSiteProfiles,
  loadStarterPreset,
  loadSurfaceRegistry,
} from './RulesData.ts'
export { packageRoot } from './PackageRoot.ts'
