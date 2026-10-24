// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { packageRoot } from './PackageRoot.ts'
import { SCHEMA_NAMES } from './SchemaName.ts'

export interface JsonSchemaDocument {
  $schema: string
  $id: string
  [keyword: string]: unknown
}

/** Reads every `schema/v1/*.schema.json` of the package (Node only). */
export function loadSchemas(root: string = packageRoot): JsonSchemaDocument[] {
  return SCHEMA_NAMES.map(
    (name) =>
      JSON.parse(
        readFileSync(join(root, 'schema/v1', `${name}.schema.json`), 'utf8')
      ) as JsonSchemaDocument
  )
}
