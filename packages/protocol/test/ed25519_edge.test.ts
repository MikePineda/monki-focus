// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { publicKeyFromRaw } from '../src/ed25519_key.ts'
import {
  isAcceptablePointEncoding,
  isCanonicalScalar,
  verifyEd25519Strict,
} from '../src/ed25519_strict.ts'
import { hexBytes, loadJson } from './token_vector_loader.ts'

interface WycheproofSuite {
  testGroups: {
    publicKey: { pk: string }
    tests: { tcId: number; msg: string; sig: string; result: 'valid' | 'invalid' | 'acceptable' }[]
  }[]
}
interface SpeccheckCase {
  message: string
  pub_key: string
  signature: string
}
interface Verdicts {
  wycheproof: Record<'valid' | 'invalid' | 'acceptable', 'accept' | 'reject'>
  speccheck: { index: number; verdict: 'accept' | 'reject'; reasons: string[] }[]
}

const wycheproof = loadJson('fixtures/ed25519-edge/wycheproof-ed25519_test.json') as WycheproofSuite
const speccheck = loadJson('fixtures/ed25519-edge/speccheck-cases.json') as SpeccheckCase[]
const verdicts = loadJson('fixtures/ed25519-edge/verdicts.json') as Verdicts

/** What a platform does: import the key under the strict policy, then verify strictly. */
function strictVerdict(publicKeyHex: string, messageHex: string, signatureHex: string) {
  const key = publicKeyFromRaw(hexBytes(publicKeyHex))
  if (!key.ok) return 'reject'
  const accepted = verifyEd25519Strict(
    key.value.raw,
    key.value.key,
    hexBytes(messageHex),
    hexBytes(signatureHex)
  )
  return accepted ? 'accept' : 'reject'
}

const wycheproofCases = wycheproof.testGroups.flatMap((group) =>
  group.tests.map((test) => [test.tcId, group.publicKey.pk, test] as const)
)

describe('Ed25519 strict policy on Wycheproof EddsaVerify', () => {
  it('test_wycheproof_suite_is_complete', () => {
    expect(wycheproofCases).toHaveLength(210)
  })

  it.each(wycheproofCases)('test_wycheproof_tc_%i_matches_the_strict_verdict', (_id, pk, test) => {
    expect(strictVerdict(pk, test.msg, test.sig)).toBe(verdicts.wycheproof[test.result])
  })
})

describe('Ed25519 strict policy on "Taming the many EdDSAs"', () => {
  it('test_speccheck_suite_has_12_cases_with_a_verdict_each', () => {
    expect(speccheck).toHaveLength(12)
    expect(verdicts.speccheck.map((entry) => entry.index)).toEqual([...speccheck.keys()])
  })

  it.each(verdicts.speccheck)('test_speccheck_case_$index_is_rejected_for_$reasons', (entry) => {
    const vector = speccheck[entry.index]
    if (vector === undefined) throw new Error('missing case')
    expect(strictVerdict(vector.pub_key, vector.message, vector.signature)).toBe(entry.verdict)
    const reasons: string[] = []
    if (!isAcceptablePointEncoding(hexBytes(vector.pub_key))) reasons.push('A')
    if (!isAcceptablePointEncoding(hexBytes(vector.signature).subarray(0, 32))) reasons.push('R')
    if (!isCanonicalScalar(hexBytes(vector.signature))) reasons.push('S')
    expect(reasons).toEqual(entry.reasons)
  })
})

describe('strict point checks', () => {
  const smallOrder = [
    '0000000000000000000000000000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000080',
    '0100000000000000000000000000000000000000000000000000000000000000',
    'ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f',
    '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05',
    '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85',
    'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a',
    'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa',
  ]

  it.each(smallOrder)('test_small_order_key_%s_is_refused', (encoding) => {
    expect(publicKeyFromRaw(hexBytes(encoding))).toEqual({
      ok: false,
      error: { code: 'invalid_input' },
    })
  })

  it.each([
    ['y = p', 'edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f'],
    ['y = p + 1', 'eeffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f'],
    ['y = 2^255 - 1', 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f'],
    [
      'negative zero (identity with sign bit)',
      '0100000000000000000000000000000000000000000000000000000000000080',
    ],
  ])('test_non_canonical_key_%s_is_refused', (_label, encoding) => {
    expect(publicKeyFromRaw(hexBytes(encoding)).ok).toBe(false)
  })

  it('test_the_base_point_is_acceptable', () => {
    expect(
      isAcceptablePointEncoding(
        hexBytes('5866666666666666666666666666666666666666666666666666666666666666')
      )
    ).toBe(true)
  })
})
