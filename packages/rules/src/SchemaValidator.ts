// SPDX-License-Identifier: AGPL-3.0-or-later
import { Ajv2020 } from 'ajv/dist/2020.js'
import formatsModule from 'ajv-formats'
import type { JsonSchemaDocument } from './SchemaFiles.ts'
import type { SchemaName } from './SchemaName.ts'
import { schemaIdOf } from './SchemaName.ts'
import type { AliasMap } from './TargetNormaliser.ts'
import { canonicalTarget, isRegistrableDomain } from './TargetNormaliser.ts'

/** Hard limit for any rules document (rule set, profile, pack, fixture): 256 KiB of UTF-8. */
export const MAX_DOCUMENT_BYTES = 256 * 1024

/** Why a document was rejected; the `invalid` fixtures name these codes. */
export type RejectionCode =
  'schema' | 'duplicate_key' | 'invalid_domain' | 'too_large' | 'invalid_json'

export type ValidationResult =
  { valid: true } | { valid: false; code: RejectionCode; errors: string[] }

export interface SchemaValidator {
  /** Validates an already parsed value. */
  validate(schema: SchemaName, value: unknown): ValidationResult
  /** Validates raw text: size limit first, then JSON syntax, then the schema. */
  validateDocument(schema: SchemaName, text: string | Uint8Array): ValidationResult
}

export interface SchemaValidatorOptions {
  /** Alias domain → canonical domain, from the site profiles (`twitter.com` → `x.com`). */
  aliases?: AliasMap
}

const addFormats = formatsModule.default

/**
 * Extension keyword: the array's items must differ in the value at this JSON
 * pointer (`/id`, `/target`), site targets compared after normalisation.
 * Kotlin and Swift validators enforce it too (SEMANTICS.md §1).
 */
export const UNIQUE_BY_KEYWORD = 'x-uniqueBy'

/** Extension keyword: a domain that still has two labels and is no public suffix once normalised. */
export const REGISTRABLE_DOMAIN_KEYWORD = 'x-registrableDomain'

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

function codeOf(keywords: string[]): RejectionCode {
  if (keywords.includes(UNIQUE_BY_KEYWORD)) return 'duplicate_key'
  if (keywords.includes(REGISTRABLE_DOMAIN_KEYWORD)) return 'invalid_domain'
  return 'schema'
}

/**
 * Builds a validator from schema documents. Pure: pass the JSON objects
 * (for example imported by a bundler) so it also runs in a browser.
 */
export function createSchemaValidator(
  schemas: readonly JsonSchemaDocument[],
  options: SchemaValidatorOptions = {}
): SchemaValidator {
  const aliases = options.aliases ?? {}
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
    validate: (pointer: string, items: unknown[]) => {
      const keys = items.map((item) =>
        canonicalJson(canonicalTarget(valueAt(item, pointer), aliases))
      )
      return new Set(keys).size === keys.length
    },
  })
  ajv.addKeyword({
    keyword: REGISTRABLE_DOMAIN_KEYWORD,
    type: 'string',
    schemaType: 'boolean',
    errors: false,
    validate: (enabled: boolean, domain: string) =>
      !enabled || isRegistrableDomain(domain, aliases),
  })
  for (const schema of schemas) ajv.addSchema(schema)
  for (const schema of schemas) ajv.getSchema(schema.$id)

  function validate(schema: SchemaName, value: unknown): ValidationResult {
    const check = ajv.getSchema(schemaIdOf(schema))
    if (!check) return { valid: false, code: 'schema', errors: [`unknown_schema: ${schema}`] }
    if (check(value)) return { valid: true }
    const failures = check.errors ?? []
    const errors = failures.map(
      (error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`
    )
    return { valid: false, code: codeOf(failures.map((error) => error.keyword)), errors }
  }

  function validateDocument(schema: SchemaName, text: string | Uint8Array): ValidationResult {
    const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text
    if (bytes.length > MAX_DOCUMENT_BYTES) {
      return { valid: false, code: 'too_large', errors: ['document_too_large'] }
    }
    let value: unknown
    try {
      value = JSON.parse(typeof text === 'string' ? text : new TextDecoder().decode(text))
    } catch {
      return { valid: false, code: 'invalid_json', errors: ['invalid_json'] }
    }
    return validate(schema, value)
  }

  return { validate, validateDocument }
}
