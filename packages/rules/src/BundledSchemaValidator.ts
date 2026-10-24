// SPDX-License-Identifier: AGPL-3.0-or-later
import { siteProfiles } from './BundledRulesData.ts'
import { bundledSchemas } from './BundledSchemas.ts'
import { aliasMapOf } from './SiteAliases.ts'
import type { SchemaValidator } from './SchemaValidator.ts'
import { createSchemaValidator } from './SchemaValidator.ts'
import type { AliasMap } from './TargetNormaliser.ts'

/** Alias → canonical domain from the bundled site profiles. */
export const bundledAliasMap: AliasMap = aliasMapOf(siteProfiles)

let shared: SchemaValidator | undefined

/** Validator over the bundled schemas and site aliases (no Node APIs), built on first use. */
export function bundledSchemaValidator(): SchemaValidator {
  shared ??= createSchemaValidator(bundledSchemas, { aliases: bundledAliasMap })
  return shared
}
