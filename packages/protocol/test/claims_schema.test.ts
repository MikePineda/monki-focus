// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import * as formats from '../src/claim_formats.ts'
import { generateSchemas } from '../scripts/gen-schemas.mjs'
import { isPolicyClaims } from '../src/policy_claims.ts'
import { isTimeClaims } from '../src/time_claims.ts'
import { RFC3339_UTC_PATTERN } from '../src/rfc3339_utc.ts'
import { isUnlockClaims } from '../src/unlock_claims.ts'
import { loadTokenVectors, packageRoot } from './token_vector_loader.ts'

type Schema = Record<string, unknown> & {
  properties: Record<string, Record<string, unknown>>
  $defs: Record<string, { pattern: string; maxLength: number }>
}

function loadSchema(name: string): Schema {
  return JSON.parse(readFileSync(join(packageRoot, 'schema', name), 'utf8')) as Schema
}

const unlockSchema = loadSchema('unlock-token.claims.schema.json')
const policySchema = loadSchema('policy-token.claims.schema.json')
const timeSchema = loadSchema('time-token.claims.schema.json')
const ajv = new Ajv2020({ strict: true, allErrors: true })
const validateUnlock = ajv.compile(unlockSchema)
const validatePolicy = ajv.compile(policySchema)
const validateTime = ajv.compile(timeSchema)

const vectors = [
  ...loadTokenVectors('unlock-tokens'),
  ...loadTokenVectors('policy-tokens'),
  ...loadTokenVectors('time-tokens'),
]
const validUnlock = JSON.parse(
  vectors.find((vector) => vector.id === 'valid_unlock_token')?.construction.claimsJson ?? '{}'
) as Record<string, unknown>
const validTime = JSON.parse(
  vectors.find((vector) => vector.id === 'valid_time_token')?.construction.claimsJson ?? '{}'
) as Record<string, unknown>
const validPolicy = JSON.parse(
  vectors.find((vector) => vector.id === 'valid_policy_token')?.construction.claimsJson ?? '{}'
) as Record<string, unknown>

function parsedClaims(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return undefined
  }
}

/** Candidate claims that probe each keyword of the schema. */
function mutations(base: Record<string, unknown>): [string, unknown][] {
  const cases: [string, unknown][] = [['unchanged', base]]
  for (const key of Object.keys(base)) {
    const rest = Object.fromEntries(Object.entries(base).filter(([name]) => name !== key))
    cases.push([`missing ${key}`, rest])
    cases.push([`${key} as null`, { ...base, [key]: null }])
    cases.push([`${key} as number`, { ...base, [key]: 12345 }])
    cases.push([`${key} as string`, { ...base, [key]: 'x' }])
  }
  const extra: [string, unknown][] = [
    ['extra claim', { ...base, extra: 1 }],
    ['__proto__ claim', JSON.parse(`{"__proto__":1,${JSON.stringify(base).slice(1)}`)],
    ['array', [base]],
    ['v = 2', { ...base, v: 2 }],
    ['v = 1.0 as string', { ...base, v: '1' }],
    ['iss with trailing slash', { ...base, iss: 'https://focus.example.org/' }],
    ['iss with path', { ...base, iss: 'https://focus.example.org/api' }],
    ['iss uppercase', { ...base, iss: 'https://Focus.example.org' }],
    ['iss plain http', { ...base, iss: 'http://focus.example.org' }],
    ['iss with port', { ...base, iss: 'https://focus.example.org:8443' }],
    ['iss loopback http', { ...base, iss: 'http://localhost:3333' }],
    ['iss loopback default port', { ...base, iss: 'http://localhost:80' }],
    ['iss loopback port 0', { ...base, iss: 'http://localhost:0' }],
    ['iss loopback port 65536', { ...base, iss: 'http://127.0.0.1:65536' }],
    ['iss with pipe', { ...base, iss: 'https://focus.example.org|x' }],
    ['dev uppercase', { ...base, dev: String(base.dev).toUpperCase() }],
    ['iat with offset', { ...base, iat: '2026-01-05T09:00:00+00:00' }],
    ['iat lowercase t', { ...base, iat: '2026-01-05t09:00:00Z' }],
    ['iat leap second', { ...base, iat: '2026-01-05T09:00:60Z' }],
    ['iat month 13', { ...base, iat: '2026-13-05T09:00:00Z' }],
  ]
  if ('scope' in base) {
    extra.push(
      ['dur_s 59', { ...base, dur_s: 59 }],
      ['dur_s 7200', { ...base, dur_s: 7200 }],
      ['dur_s 7201', { ...base, dur_s: 7201 }],
      ['dur_s float', { ...base, dur_s: 900.5 }],
      [
        'scope domain single label',
        { ...base, scope: { kind: 'domain', value: 'localhost', includeSubdomains: false } },
      ],
      [
        'scope domain wildcard',
        { ...base, scope: { kind: 'domain', value: '*.example.com', includeSubdomains: false } },
      ],
      [
        'scope domain uppercase',
        { ...base, scope: { kind: 'domain', value: 'Example.com', includeSubdomains: false } },
      ],
      ['scope domain without flag', { ...base, scope: { kind: 'domain', value: 'example.com' } }],
      [
        'scope domain flag as string',
        { ...base, scope: { kind: 'domain', value: 'example.com', includeSubdomains: 'no' } },
      ],
      [
        'scope path with flag',
        { ...base, scope: { kind: 'path', value: 'example.com/a', includeSubdomains: true } },
      ],
      ['scope path dot', { ...base, scope: { kind: 'path', value: 'example.com/a/.' } }],
      ['scope path dot dot', { ...base, scope: { kind: 'path', value: 'example.com/../a' } }],
      ['scope path dots', { ...base, scope: { kind: 'path', value: 'example.com/.../a' } }],
      ['scope path percent', { ...base, scope: { kind: 'path', value: 'example.com/a%20b' } }],
      ['scope path empty', { ...base, scope: { kind: 'path', value: 'example.com//a' } }],
      ['scope path backslash', { ...base, scope: { kind: 'path', value: 'example.com/a\\b' } }],
      ['scope path', { ...base, scope: { kind: 'path', value: 'example.com/r/a' } }],
      ['scope path with query', { ...base, scope: { kind: 'path', value: 'example.com/a?b' } }],
      ['scope path wildcard', { ...base, scope: { kind: 'path', value: 'example.com/*' } }],
      ['scope path trailing slash', { ...base, scope: { kind: 'path', value: 'example.com/a/' } }],
      ['scope app', { ...base, scope: { kind: 'app', value: 'com.example.app' } }],
      ['scope app single segment', { ...base, scope: { kind: 'app', value: 'app' } }],
      ['scope kind rule', { ...base, scope: { kind: 'rule', value: 'social' } }],
      ['scope extra key', { ...base, scope: { kind: 'app', value: 'com.example.app', x: 1 } }]
    )
  } else if ('nonce' in base) {
    extra.push(
      ['nonce too short', { ...base, nonce: 'AAEC' }],
      ['boot with pipe', { ...base, boot: '41|x' }],
      ['complete as string', { ...base, complete: 'true' }],
      ['revoked not array', { ...base, revoked: {} }],
      [
        'revoked item extra key',
        {
          ...base,
          revoked: [
            { jti: '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a', exp: '2026-01-05T09:40:00Z', x: 1 },
          ],
        },
      ],
      [
        'revoked 32 items',
        {
          ...base,
          revoked: Array.from({ length: 32 }, () => ({
            jti: '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a',
            exp: '2026-01-05T09:40:00Z',
          })),
        },
      ],
      [
        'revoked 33 items',
        {
          ...base,
          revoked: Array.from({ length: 33 }, () => ({
            jti: '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a',
            exp: '2026-01-05T09:40:00Z',
          })),
        },
      ]
    )
  } else {
    extra.push(
      ['ver 0', { ...base, ver: 0 }],
      ['ver float', { ...base, ver: 1.5 }],
      ['tz three segments', { ...base, tz: 'America/Argentina/Buenos_Aires' }],
      ['tz with space', { ...base, tz: 'Etc/U TC' }]
    )
  }
  return [...cases, ...extra]
}

describe('claims schemas', () => {
  it('test_committed_schemas_equal_the_generated_schemas', () => {
    const generated = generateSchemas()
    expect(Object.keys(generated).sort()).toEqual([
      'schema/policy-token.claims.schema.json',
      'schema/time-token.claims.schema.json',
      'schema/unlock-token.claims.schema.json',
    ])
    for (const [path, schema] of Object.entries(generated)) {
      expect(loadSchema(path.replace('schema/', ''))).toEqual(schema)
    }
  })

  it('test_schemas_are_valid_draft_2020_12_and_closed', () => {
    for (const schema of [unlockSchema, policySchema, timeSchema]) {
      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
      expect(schema.additionalProperties).toBe(false)
      expect(ajv.validateSchema(schema)).toBe(true)
    }
  })

  it.each(mutations(validUnlock))(
    'test_unlock_validator_agrees_with_schema_on_%s',
    (_label, claims) => {
      expect(isUnlockClaims(claims)).toBe(validateUnlock(claims))
    }
  )

  it.each(mutations(validPolicy))(
    'test_policy_validator_agrees_with_schema_on_%s',
    (_label, claims) => {
      expect(isPolicyClaims(claims)).toBe(validatePolicy(claims))
      expect(isTimeClaims(claims)).toBe(validateTime(claims))
    }
  )

  it.each(mutations(validTime))(
    'test_time_validator_agrees_with_schema_on_%s',
    (_label, claims) => {
      expect(isTimeClaims(claims)).toBe(validateTime(claims))
    }
  )

  it('test_validators_agree_with_schemas_on_every_vector_payload', () => {
    for (const vector of vectors) {
      const claims = parsedClaims(vector.construction.claimsJson)
      if (
        vector.id === 'non_calendar_date_is_rejected' ||
        vector.id === 'leap_day_in_a_common_year_is_rejected'
      ) {
        // The schema checks the shape; the calendar check is a documented extra rule.
        expect(validateUnlock(claims)).toBe(true)
        expect(isUnlockClaims(claims)).toBe(false)
        continue
      }
      expect(isUnlockClaims(claims)).toBe(validateUnlock(claims))
      expect(isPolicyClaims(claims)).toBe(validatePolicy(claims))
      expect(isTimeClaims(claims)).toBe(validateTime(claims))
    }
  })

  it('test_schema_patterns_match_the_reference_regexes', () => {
    const same = (pattern: string | undefined, regex: RegExp) => {
      expect(pattern).toBeDefined()
      expect(new RegExp(pattern ?? '').source).toBe(regex.source)
    }
    for (const schema of [unlockSchema, policySchema, timeSchema]) {
      same(schema.$defs.issuer?.pattern, formats.ISSUER_PATTERN)
      same(schema.$defs.uuid?.pattern, formats.UUID_PATTERN)
      same(schema.$defs.rfc3339Utc?.pattern, RFC3339_UTC_PATTERN)
      expect(schema.$defs.issuer?.maxLength).toBe(formats.ISSUER_MAX_LENGTH)
    }
    for (const schema of [unlockSchema, policySchema]) {
      same(schema.$defs.subject?.pattern, formats.SUBJECT_PATTERN)
      same(schema.$defs.sha256Base64Url?.pattern, formats.SHA256_BASE64URL_PATTERN)
    }
    same(timeSchema.properties.nonce?.pattern as string, formats.NONCE_PATTERN)
    same(timeSchema.properties.boot?.pattern as string, formats.BOOT_ID_PATTERN)
    same(unlockSchema.properties.rule?.pattern as string, formats.RULE_ID_PATTERN)
    same(policySchema.properties.tz?.pattern as string, formats.TIME_ZONE_PATTERN)
    const scopes = (unlockSchema.properties.scope?.oneOf ?? []) as {
      properties: { value: { pattern: string } }
    }[]
    same(scopes[0]?.properties.value.pattern, formats.SCOPE_DOMAIN_PATTERN)
    same(scopes[1]?.properties.value.pattern, formats.SCOPE_PATH_PATTERN)
    same(scopes[2]?.properties.value.pattern, formats.SCOPE_APP_PATTERN)
  })
})
