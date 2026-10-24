// SPDX-License-Identifier: AGPL-3.0-or-later
import { Ajv2020 } from 'ajv/dist/2020.js'
import formatsModule from 'ajv-formats'
import type { JsonSchemaDocument } from './SchemaFiles.ts'
import type { SchemaName } from './SchemaName.ts'
import { schemaIdOf } from './SchemaName.ts'

/** Hard limit for any rules document (rule set, profile, pack, fixture): 256 KiB of UTF-8. */
export const MAX_DOCUMENT_BYTES = 256 * 1024

export type ValidationResult = { valid: true } | { valid: false; errors: string[] }

export interface SchemaValidator {
  /** Validates an already parsed value. */
  validate(schema: SchemaName, value: unknown): ValidationResult
  /** Validates raw text: size limit first, then JSON syntax, then the schema. */
  validateDocument(schema: SchemaName, text: string | Uint8Array): ValidationResult
}

const addFormats = formatsModule.default

/**
 * Builds a validator from schema documents. Pure: pass the JSON objects
 * (for example imported by a bundler) so it also runs in a browser.
 */
export function createSchemaValidator(schemas: readonly JsonSchemaDocument[]): SchemaValidator {
  // `strictRequired` is off because conditional branches (`if`/`then`) require
  // properties that the surrounding schema declares.
  const ajv = new Ajv2020({
    strict: true,
    strictRequired: false,
    allErrors: true,
    allowUnionTypes: true,
  })
  addFormats(ajv, ['date-time', 'date'])
  for (const schema of schemas) ajv.addSchema(schema)
  for (const schema of schemas) ajv.getSchema(schema.$id)

  function validate(schema: SchemaName, value: unknown): ValidationResult {
    const check = ajv.getSchema(schemaIdOf(schema))
    if (!check) return { valid: false, errors: [`unknown_schema: ${schema}`] }
    if (check(value)) return { valid: true }
    const errors = (check.errors ?? []).map(
      (error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`
    )
    return { valid: false, errors }
  }

  function validateDocument(schema: SchemaName, text: string | Uint8Array): ValidationResult {
    const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text
    if (bytes.length > MAX_DOCUMENT_BYTES) return { valid: false, errors: ['document_too_large'] }
    let value: unknown
    try {
      value = JSON.parse(typeof text === 'string' ? text : new TextDecoder().decode(text))
    } catch {
      return { valid: false, errors: ['invalid_json'] }
    }
    return validate(schema, value)
  }

  return { validate, validateDocument }
}
