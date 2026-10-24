// SPDX-License-Identifier: AGPL-3.0-or-later

/** A parsed JSON Schema document of the package (`schema/v1/*.schema.json`). */
export interface JsonSchemaDocument {
  $schema: string
  $id: string
  [keyword: string]: unknown
}
