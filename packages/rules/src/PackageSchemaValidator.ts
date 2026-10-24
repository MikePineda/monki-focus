// SPDX-License-Identifier: AGPL-3.0-or-later
import { loadSchemas } from './SchemaFiles.ts'
import type { SchemaValidator } from './SchemaValidator.ts'
import { createSchemaValidator } from './SchemaValidator.ts'

let shared: SchemaValidator | undefined

/** Validator over the package's own schemas (Node only), built once. */
export function schemaValidator(): SchemaValidator {
  shared ??= createSchemaValidator(loadSchemas())
  return shared
}
