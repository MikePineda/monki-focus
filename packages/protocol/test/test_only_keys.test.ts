// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { privateKeyFromSeed, rawPublicKey } from '../src/ed25519_key.ts'
import { deriveKeyId } from '../src/key_id.ts'
import { hexBytes, packageRoot } from './token_vector_loader.ts'

interface KeyFile {
  warning: string
  keys: { name: string; purpose: string; seedHex: string; publicKeyHex: string; kid: string }[]
}

const keyFile = JSON.parse(
  readFileSync(join(packageRoot, 'fixtures/keys/TEST-ONLY-test-key-not-real.ed25519.json'), 'utf8')
) as KeyFile

describe('TEST-ONLY signing keys', () => {
  it('test_test_keys_are_loudly_labelled', () => {
    expect(keyFile.warning).toMatch(/TEST-ONLY/)
    for (const key of keyFile.keys) {
      expect(key.name.startsWith('test-key-not-real-')).toBe(true)
    }
  })

  it.each(keyFile.keys.map((key) => [key.name, key] as const))(
    'test_%s_is_self_consistent',
    (name, key) => {
      const seed = createHash('sha256').update(`monki-focus/${name}`).digest('hex')
      expect(key.seedHex).toBe(seed)
      const secretKey = privateKeyFromSeed(hexBytes(key.seedHex))
      expect(secretKey.ok).toBe(true)
      if (!secretKey.ok) return
      expect(Buffer.from(rawPublicKey(secretKey.value)).toString('hex')).toBe(key.publicKeyHex)
      expect(deriveKeyId(hexBytes(key.publicKeyHex))).toBe(key.kid)
    }
  )
})
