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
 * Extension keyword: the array's items must differ in the value at this JSON
 * pointer (`/id`, `/target`). Kotlin and Swift validators enforce it too
 * (SEMANTICS.md §1); generic validators ignore an `x-` keyword.
 */
export const UNIQUE_BY_KEYWORD = 'x-uniqueBy'

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function valueAt(item: unknown, pointer: string): unknown {
  let current = item
  for (const segment of pointer.split('/').slice(1)) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function hasUniqueKeys(items: unknown[], pointer: string): boolean {
  const keys = items.map((item) => canonicalJson(valueAt(item, pointer)))
  return new Set(keys).size === keys.length
}

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
  ajv.addKeyword({
    keyword: UNIQUE_BY_KEYWORD,
    type: 'array',
    schemaType: 'string',
    errors: false,
    validate: (pointer: string, items: unknown[]) => hasUniqueKeys(items, pointer),
  })
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
