// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { privateKeyFromSeed } from '../src/ed25519_key.ts'
import { signV4Public } from '../src/sign_v4_public.ts'
import { verifyV4Public } from '../src/verify_v4_public.ts'

interface OfficialVector {
  'name': string
  'expect-fail': boolean
  'public-key'?: string
  'secret-key-seed'?: string
  'token': string
  'payload': string | null
  'footer': string
  'implicit-assertion': string
}

const vectorsUrl = new URL('../fixtures/paseto-official/v4.json', import.meta.url)
const suite = JSON.parse(readFileSync(vectorsUrl, 'utf8')) as { tests: OfficialVector[] }

// Only the v4.public cases apply: those that carry an Ed25519 public key.
const publicCases = suite.tests.filter((vector) => vector['public-key'] !== undefined)
const utf8 = new TextEncoder()

function hex(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'hex'))
}

describe('test_paseto_v4_official_vectors_pass', () => {
  it('vendors every v4.public case of the official suite (3 valid, 1 expected failure)', () => {
    expect(publicCases.map((vector) => vector.name)).toEqual(['4-S-1', '4-S-2', '4-S-3', '4-F-1'])
  })

  describe.each(publicCases)('$name', (vector) => {
    const publicKey = hex(vector['public-key'] ?? '')
    const footer = utf8.encode(vector.footer)
    const implicitAssertion = utf8.encode(vector['implicit-assertion'])

    it(
      vector['expect-fail'] ? 'is rejected by the verifier' : 'verifies to the expected payload',
      () => {
        const result = verifyV4Public(vector.token, publicKey, { footer, implicitAssertion })
        if (vector['expect-fail']) {
          expect(result.ok).toBe(false)
          return
        }
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(new TextDecoder().decode(result.value.message)).toBe(vector.payload)
          expect(new TextDecoder().decode(result.value.footer)).toBe(vector.footer)
        }
      }
    )

    if (!vector['expect-fail']) {
      it('signs to the exact expected token (Ed25519 is deterministic)', () => {
        const secretKey = privateKeyFromSeed(hex(vector['secret-key-seed'] ?? ''))
        expect(secretKey.ok).toBe(true)
        if (!secretKey.ok) return
        const token = signV4Public(
          secretKey.value,
          utf8.encode(vector.payload ?? ''),
          footer,
          implicitAssertion
        )
        expect(token).toBe(vector.token)
      })

      it('rejects the token when the implicit assertion differs', () => {
        const result = verifyV4Public(vector.token, publicKey, {
          footer,
          implicitAssertion: utf8.encode(`${vector['implicit-assertion']}x`),
        })
        expect(result).toEqual({ ok: false, error: { code: 'invalid_signature' } })
      })

      it('rejects the token when the expected footer differs', () => {
        const result = verifyV4Public(vector.token, publicKey, {
          footer: utf8.encode(`${vector.footer}x`),
          implicitAssertion,
        })
        expect(result).toEqual({ ok: false, error: { code: 'footer_mismatch' } })
      })
    }
  })
})
