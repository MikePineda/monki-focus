// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_DOCUMENT_BYTES, loadSchemas, schemaValidator } from '../../src/index.ts'
import { packageRoot } from '../../src/PackageRoot.ts'

const starterPresetText = readFileSync(
  join(packageRoot, 'data/presets/starter.ruleset.json'),
  'utf8'
)
const starterPreset = JSON.parse(starterPresetText) as Record<string, unknown>

type JsonNode = Record<string, unknown>

/** Every object sub-schema with `properties`, skipping `if` conditions (which only test values). */
function objectSchemasOf(node: unknown, path: string, found: { path: string; node: JsonNode }[]) {
  if (Array.isArray(node)) {
    node.forEach((child, index) => {
      objectSchemasOf(child, `${path}/${index}`, found)
    })
    return found
  }
  if (node === null || typeof node !== 'object') return found
  const record = node as JsonNode
  if ('properties' in record) found.push({ path, node: record })
  for (const [key, child] of Object.entries(record)) {
    if (key === 'if' || key === 'properties') {
      if (key === 'properties') {
        for (const [name, property] of Object.entries(child as JsonNode)) {
          objectSchemasOf(property, `${path}/properties/${name}`, found)
        }
      }
      continue
    }
    objectSchemasOf(child, `${path}/${key}`, found)
  }
  return found
}

describe('strict schemas', () => {
  it('every_schema_compiles_under_draft_2020_12', () => {
    const schemas = loadSchemas()
    expect(schemas.length).toBeGreaterThanOrEqual(18)
    for (const schema of schemas) {
      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    }
    expect(() => schemaValidator()).not.toThrow()
  })

  it('every_object_schema_rejects_unknown_fields', () => {
    const offenders: string[] = []
    for (const schema of loadSchemas()) {
      const id = schema.$id
      for (const { path, node } of objectSchemasOf(schema, '', [])) {
        // The fixture envelope only dispatches on `kind`; each kind's schema is closed.
        if (id.endsWith('/fixture.schema.json') && path === '') continue
        if (node.additionalProperties !== false) offenders.push(`${id}#${path}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('ruleset_with_unknown_field_is_rejected', () => {
    const result = schemaValidator().validate('ruleset', { ...starterPreset, telemetry: true })
    expect(result.valid).toBe(false)
  })

  it('rule_with_unknown_field_is_rejected', () => {
    const rules = starterPreset.rules as JsonNode[]
    const first = rules[0] ?? {}
    const result = schemaValidator().validate('ruleset', {
      ...starterPreset,
      rules: [{ ...first, script: 'return true' }],
    })
    expect(result.valid).toBe(false)
  })

  it('fixture_with_unknown_field_is_rejected', () => {
    const result = schemaValidator().validate('fixture', {
      id: 'url-normalize.extra_field',
      kind: 'url-normalize',
      description: 'Has a field no schema knows.',
      given: { urlText: 'reddit.com' },
      then: { host: 'reddit.com', path: '/', pathKnown: false, surface: null },
      skip: true,
    })
    expect(result.valid).toBe(false)
  })

  it('oversized_document_is_rejected', () => {
    const padding = ' '.repeat(MAX_DOCUMENT_BYTES)
    const result = schemaValidator().validateDocument('ruleset', starterPresetText + padding)
    expect(result.valid).toBe(false)
    expect(result.valid ? [] : result.errors).toContain('document_too_large')
  })

  it('document_at_the_size_limit_is_accepted', () => {
    const bytes = new TextEncoder().encode(starterPresetText).length
    const padded = starterPresetText + ' '.repeat(MAX_DOCUMENT_BYTES - bytes)
    expect(new TextEncoder().encode(padded).length).toBe(MAX_DOCUMENT_BYTES)
    expect(schemaValidator().validateDocument('ruleset', padded)).toEqual({ valid: true })
  })

  it('size_limit_counts_utf8_bytes_not_characters', () => {
    const notes = 'é'.repeat(MAX_DOCUMENT_BYTES / 2 + 1)
    const result = schemaValidator().validateDocument('ruleset', notes)
    expect(result.valid ? [] : result.errors).toContain('document_too_large')
  })

  it('invalid_json_is_rejected', () => {
    const result = schemaValidator().validateDocument('ruleset', '{"schemaVersion": 1,')
    expect(result.valid ? [] : result.errors).toContain('invalid_json')
  })

  it('max_document_bytes_is_256_kib', () => {
    expect(MAX_DOCUMENT_BYTES).toBe(256 * 1024)
  })
})
