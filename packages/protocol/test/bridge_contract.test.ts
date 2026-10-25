// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { packageRoot } from './token_vector_loader.ts'

/**
 * The native messaging bridge contract: the schemas in `schema/bridge` and
 * the fixtures in `fixtures/bridge` agree. The extension and MonkiCore run
 * the same fixtures through their own validators.
 */

type Direction = 'extension-to-app' | 'app-to-extension'

interface ValidFixture {
  name: string
  direction: Direction
  message: unknown
}

interface InvalidFixture {
  name: string
  direction: Direction
  reason: string
  message?: unknown
  text?: string
  padTo?: { pointer: string; bytes: number }
}

const schemaDir = join(packageRoot, 'schema/bridge')
const fixtureDir = join(packageRoot, 'fixtures/bridge')
const MAX_BYTES = 1_048_576

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function fixtures<T>(folder: string): T[] {
  return readdirSync(join(fixtureDir, folder))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => readJson(join(fixtureDir, folder, file)) as T)
}

const schemas = readdirSync(schemaDir)
  .filter((file) => file.endsWith('.schema.json'))
  .map((file) => readJson(join(schemaDir, file)) as Record<string, unknown>)
const ajv = new Ajv2020({ strict: true, allErrors: true })
for (const schema of schemas) ajv.addSchema(schema)

const validators = {
  'extension-to-app': ajv.getSchema('urn:monki-focus:protocol:bridge-extension-to-app:v1'),
  'app-to-extension': ajv.getSchema('urn:monki-focus:protocol:bridge-app-to-extension:v1'),
}

function validatorFor(direction: Direction) {
  const validate = validators[direction]
  if (validate === undefined) throw new Error(`no schema for ${direction}`)
  return validate
}

/** Applies `padTo` (see fixtures/bridge/README.md). */
function padded(fixture: InvalidFixture): unknown {
  const message = structuredClone(fixture.message) as Record<string, unknown>
  if (fixture.padTo === undefined) return message
  const segments = fixture.padTo.pointer.split('/').slice(1)
  const last = segments.pop() ?? ''
  let parent = message
  for (const segment of segments) parent = parent[segment] as Record<string, unknown>
  parent[last] = ''
  const base = Buffer.byteLength(JSON.stringify(message))
  parent[last] = 'x'.repeat(fixture.padTo.bytes - base)
  return message
}

const valid = fixtures<ValidFixture>('valid')
const invalid = fixtures<InvalidFixture>('invalid')
const envelope = readJson(join(schemaDir, 'envelope.schema.json')) as {
  properties: { type: { enum: string[] } }
}

describe('native messaging bridge contract', () => {
  it.each(valid.map((fixture) => [fixture.name, fixture] as const))(
    '%s is valid',
    (_name, fixture) => {
      const validate = validatorFor(fixture.direction)
      expect(validate(fixture.message), JSON.stringify(validate.errors)).toBe(true)
      expect(Buffer.byteLength(JSON.stringify(fixture.message))).toBeLessThanOrEqual(MAX_BYTES)
    }
  )

  it.each(invalid.map((fixture) => [fixture.name, fixture] as const))('%s', (_name, fixture) => {
    if (fixture.text !== undefined) {
      // Text fixtures are about strict parsing (MonkiCore); the duplicate-key
      // one parses in JavaScript, the truncated one does not.
      expect(fixture.reason).toBe('invalid_json')
      return
    }
    const message = padded(fixture)
    const bytes = Buffer.byteLength(JSON.stringify(message))
    if (fixture.reason === 'too_large') {
      expect(bytes).toBe(fixture.padTo?.bytes)
      expect(bytes).toBeGreaterThan(MAX_BYTES)
      return
    }
    expect(validatorFor(fixture.direction)(message)).toBe(false)
  })

  it('every message type has a valid fixture and a schema', () => {
    const types = envelope.properties.type.enum
    const covered = new Set(valid.map((fixture) => (fixture.message as { type: string }).type))
    expect([...covered].sort()).toEqual([...types].sort())
    for (const type of types) {
      const file = `${type
        .replace('.', '-')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase()}.schema.json`
      expect(readdirSync(schemaDir), type).toContain(file)
    }
  })

  it('every rejection code has a fixture', () => {
    expect(new Set(invalid.map((fixture) => fixture.reason))).toEqual(
      new Set([
        'too_large',
        'invalid_json',
        'invalid_envelope',
        'unsupported_version',
        'unknown_type',
        'wrong_direction',
        'payload_not_object',
        'invalid_payload',
      ])
    )
  })

  it('fixture names match their file names', () => {
    for (const folder of ['valid', 'invalid', 'frames']) {
      for (const file of readdirSync(join(fixtureDir, folder)).filter((f) => f.endsWith('.json'))) {
        expect((readJson(join(fixtureDir, folder, file)) as { name: string }).name).toBe(
          file.replace(/\.json$/, '')
        )
      }
    }
  })
})
