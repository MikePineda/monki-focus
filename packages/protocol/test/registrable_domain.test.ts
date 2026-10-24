// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { privateKeyFromSeed } from '../src/ed25519_key.ts'
import { issueUnlockToken } from '../src/issue_token.ts'
import { registrableDomainCheck } from '../src/registrable_domain.ts'
import type { UnlockClaims } from '../src/unlock_claims.ts'
import { hexBytes, loadJson, loadTokenVectors, testOnlySeed } from './token_vector_loader.ts'

interface TestSuffixes {
  suffixes: string[]
  cases: { domain: string; registrable: boolean }[]
}

const psl = loadJson('fixtures/public-suffix/test-public-suffixes.json') as TestSuffixes
const isRegistrableDomain = registrableDomainCheck(psl.suffixes)
const valid = loadTokenVectors('unlock-tokens').find((vector) => vector.id === 'valid_unlock_token')
if (valid === undefined) throw new Error('missing vector')
const claims = JSON.parse(valid.construction.claimsJson) as UnlockClaims
const secret = privateKeyFromSeed(hexBytes(testOnlySeed('test-key-not-real-unlock-a')))
if (!secret.ok) throw new Error('bad seed')
const key = {
  kid: valid.expect.result === 'valid' ? valid.expect.kid : '',
  secretKey: secret.value,
}

const withSubdomains = (value: string): UnlockClaims => ({
  ...claims,
  scope: { kind: 'domain', value, includeSubdomains: true },
})

describe('registrable domains (includeSubdomains)', () => {
  it.each(psl.cases.map((entry) => [entry.domain, entry.registrable] as const))(
    'test_%s_registrable_is_%s',
    (domain, registrable) => {
      expect(isRegistrableDomain(domain)).toBe(registrable)
    }
  )

  it.each(['co.uk', 'github.io', 'blogspot.com'])(
    'test_issuer_refuses_include_subdomains_on_public_suffix_%s',
    (domain) => {
      expect(issueUnlockToken(withSubdomains(domain), key, { isRegistrableDomain })).toEqual({
        ok: false,
        error: { code: 'invalid_claims' },
      })
    }
  )

  it('test_issuer_signs_include_subdomains_on_a_registrable_domain', () => {
    expect(issueUnlockToken(withSubdomains('example.co.uk'), key, { isRegistrableDomain }).ok).toBe(
      true
    )
  })

  it('test_issuer_without_a_public_suffix_check_refuses_include_subdomains', () => {
    expect(issueUnlockToken(withSubdomains('example.com'), key)).toEqual({
      ok: false,
      error: { code: 'invalid_input' },
    })
  })

  it('test_issuer_without_include_subdomains_needs_no_public_suffix_check', () => {
    expect(issueUnlockToken(claims, key).ok).toBe(true)
  })
})
