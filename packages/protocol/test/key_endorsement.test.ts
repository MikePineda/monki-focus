// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { adoptEndorsedKey } from '../src/adopt_endorsed_key.ts'
import { encodeBase64Url } from '../src/base64url.ts'
import { privateKeyFromSeed } from '../src/ed25519_key.ts'
import { issueKeyEndorsement } from '../src/issue_key_endorsement.ts'
import type { KeyEndorsementClaims } from '../src/key_endorsement_claims.ts'
import { createKeyring, type PinnedKey } from '../src/keyring.ts'
import { parseRfc3339Utc } from '../src/rfc3339_utc.ts'
import type { TokenErrorCode } from '../src/token_error.ts'
import type { KeyPurpose } from '../src/token_purpose.ts'
import { verifyKeyEndorsement } from '../src/verify_key_endorsement.ts'
import { hexBytes, packageRoot, testOnlySeed } from './token_vector_loader.ts'

interface EndorsementVector {
  readonly id: string
  readonly kind: 'key-endorsement'
  readonly token: string
  readonly verify: {
    readonly purpose: KeyPurpose
    readonly keyring: readonly { readonly kid: string; readonly publicKeyHex: string }[]
    readonly issuer: string
    readonly now: string
  }
  readonly expect:
    | { readonly result: 'valid'; readonly kid: string; readonly claims: KeyEndorsementClaims }
    | { readonly result: 'invalid'; readonly error: TokenErrorCode }
  readonly construction: { readonly claimsJson: string }
}

const dir = join(packageRoot, 'fixtures/key-endorsements')
const vectors = readdirSync(dir)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as EndorsementVector)
const byId = (id: string) => {
  const vector = vectors.find((candidate) => candidate.id === id)
  if (vector === undefined) throw new Error(`missing vector ${id}`)
  return vector
}

const pinnedOf = (vector: EndorsementVector): PinnedKey[] =>
  vector.verify.keyring.map(({ kid, publicKeyHex }) => ({ kid, publicKey: hexBytes(publicKeyHex) }))

/** What every platform does with a vector: build the keyring (its failure is the result), then verify. */
function run(vector: EndorsementVector) {
  const keyring = createKeyring(vector.verify.purpose, pinnedOf(vector))
  if (!keyring.ok) return keyring
  return verifyKeyEndorsement(vector.token, {
    keyring: keyring.value,
    issuer: vector.verify.issuer,
    now: parseRfc3339Utc(vector.verify.now) ?? Number.NaN,
  })
}

function secretOf(name: string) {
  const secret = privateKeyFromSeed(hexBytes(testOnlySeed(name)))
  if (!secret.ok) throw new Error('bad test seed')
  return secret.value
}

const valid = byId('valid_key_endorsement')
const claims = JSON.parse(valid.construction.claimsJson) as KeyEndorsementClaims
const endorser = pinnedOf(valid)[0]
if (endorser === undefined) throw new Error('vector keyring too short')
const signingKeyA = { kid: endorser.kid, secretKey: secretOf('test-key-not-real-unlock-a') }
const now = parseRfc3339Utc(valid.verify.now) ?? 0

afterEach(() => {
  vi.restoreAllMocks()
})

describe('shared key-endorsement vectors', () => {
  it.each(vectors.map((vector) => [vector.id, vector] as const))('%s', (_id, vector) => {
    const result = run(vector)
    if (vector.expect.result === 'valid') {
      expect(result).toMatchObject({
        ok: true,
        value: {
          endorserKid: vector.expect.kid,
          claims: vector.expect.claims,
          endorsed: { kid: vector.expect.claims.kid },
        },
      })
    } else {
      expect(result).toEqual({ ok: false, error: { code: vector.expect.error } })
    }
  })

  it('test_vectors_cover_every_rotation_rule', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(20)
    const errors = new Set(
      vectors.flatMap((vector) => (vector.expect.result === 'invalid' ? [vector.expect.error] : []))
    )
    for (const code of [
      'expired',
      'not_yet_valid',
      'lifetime_too_long',
      'unknown_kid',
      'invalid_signature',
      'binding_mismatch',
      'issuer_mismatch',
      'invalid_claims',
      'wrong_typ',
    ] as const) {
      expect(errors).toContain(code)
    }
  })
})

describe('issueKeyEndorsement', () => {
  it('test_issuer_output_is_the_vector_token_byte_for_byte', () => {
    expect(issueKeyEndorsement(claims, signingKeyA)).toEqual({ ok: true, value: valid.token })
  })

  it.each([
    ['a kid not derived from x', { ...claims, kid: 'AAAAAAAAAAAAAAAA' }, 'invalid_claims'],
    [
      'a self endorsement',
      { ...claims, kid: endorser.kid, x: encodeBase64Url(endorser.publicKey) },
      'invalid_claims',
    ],
    [
      'a lifetime over ninety days',
      { ...claims, exp: '2026-04-05T08:00:01Z' },
      'lifetime_too_long',
    ],
    ['nbf before iat', { ...claims, nbf: '2026-01-05T07:59:59Z' }, 'invalid_claims'],
    ['an unknown claim', { ...claims, admin: true }, 'invalid_claims'],
    ['a purpose outside unlock and policy', { ...claims, use: 'time' }, 'invalid_claims'],
  ] as const)('test_issuer_refuses_%s', (_label, bad, code) => {
    expect(issueKeyEndorsement(bad as unknown as KeyEndorsementClaims, signingKeyA)).toEqual({
      ok: false,
      error: { code },
    })
  })

  it('test_issuer_refuses_a_signing_key_whose_kid_does_not_match', () => {
    const wrongKid = { kid: 'vwgmfejyAb19q2Jq', secretKey: signingKeyA.secretKey }
    expect(issueKeyEndorsement(claims, wrongKid)).toEqual({
      ok: false,
      error: { code: 'invalid_input' },
    })
  })

  it('test_issuer_refuses_an_http_issuer_in_the_release_profile', () => {
    const local = { ...claims, iss: 'http://127.0.0.1:3333' }
    expect(issueKeyEndorsement(local, signingKeyA)).toEqual({
      ok: false,
      error: { code: 'invalid_input' },
    })
    expect(issueKeyEndorsement(local, signingKeyA, { profile: 'development' }).ok).toBe(true)
  })
})

describe('verifyKeyEndorsement', () => {
  const keyring = createKeyring('unlock', [endorser])
  if (!keyring.ok) throw new Error('bad keyring')

  it('test_claims_json_is_never_parsed_before_the_signature_verifies', () => {
    const parse = vi.spyOn(JSON, 'parse')
    const result = verifyKeyEndorsement(byId('tampered_key_endorsement_is_rejected').token, {
      keyring: keyring.value,
      issuer: valid.verify.issuer,
      now,
    })
    expect(result.ok).toBe(false)
    expect(parse).not.toHaveBeenCalled()
  })

  it.each([undefined, null, 42, '', 'v4.public.', {}, 'v4.public.AAAA.AAAA'])(
    'test_never_throws_on_%s',
    (token) => {
      expect(() =>
        verifyKeyEndorsement(token, { keyring: keyring.value, issuer: valid.verify.issuer, now })
      ).not.toThrow()
      expect(
        verifyKeyEndorsement(token, { keyring: keyring.value, issuer: valid.verify.issuer, now }).ok
      ).toBe(false)
    }
  )

  it('test_a_keyring_not_built_by_create_keyring_is_invalid_input', () => {
    const forged = { purpose: 'unlock', kids: [endorser.kid] } as const
    expect(
      verifyKeyEndorsement(valid.token, { keyring: forged, issuer: valid.verify.issuer, now })
    ).toEqual({ ok: false, error: { code: 'invalid_input' } })
  })

  it('test_a_non_integer_now_is_invalid_input', () => {
    expect(
      verifyKeyEndorsement(valid.token, {
        keyring: keyring.value,
        issuer: valid.verify.issuer,
        now: Number.NaN,
      })
    ).toEqual({ ok: false, error: { code: 'invalid_input' } })
  })
})

describe('adoptEndorsedKey', () => {
  const successor = { kid: claims.kid, publicKey: Buffer.from(claims.x, 'base64url') }
  const context = { issuer: valid.verify.issuer, now }

  it('test_client_keeps_the_endorsing_key_and_the_new_key', () => {
    const adopted = adoptEndorsedKey('unlock', [endorser], valid.token, context)
    expect(adopted.ok).toBe(true)
    if (!adopted.ok) return
    expect(adopted.value.pinned.map((key) => key.kid)).toEqual([endorser.kid, successor.kid])
    expect(adopted.value.keyring.kids).toEqual([endorser.kid, successor.kid])
  })

  it('test_client_drops_every_other_pinned_key_on_rotation', () => {
    const older = byId('valid_policy_key_endorsement').verify.keyring[0]
    if (older === undefined) throw new Error('missing key')
    const stale = { kid: older.kid, publicKey: hexBytes(older.publicKeyHex) }
    const adopted = adoptEndorsedKey('unlock', [stale, endorser], valid.token, context)
    expect(adopted.ok).toBe(true)
    if (!adopted.ok) return
    expect(adopted.value.pinned.map((key) => key.kid)).toEqual([endorser.kid, successor.kid])
  })

  it('test_client_refuses_an_endorsement_by_a_key_it_does_not_pin', () => {
    expect(adoptEndorsedKey('unlock', [successor], valid.token, context)).toEqual({
      ok: false,
      error: { code: 'unknown_kid' },
    })
  })

  it('test_client_refuses_an_unlock_endorsement_for_its_policy_keyring', () => {
    const policyPinned = pinnedOf(byId('valid_policy_key_endorsement'))
    expect(adoptEndorsedKey('policy', policyPinned, valid.token, context)).toEqual({
      ok: false,
      error: { code: 'unknown_kid' },
    })
  })
})
