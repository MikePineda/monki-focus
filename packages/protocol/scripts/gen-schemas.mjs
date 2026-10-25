#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Writes `schema/*.claims.schema.json` from the reference formats in
 * `src/claim_formats.ts`, so the schemas and the hand-written validators use
 * the very same patterns. `test/claims_schema.test.ts` checks that both
 * agree on every vector and on a battery of mutations, and that the committed
 * schemas equal this script's output.
 *
 *   node scripts/gen-schemas.mjs   # write (then run prettier on schema/)
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as f from '../src/claim_formats.ts'
import { RFC3339_UTC_PATTERN } from '../src/rfc3339_utc.ts'
import { MAX_REVOKED_PER_TIME_TOKEN } from '../src/time_claims.ts'
import { PUBLIC_KEY_BASE64URL_PATTERN } from '../src/key_endorsement_claims.ts'
import { UNLOCK_MAX_DURATION_SECONDS, UNLOCK_MIN_DURATION_SECONDS } from '../src/unlock_claims.ts'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = (regex) => regex.source.replaceAll('\\/', '/')
const ref = (name, description) => ({
  $ref: `#/$defs/${name}`,
  ...(description ? { description } : {}),
})

const allDefs = {
  issuer: {
    type: 'string',
    maxLength: f.ISSUER_MAX_LENGTH,
    pattern: src(f.ISSUER_PATTERN),
    description:
      'Instance origin. Release: lowercase https://host, no port, path or trailing slash. Development only: http://localhost or http://127.0.0.1 with an optional non-default port. Never contains "|".',
  },
  uuid: {
    type: 'string',
    maxLength: 36,
    pattern: src(f.UUID_PATTERN),
    description: 'Lowercase canonical UUID.',
  },
  subject: {
    type: 'string',
    maxLength: 64,
    pattern: src(f.SUBJECT_PATTERN),
    description: 'Opaque user id on the instance.',
  },
  sha256Base64Url: {
    type: 'string',
    maxLength: 43,
    pattern: src(f.SHA256_BASE64URL_PATTERN),
    description: 'Unpadded base64url SHA-256 digest.',
  },
  rfc3339Utc: {
    type: 'string',
    maxLength: 20,
    pattern: src(RFC3339_UTC_PATTERN),
    description:
      'UTC instant as YYYY-MM-DDTHH:MM:SSZ (whole seconds, no offset, year >= 1970). Verifiers also check that the day exists in its month (no 2026-02-30), which a pattern cannot express.',
  },
}

const pick = (...names) => Object.fromEntries(names.map((name) => [name, allDefs[name]]))

const common = {
  v: { const: 1, description: 'Claims format version.' },
  iss: ref('issuer'),
  sub: ref('subject'),
  dev: ref('uuid', 'Device uuid the token is bound to (also bound by the implicit assertion).'),
  iat: ref('rfc3339Utc', 'Issued at (server time).'),
  nbf: ref('rfc3339Utc', 'Not before (server time); iat <= nbf.'),
  exp: ref('rfc3339Utc', 'Expiry (server time); nbf < exp.'),
  jti: ref('uuid', 'Token id, the replay-store key.'),
}

function scope(kind, pattern, maxLength, description, extra = {}) {
  const extraNames = Object.keys(extra)
  return {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'value', ...extraNames],
    properties: {
      kind: { const: kind },
      value: { type: 'string', maxLength, pattern: src(pattern) },
      ...extra,
    },
    description,
  }
}

function document(id, title, description, required, properties, defs) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: id,
    title,
    description,
    type: 'object',
    additionalProperties: false,
    required,
    properties,
    $defs: defs,
  }
}

const CANONICAL =
  'The signed message must also be the canonical serialisation of these claims (docs/protocol/unlock-tokens.md §4.0).'

export function generateSchemas() {
  const unlock = document(
    'urn:monki-focus:protocol:unlock-token-claims:v1',
    'monki-focus unlock token claims (v1)',
    `Claims of a PASETO v4.public unlock token. ${CANONICAL} Semantic rules beyond this schema: iat <= nbf < exp; exp - iat <= 14400; dur_s <= exp - iat; iss and dev equal the pinned issuer and this device.`,
    [
      'v',
      'typ',
      'iss',
      'sub',
      'dev',
      'rule',
      'scope',
      'dur_s',
      'iat',
      'nbf',
      'exp',
      'jti',
      'req',
      'pol',
    ],
    {
      v: common.v,
      typ: { const: 'unlock' },
      iss: common.iss,
      sub: common.sub,
      dev: common.dev,
      rule: {
        type: 'string',
        maxLength: 64,
        pattern: src(f.RULE_ID_PATTERN),
        description: 'Rule id the unlock lifts.',
      },
      scope: {
        description: 'Exactly what is unlocked. Never a wildcard. Matching rules: spec §4.5.',
        oneOf: [
          scope(
            'domain',
            f.SCOPE_DOMAIN_PATTERN,
            f.SCOPE_DOMAIN_MAX_LENGTH,
            'An exact hostname with at least two labels; subdomains only when includeSubdomains is true.',
            {
              includeSubdomains: {
                type: 'boolean',
                description: 'Also match hosts ending in "." + value. Issuers default to false.',
              },
            }
          ),
          scope(
            'path',
            f.SCOPE_PATH_PATTERN,
            f.SCOPE_PATH_MAX_LENGTH,
            'An exact host plus literal path segments (segment-prefix match); no query, fragment, wildcard, %, backslash, empty, "." or ".." segment.'
          ),
          scope(
            'app',
            f.SCOPE_APP_PATTERN,
            f.SCOPE_APP_MAX_LENGTH,
            'An Android package name or Apple bundle id (exact match).'
          ),
        ],
      },
      dur_s: {
        type: 'integer',
        minimum: UNLOCK_MIN_DURATION_SECONDS,
        maximum: UNLOCK_MAX_DURATION_SECONDS,
        description:
          'Unlock length once activated, in seconds (at most 120 minutes, the cap of any guardian link).',
      },
      iat: common.iat,
      nbf: common.nbf,
      exp: common.exp,
      jti: common.jti,
      req: ref('uuid', 'Unlock request uuid this token answers.'),
      pol: ref(
        'sha256Base64Url',
        'Hash of the signed policy the request was made under (heartbeat policyHash).'
      ),
    },
    pick('issuer', 'uuid', 'subject', 'sha256Base64Url', 'rfc3339Utc')
  )

  const policy = document(
    'urn:monki-focus:protocol:policy-token-claims:v1',
    'monki-focus policy token claims (v1)',
    `Claims of a PASETO v4.public policy token, signed with the policy-signing key. ${CANONICAL} Semantic rules beyond this schema: iat <= nbf < exp; exp - iat <= 2592000 (30 days); iss and dev equal the pinned issuer and this device; ver never decreases on a device.`,
    ['v', 'typ', 'iss', 'sub', 'dev', 'ver', 'tz', 'rules_sha256', 'iat', 'nbf', 'exp', 'jti'],
    {
      v: common.v,
      typ: { const: 'policy' },
      iss: common.iss,
      sub: common.sub,
      dev: common.dev,
      ver: {
        type: 'integer',
        minimum: 1,
        maximum: 2147483647,
        description: 'Monotonic policy version.',
      },
      tz: {
        type: 'string',
        maxLength: f.TIME_ZONE_MAX_LENGTH,
        pattern: src(f.TIME_ZONE_PATTERN),
        description: 'IANA time zone the policy is evaluated in.',
      },
      rules_sha256: ref('sha256Base64Url', 'SHA-256 of the canonical rule-set document in force.'),
      iat: common.iat,
      nbf: common.nbf,
      exp: common.exp,
      jti: common.jti,
    },
    pick('issuer', 'uuid', 'subject', 'sha256Base64Url', 'rfc3339Utc')
  )

  const time = document(
    'urn:monki-focus:protocol:time-token-claims:v1',
    'monki-focus time token claims (v1)',
    `Claims of a PASETO v4.public time token, signed with the unlock-signing key and bound by its implicit assertion to the request's nonce and boot id. ${CANONICAL} Semantic rules beyond this schema: iss, dev, nonce and boot equal the pinned issuer, this device and the request.`,
    ['v', 'typ', 'iss', 'dev', 'nonce', 'boot', 'srv', 'revoked', 'complete'],
    {
      v: common.v,
      typ: { const: 'time' },
      iss: common.iss,
      dev: common.dev,
      nonce: {
        type: 'string',
        maxLength: 22,
        pattern: src(f.NONCE_PATTERN),
        description: 'The 16-byte random nonce the client sent, unpadded base64url.',
      },
      boot: {
        type: 'string',
        maxLength: 64,
        pattern: src(f.BOOT_ID_PATTERN),
        description: 'The boot id the client sent.',
      },
      srv: ref('rfc3339Utc', 'Server time when the answer was signed.'),
      revoked: {
        type: 'array',
        maxItems: MAX_REVOKED_PER_TIME_TOKEN,
        description: 'Revoked, not yet expired unlock tokens of this device.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['jti', 'exp'],
          properties: { jti: ref('uuid'), exp: ref('rfc3339Utc') },
        },
      },
      complete: {
        type: 'boolean',
        description:
          'False when more revocations exist than fit; the client then revalidates every received or active unlock.',
      },
    },
    pick('issuer', 'uuid', 'rfc3339Utc')
  )

  const keyEndorsement = document(
    'urn:monki-focus:protocol:key-endorsement-claims:v1',
    'monki-focus key endorsement claims (v1)',
    `Claims of a PASETO v4.public key endorsement, signed by the previous active key of the same purpose with footer {"kid":"<old kid>"} and implicit assertion "monki-focus/key/v1|" + iss + "|" + use. ${CANONICAL} Semantic rules beyond this schema: kid is derived from x; x passes the strict Ed25519 key checks; kid differs from the endorsing kid; iat <= nbf < exp; exp - iat <= 7776000 (90 days); iss equals the pinned issuer and use the keyring purpose.`,
    ['v', 'typ', 'iss', 'use', 'kid', 'x', 'iat', 'nbf', 'exp'],
    {
      v: common.v,
      typ: { const: 'key' },
      iss: common.iss,
      use: {
        enum: ['unlock', 'policy'],
        description: 'Key purpose of the endorsed key (and of the endorsing key).',
      },
      kid: {
        type: 'string',
        maxLength: 16,
        pattern: src(f.KEY_ID_PATTERN),
        description: 'Key id of the endorsed key: first 16 characters of base64url(SHA-256(x)).',
      },
      x: {
        type: 'string',
        maxLength: 43,
        pattern: src(PUBLIC_KEY_BASE64URL_PATTERN),
        description: 'The endorsed raw 32-byte Ed25519 public key, unpadded base64url.',
      },
      iat: common.iat,
      nbf: common.nbf,
      exp: ref('rfc3339Utc', 'Expiry of the endorsement (server time); nbf < exp.'),
    },
    pick('issuer', 'rfc3339Utc')
  )

  return {
    'schema/key-endorsement.claims.schema.json': keyEndorsement,
    'schema/unlock-token.claims.schema.json': unlock,
    'schema/policy-token.claims.schema.json': policy,
    'schema/time-token.claims.schema.json': time,
  }
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const [path, schema] of Object.entries(generateSchemas())) {
    writeFileSync(join(packageRoot, path), `${JSON.stringify(schema, null, 2)}\n`)
  }
  console.log('Wrote schemas.')
}
