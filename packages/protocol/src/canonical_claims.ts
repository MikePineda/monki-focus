// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Canonical serialisation of claims (spec §4.0). The signed message MUST be
 * exactly these bytes: UTF-8 without BOM, no whitespace outside strings,
 * members in the order of the claims tables, strings written raw (every
 * permitted value is printable ASCII without `"` or `\`, so no escapes
 * exist), integers in shortest decimal form, booleans as `true` / `false`.
 *
 * The builders take parsed, still-unvalidated JSON and rebuild the expected
 * text by string concatenation (never with a JSON encoder). They return
 * `null` when a member is missing or has a type the canonical form cannot
 * express. Issuers sign their output; verifiers compare it byte for byte
 * with the message, so duplicate keys, reordered members, whitespace,
 * escapes, `1.0` or `1e0` can never verify.
 */
type Encoded = string | null

const RAW_STRING = /^[\x20\x21\x23-\x5b\x5d-\x7e]*$/

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function string(value: unknown): Encoded {
  return typeof value === 'string' && RAW_STRING.test(value) ? `"${value}"` : null
}

function integer(value: unknown): Encoded {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? String(value) : null
}

function boolean(value: unknown): Encoded {
  return value === true ? 'true' : value === false ? 'false' : null
}

function object(members: readonly (readonly [string, Encoded])[]): Encoded {
  const parts: string[] = []
  for (const [name, encoded] of members) {
    if (encoded === null) return null
    parts.push(`"${name}":${encoded}`)
  }
  return `{${parts.join(',')}}`
}

function scope(value: unknown): Encoded {
  if (!isRecord(value)) return null
  const members: [string, Encoded][] = [
    ['kind', string(value.kind)],
    ['value', string(value.value)],
  ]
  if (value.kind === 'domain') {
    members.push(['includeSubdomains', boolean(value.includeSubdomains)])
  }
  return object(members)
}

function revocations(value: unknown): Encoded {
  if (!Array.isArray(value)) return null
  const items: string[] = []
  for (const item of value as unknown[]) {
    const encoded = isRecord(item)
      ? object([
          ['jti', string(item.jti)],
          ['exp', string(item.exp)],
        ])
      : null
    if (encoded === null) return null
    items.push(encoded)
  }
  return `[${items.join(',')}]`
}

export function canonicalUnlockMessage(claims: unknown): Encoded {
  if (!isRecord(claims)) return null
  return object([
    ['v', integer(claims.v)],
    ['typ', string(claims.typ)],
    ['iss', string(claims.iss)],
    ['sub', string(claims.sub)],
    ['dev', string(claims.dev)],
    ['rule', string(claims.rule)],
    ['scope', scope(claims.scope)],
    ['dur_s', integer(claims.dur_s)],
    ['iat', string(claims.iat)],
    ['nbf', string(claims.nbf)],
    ['exp', string(claims.exp)],
    ['jti', string(claims.jti)],
    ['req', string(claims.req)],
    ['pol', string(claims.pol)],
  ])
}

export function canonicalPolicyMessage(claims: unknown): Encoded {
  if (!isRecord(claims)) return null
  return object([
    ['v', integer(claims.v)],
    ['typ', string(claims.typ)],
    ['iss', string(claims.iss)],
    ['sub', string(claims.sub)],
    ['dev', string(claims.dev)],
    ['ver', integer(claims.ver)],
    ['tz', string(claims.tz)],
    ['rules_sha256', string(claims.rules_sha256)],
    ['iat', string(claims.iat)],
    ['nbf', string(claims.nbf)],
    ['exp', string(claims.exp)],
    ['jti', string(claims.jti)],
  ])
}

export function canonicalKeyEndorsementMessage(claims: unknown): Encoded {
  if (!isRecord(claims)) return null
  return object([
    ['v', integer(claims.v)],
    ['typ', string(claims.typ)],
    ['iss', string(claims.iss)],
    ['use', string(claims.use)],
    ['kid', string(claims.kid)],
    ['x', string(claims.x)],
    ['iat', string(claims.iat)],
    ['nbf', string(claims.nbf)],
    ['exp', string(claims.exp)],
  ])
}

export function canonicalTimeMessage(claims: unknown): Encoded {
  if (!isRecord(claims)) return null
  return object([
    ['v', integer(claims.v)],
    ['typ', string(claims.typ)],
    ['iss', string(claims.iss)],
    ['dev', string(claims.dev)],
    ['nonce', string(claims.nonce)],
    ['boot', string(claims.boot)],
    ['srv', string(claims.srv)],
    ['revoked', revocations(claims.revoked)],
    ['complete', boolean(claims.complete)],
  ])
}
