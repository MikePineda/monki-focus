// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import {
  canonicalUnlockMessage,
  decodeBase64Url,
  parseRfc3339Utc,
  verifyPolicyToken,
  verifyTimeToken,
  verifyUnlockToken,
  type UnlockClaims,
} from '@monki-focus/protocol'
import {
  issueUnlock,
  type UnlockGrant,
  type UnlockIssuerContext,
} from '#domain/unlock/unlock_token_issuer'
import { unlockTokenHash } from '#domain/unlock/unlock_token_ledger'
import {
  pinnedKeyring,
  protocolVector,
  testOnlyKey,
  testOnlyPublicSuffixCheck,
} from '#tests/support/test_only_keys'

const ISSUER = 'https://focus.example.org'
const DEVICE = '6f1c2d3e-4b5a-4c6d-8e7f-90a1b2c3d4e5'
const NOW = parseRfc3339Utc('2026-01-05T09:00:00Z')!
const unlockKey = testOnlyKey('test-key-not-real-unlock-a')
const policyKey = testOnlyKey('test-key-not-real-policy-a')

const grant: UnlockGrant = {
  subject: 'user-1',
  deviceUuid: DEVICE,
  rule: 'social.video-feed',
  scope: { kind: 'domain', value: 'video.example.com', includeSubdomains: false },
  durationSeconds: 900,
  requestUuid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  policyHash: 'FhXbYQzF27g8nyglmbU0-t5tCOlmD2PshdAxmVZsGuI',
}

function context(overrides: Partial<UnlockIssuerContext> = {}): UnlockIssuerContext {
  return {
    issuer: ISSUER,
    profile: 'release',
    signingKey: unlockKey,
    now: NOW,
    lifetimeCapSeconds: 120 * 60,
    isRegistrableDomain: testOnlyPublicSuffixCheck(),
    newTokenId: () => '3b0e5f1a-7c2d-4e8f-9a6b-1c2d3e4f5a6b',
    ...overrides,
  }
}

function issued(overrides: Partial<UnlockGrant> = {}, ctx: Partial<UnlockIssuerContext> = {}) {
  const outcome = issueUnlock({ ...grant, ...overrides }, context(ctx))
  if (!outcome.ok) throw new Error(`refused: ${outcome.reason}`)
  return outcome.value
}

function verifyAt(token: string, now: number) {
  return verifyUnlockToken(token, {
    keyring: pinnedKeyring('unlock', unlockKey),
    issuer: ISSUER,
    device: DEVICE,
    now,
  })
}

test.group('Unlock token issuer', () => {
  test('test_issued_unlock_token_verifies_with_the_protocol_verifier_and_binds_every_claim', ({
    assert,
  }) => {
    const { token, claims } = issued()
    const verified = verifyAt(token, NOW)

    assert.isTrue(verified.ok)
    if (!verified.ok) return
    assert.equal(verified.value.kid, unlockKey.kid)
    assert.deepEqual(verified.value.claims, {
      v: 1,
      typ: 'unlock',
      iss: ISSUER,
      sub: 'user-1',
      dev: DEVICE,
      rule: 'social.video-feed',
      scope: { kind: 'domain', value: 'video.example.com', includeSubdomains: false },
      dur_s: 900,
      iat: '2026-01-05T09:00:00Z',
      nbf: '2026-01-05T09:00:00Z',
      exp: '2026-01-05T11:00:00Z',
      jti: '3b0e5f1a-7c2d-4e8f-9a6b-1c2d3e4f5a6b',
      req: grant.requestUuid,
      pol: grant.policyHash,
    } satisfies UnlockClaims)
    assert.deepEqual(verified.value.claims, claims)
  })

  test('test_signing_matches_protocol_vector_bytes_exactly', ({ assert }) => {
    const vector = protocolVector('unlock-tokens', 'valid_unlock_token')

    assert.equal(issued({ validForSeconds: 30 * 60 }).token, vector.token)
  })

  test('test_signed_message_is_the_canonical_serialisation', ({ assert }) => {
    const { token, claims } = issued()
    const body = decodeBase64Url(token.slice('v4.public.'.length).split('.')[0])!
    const message = Buffer.from(body.subarray(0, body.length - 64)).toString('utf8')

    assert.equal(message, canonicalUnlockMessage(claims))
  })

  test('test_token_verifies_within_60_seconds_of_skew_and_not_beyond', ({ assert }) => {
    const { token } = issued({ validForSeconds: 1800 })

    assert.isTrue(verifyAt(token, NOW - 60).ok)
    assert.deepEqual(verifyAt(token, NOW - 61), { ok: false, error: { code: 'not_yet_valid' } })
    assert.isTrue(verifyAt(token, NOW + 1800 + 60).ok)
    assert.deepEqual(verifyAt(token, NOW + 1800 + 61), { ok: false, error: { code: 'expired' } })
  })

  test('test_lifetime_defaults_to_and_is_capped_by_the_instance_setting', ({ assert }) => {
    const ctx = { lifetimeCapSeconds: 30 * 60 }

    assert.equal(issued({}, ctx).ledger.expiresAt - NOW, 30 * 60)
    assert.deepEqual(issueUnlock({ ...grant, validForSeconds: 30 * 60 + 1 }, context(ctx)), {
      ok: false,
      reason: 'lifetime_over_cap',
    })
  })

  test('test_lifetime_never_exceeds_four_hours_whatever_the_setting', ({ assert }) => {
    const ctx = { lifetimeCapSeconds: 24 * 60 * 60 }

    assert.equal(issued({}, ctx).ledger.expiresAt - NOW, 4 * 60 * 60)
    assert.deepEqual(issueUnlock({ ...grant, validForSeconds: 4 * 60 * 60 + 1 }, context(ctx)), {
      ok: false,
      reason: 'lifetime_over_cap',
    })
  })

  test('test_duration_must_fit_60_to_7200_seconds_and_the_token_lifetime', ({ assert }) => {
    for (const [durationSeconds, validForSeconds] of [
      [59, 3600],
      [7201, 4 * 60 * 60],
      [1801, 1800],
      [900.5, 3600],
    ]) {
      assert.deepEqual(
        issueUnlock(
          { ...grant, durationSeconds, validForSeconds },
          context({ lifetimeCapSeconds: 14400 })
        ),
        { ok: false, reason: 'duration_out_of_range' },
        `${durationSeconds}/${validForSeconds}`
      )
    }
    assert.isTrue(
      issueUnlock({ ...grant, durationSeconds: 1800, validForSeconds: 1800 }, context()).ok
    )
  })

  test('test_include_subdomains_requires_a_registrable_domain', ({ assert }) => {
    for (const value of ['co.uk', 'github.io', 'blogspot.com']) {
      assert.deepEqual(
        issueUnlock(
          { ...grant, scope: { kind: 'domain', value, includeSubdomains: true } },
          context()
        ),
        { ok: false, reason: 'scope_not_registrable' },
        value
      )
    }
    for (const value of ['example.co.uk', 'project.github.io', 'video.example.com']) {
      assert.isTrue(
        issueUnlock(
          { ...grant, scope: { kind: 'domain', value, includeSubdomains: true } },
          context()
        ).ok,
        value
      )
    }
  })

  test('test_an_exact_domain_scope_never_consults_the_public_suffix_list', ({ assert }) => {
    const outcome = issueUnlock(grant, context({ isRegistrableDomain: () => false }))

    assert.isTrue(outcome.ok)
  })

  test('test_path_and_app_scopes_carry_only_their_members', ({ assert }) => {
    const path = issued({
      scope: {
        kind: 'path',
        value: 'forum.example.com/r/example-topic',
        includeSubdomains: true,
      } as never,
    })
    const app = issued({ scope: { kind: 'app', value: 'com.example.video' } })

    assert.deepEqual(path.claims.scope, {
      kind: 'path',
      value: 'forum.example.com/r/example-topic',
    })
    assert.deepEqual(app.claims.scope, { kind: 'app', value: 'com.example.video' })
    assert.isTrue(verifyAt(path.token, NOW).ok)
  })

  test('test_wildcards_and_malformed_claims_are_refused_by_the_protocol_rules', ({ assert }) => {
    const wildcard = issueUnlock(
      { ...grant, scope: { kind: 'domain', value: '*.example.com', includeSubdomains: false } },
      context()
    )
    const badDevice = issueUnlock({ ...grant, deviceUuid: 'not-a-uuid' }, context())

    assert.deepEqual(wildcard, { ok: false, reason: 'invalid_claims' })
    assert.deepEqual(badDevice, { ok: false, reason: 'invalid_claims' })
  })

  test('test_only_an_unlock_signing_key_signs_unlock_tokens', ({ assert }) => {
    assert.deepEqual(issueUnlock(grant, context({ signingKey: policyKey })), {
      ok: false,
      reason: 'wrong_key_purpose',
    })
  })

  test('test_an_http_issuer_is_refused_in_the_release_profile', ({ assert }) => {
    const local = context({ issuer: 'http://127.0.0.1:3333' })

    assert.deepEqual(issueUnlock(grant, local), { ok: false, reason: 'invalid_input' })
    assert.isTrue(issueUnlock(grant, { ...local, profile: 'development' }).ok)
  })

  test('test_server_time_must_be_whole_epoch_seconds', ({ assert }) => {
    for (const now of [NOW + 0.5, -1, Number.NaN]) {
      assert.deepEqual(issueUnlock(grant, context({ now })), { ok: false, reason: 'invalid_input' })
    }
  })

  test('test_unlock_token_never_verifies_as_a_policy_or_time_token', ({ assert }) => {
    const { token } = issued()
    const asPolicy = verifyPolicyToken(token, {
      keyring: pinnedKeyring('policy', policyKey),
      issuer: ISSUER,
      device: DEVICE,
      now: NOW,
    })
    const asTime = verifyTimeToken(token, {
      keyring: pinnedKeyring('unlock', unlockKey),
      issuer: ISSUER,
      device: DEVICE,
      nonce: 'AAECAwQFBgcICQoLDA0ODw',
      boot: '41',
    })

    assert.deepEqual(asPolicy, { ok: false, error: { code: 'unknown_kid' } })
    assert.deepEqual(asTime, { ok: false, error: { code: 'invalid_signature' } })
  })

  test('test_ledger_entry_matches_the_claims_and_stores_only_the_token_hash', ({ assert }) => {
    const { token, claims, ledger } = issued({ validForSeconds: 1800 })

    assert.deepEqual(ledger, {
      jti: claims.jti,
      requestUuid: claims.req,
      deviceUuid: DEVICE,
      kid: unlockKey.kid,
      tokenHash: unlockTokenHash(token),
      issuedAt: NOW,
      notBefore: NOW,
      expiresAt: NOW + 1800,
      revokedAt: null,
    })
    assert.match(ledger.tokenHash, /^[0-9a-f]{64}$/)
    assert.notInclude(JSON.stringify(ledger), token)
  })
})
