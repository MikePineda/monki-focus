// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `@monki-focus/rules/pure`: the browser-safe entry point (extension service
 * worker, dashboard). Generated types, the bundled data and schemas as
 * imported JSON, and the schema validator. Nothing in this module graph may
 * import a Node builtin; tests compile it with only the es2024 and webworker
 * libs. Fixture loading and file readers stay in the root (`./node`) entry.
 */
export type * from './generated/SchemaTypes.ts'
export type { JsonSchemaDocument } from './JsonSchemaDocument.ts'
export type { SchemaName } from './SchemaName.ts'
export { SCHEMA_BASE_URI, SCHEMA_NAMES, schemaIdOf } from './SchemaName.ts'
export type {
  RejectionCode,
  SchemaValidator,
  SchemaValidatorOptions,
  ValidationResult,
} from './SchemaValidator.ts'
export { MAX_DOCUMENT_BYTES, createSchemaValidator } from './SchemaValidator.ts'
export type { AliasMap } from './TargetNormaliser.ts'
export { canonicalTarget, isRegistrableDomain, normaliseDomain } from './TargetNormaliser.ts'
export { aliasMapOf } from './SiteAliases.ts'
export { bundledSchemas } from './BundledSchemas.ts'
export {
  defaultCategories,
  siteProfiles,
  starterPreset,
  surfaceRegistry,
} from './BundledRulesData.ts'
export { bundledAliasMap, bundledSchemaValidator } from './BundledSchemaValidator.ts'
