// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { encodeBase64Url } from '../src/base64url.ts'
import { privateKeyFromSeed } from '../src/ed25519_key.ts'
import { issuePolicyToken, issueTimeToken, issueUnlockToken } from '../src/issue_token.ts'
import { createKeyring, type Keyring } from '../src/keyring.ts'
import type { PolicyClaims } from '../src/policy_claims.ts'
import { parseRfc3339Utc } from '../src/rfc3339_utc.ts'
import type { TimeClaims } from '../src/time_claims.ts'
import type { UnlockClaims } from '../src/unlock_claims.ts'
import { verifyPolicyToken, verifyTimeToken, verifyUnlockToken } from '../src/verify_token.ts'
import { hexBytes, loadTokenVectors, testOnlySeed } from './token_vector_loader.ts'

const vectors = loadTokenVectors('unlock-tokens')
const byId = (id: string) => {
  const vector = vectors.find((candidate) => candidate.id === id)
  if (vector === undefined) throw new Error(`missing vector ${id}`)
  return vector
}
const valid = byId('valid_unlock_token')
const claims = JSON.parse(valid.construction.claimsJson) as UnlockClaims
const keyA = valid.verify.keyring[0]
const keyB = valid.verify.keyring[1]
if (keyA === undefined || keyB === undefined) throw new Error('vector keyring too short')

const secretA = privateKeyFromSeed(hexBytes(testOnlySeed('test-key-not-real-unlock-a')))
if (!secretA.ok) throw new Error('bad test seed')
const signingKeyA = { kid: keyA.kid, secretKey: secretA.value }

function keyring(purpose: 'unlock' | 'policy' = 'unlock'): Keyring {
  const result = createKeyring(purpose, [
    { kid: keyA?.kid ?? '', publicKey: hexBytes(keyA?.publicKeyHex ?? '') },
  ])
  if (!result.ok) throw new Error('bad keyring')
  return result.value
}

const bothKeysResult = createKeyring('unlock', [
  { kid: keyA.kid, publicKey: hexBytes(keyA.publicKeyHex) },
  { kid: keyB.kid, publicKey: hexBytes(keyB.publicKeyHex) },
])
if (!bothKeysResult.ok) throw new Error('bad keyring')
const bothKeys = bothKeysResult.value

const context = {
  keyring: keyring(),
  issuer: valid.verify.issuer,
  device: valid.verify.device,
  now: parseRfc3339Utc(valid.verify.now ?? '') ?? 0,
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('verifyUnlockToken', () => {
  it('test_claims_json_is_never_parsed_before_the_signature_verifies', () => {
    const parse = vi.spyOn(JSON, 'parse')
    for (const id of [
      'tampered_payload_is_rejected',
      'tampered_footer_is_rejected',
      'token_for_other_device_fails_implicit_assertion',
      'token_from_other_issuer_fails_implicit_assertion',
      'unknown_kid_is_rejected',
      'untrusted_key_claiming_pinned_kid_is_rejected',
      'v4_local_header_is_rejected',
      'malformed_base64url_non_canonical_is_rejected',
    ]) {
      const vector = byId(id)
      const result = verifyUnlockToken(vector.token, {
        ...context,
        keyring: bothKeys,
        issuer: vector.verify.issuer,
        device: vector.verify.device,
      })
      expect(result.ok).toBe(false)
    }
    expect(parse).not.toHaveBeenCalled()
    expect(verifyUnlockToken(valid.token, context).ok).toBe(true)
    expect(parse).toHaveBeenCalledTimes(1)
  })

  it('test_garbage_input_returns_a_typed_error_and_never_throws', () => {
    const inputs: unknown[] = [
      undefined,
      null,
      42,
      {},
      [],
      '',
      'v4.public.',
      'v4.public..',
      `v4.public.${'A'.repeat(4000)}`,
      `v4.public.${encodeBase64Url(randomBytes(200))}.${encodeBase64Url(randomBytes(20))}`,
      `${valid.token}.extra`,
      valid.token.toUpperCase(),
    ]
    for (let index = 0; index < 200; index++) {
      inputs.push(
        `v4.public.${encodeBase64Url(randomBytes(64 + index))}.eyJraWQiOiJUQmNWb1NMZXV5YkZFT3VWIn0`
      )
    }
    for (const input of inputs) {
      const result = verifyUnlockToken(input, context)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(typeof result.error.code).toBe('string')
    }
  })

  it('test_a_keyring_for_another_purpose_is_refused', () => {
    const policyRing = keyring('policy')
    expect(verifyUnlockToken(valid.token, { ...context, keyring: policyRing })).toEqual({
      ok: false,
      error: { code: 'invalid_input' },
    })
  })

  it('test_a_hand_made_keyring_object_is_refused', () => {
    const forged = { purpose: 'unlock', kids: [keyA.kid] } as Keyring
    expect(verifyUnlockToken(valid.token, { ...context, keyring: forged })).toEqual({
      ok: false,
      error: { code: 'invalid_input' },
    })
  })

  it('test_an_issuer_or_device_that_could_break_the_assertion_is_refused', () => {
    for (const bad of [
      { issuer: `${context.issuer}|x` },
      { issuer: `${context.issuer}/` },
      { device: `${context.device}|x` },
      { device: context.device.toUpperCase() },
      { now: 1.5 },
      { now: Number.NaN },
    ]) {
      expect(verifyUnlockToken(valid.token, { ...context, ...bad })).toEqual({
        ok: false,
        error: { code: 'invalid_input' },
      })
    }
  })

  it('test_a_policy_verifier_never_accepts_an_unlock_token_even_with_the_same_key', () => {
    // Misconfiguration: the unlock key pinned as a policy key.
    const result = verifyPolicyToken(valid.token, { ...context, keyring: keyring('policy') })
    expect(result).toEqual({ ok: false, error: { code: 'invalid_signature' } })
  })
})

describe('createKeyring', () => {
  const a = { kid: keyA.kid, publicKey: hexBytes(keyA.publicKeyHex) }
  const b = { kid: keyB.kid, publicKey: hexBytes(keyB.publicKeyHex) }

  it('test_keyring_accepts_at_most_two_active_kids', () => {
    expect(createKeyring('unlock', [a, b]).ok).toBe(true)
    expect(createKeyring('unlock', [a, b, a]).ok).toBe(false)
    expect(createKeyring('unlock', []).ok).toBe(false)
  })

  it('test_keyring_refuses_a_kid_not_derived_from_its_key', () => {
    expect(createKeyring('unlock', [{ kid: b.kid, publicKey: a.publicKey }]).ok).toBe(false)
  })

  it('test_keyring_refuses_duplicate_kids_and_bad_key_lengths', () => {
    expect(createKeyring('unlock', [a, a]).ok).toBe(false)
    expect(createKeyring('unlock', [{ kid: a.kid, publicKey: a.publicKey.subarray(1) }]).ok).toBe(
      false
    )
  })
})

describe('issueUnlockToken', () => {
  it('test_issuer_reproduces_the_shared_valid_vector', () => {
    expect(issueUnlockToken(claims, signingKeyA)).toEqual({ ok: true, value: valid.token })
  })

  it('test_issuer_refuses_claims_a_verifier_would_reject', () => {
    const iat = claims.iat
    const cases: [Partial<Record<keyof UnlockClaims, unknown>>, string][] = [
      [{ exp: '2026-01-05T13:00:01Z' }, 'lifetime_too_long'],
      [{ dur_s: 3600 }, 'invalid_claims'],
      [{ nbf: '2026-01-05T08:59:59Z' }, 'invalid_claims'],
      [{ exp: iat }, 'invalid_claims'],
      [{ scope: { kind: 'domain', value: '*' } }, 'invalid_claims'],
      [{ typ: 'policy' }, 'invalid_claims'],
    ]
    for (const [patch, code] of cases) {
      const result = issueUnlockToken({ ...claims, ...patch } as UnlockClaims, signingKeyA)
      expect(result).toEqual({ ok: false, error: { code } })
    }
  })

  it('test_issuer_refuses_a_kid_that_does_not_match_the_key', () => {
    expect(issueUnlockToken(claims, { ...signingKeyA, kid: keyB.kid })).toEqual({
      ok: false,
      error: { code: 'invalid_input' },
    })
  })
})

describe('issuePolicyToken', () => {
  it('test_policy_issuer_refuses_a_lifetime_over_thirty_days', () => {
    const policy = JSON.parse(
      loadTokenVectors('policy-tokens').find((vector) => vector.id === 'valid_policy_token')
        ?.construction.claimsJson ?? '{}'
    ) as PolicyClaims
    expect(issuePolicyToken({ ...policy, exp: '2026-02-05T08:00:00Z' }, signingKeyA)).toEqual({
      ok: false,
      error: { code: 'lifetime_too_long' },
    })
  })
})

describe('verifyTimeToken', () => {
  const timeVector = loadTokenVectors('time-tokens').find(
    (vector) => vector.id === 'valid_time_token'
  )
  if (timeVector === undefined) throw new Error('missing time vector')
  const timeContext = {
    keyring: bothKeys,
    issuer: timeVector.verify.issuer,
    device: timeVector.verify.device,
    nonce: timeVector.verify.nonce ?? '',
    boot: timeVector.verify.boot ?? '',
  }

  it('test_issuer_reproduces_the_shared_time_vector', () => {
    const timeClaims = JSON.parse(timeVector.construction.claimsJson) as TimeClaims
    expect(issueTimeToken(timeClaims, signingKeyA)).toEqual({ ok: true, value: timeVector.token })
  })

  it('test_time_token_needs_a_well_formed_nonce_and_boot', () => {
    for (const bad of [{ nonce: 'short' }, { boot: '41|x' }, { boot: '' }]) {
      expect(verifyTimeToken(timeVector.token, { ...timeContext, ...bad })).toEqual({
        ok: false,
        error: { code: 'invalid_input' },
      })
    }
  })

  it('test_time_token_needs_the_unlock_keyring', () => {
    expect(
      verifyTimeToken(timeVector.token, { ...timeContext, keyring: keyring('policy') })
    ).toEqual({ ok: false, error: { code: 'invalid_input' } })
  })
})

describe('issuer profiles', () => {
  it('test_development_profile_accepts_only_loopback_http', () => {
    const local = { ...claims, iss: 'http://localhost:3333' }
    expect(issueUnlockToken(local, signingKeyA).ok).toBe(false)
    const issued = issueUnlockToken(local, signingKeyA, { profile: 'development' })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    const base = { ...context, keyring: bothKeys, issuer: local.iss }
    expect(verifyUnlockToken(issued.value, base)).toEqual({
      ok: false,
      error: { code: 'invalid_input' },
    })
    expect(verifyUnlockToken(issued.value, { ...base, issuerProfile: 'development' }).ok).toBe(true)
  })
})
