// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  createKeyring,
  privateKeyFromSeed,
  registrableDomainCheck,
  type IsRegistrableDomain,
  type KeyPurpose,
  type Keyring,
} from '@monki-focus/protocol'
import { signingKeyFromSecret, type SigningKeyMaterial } from '#domain/keys/signing_key_material'

/**
 * The TEST-ONLY keys and vectors of `@monki-focus/protocol`. Test keys live
 * only under packages/protocol/fixtures/ (`test-key-not-real-*`); the server
 * suite reads them from there and never carries key material of its own.
 */
function protocolFixture<T>(path: string): T {
  const file = fileURLToPath(import.meta.resolve(`@monki-focus/protocol/fixtures/${path}`))
  return JSON.parse(readFileSync(file, 'utf8')) as T
}

interface KeyFile {
  keys: { name: string; purpose: KeyPurpose; seedHex: string; publicKeyHex: string; kid: string }[]
}

export type TestOnlyKeyName =
  | 'test-key-not-real-unlock-a'
  | 'test-key-not-real-unlock-b'
  | 'test-key-not-real-policy-a'
  | 'test-key-not-real-policy-b'
  | 'test-key-not-real-untrusted'

export function testOnlyKey(name: TestOnlyKeyName, purpose?: KeyPurpose): SigningKeyMaterial {
  const entry = protocolFixture<KeyFile>('keys/TEST-ONLY-test-key-not-real.ed25519.json').keys.find(
    (key) => key.name === name
  )
  if (entry === undefined) throw new Error(`no TEST-ONLY key named ${name}`)
  const secret = privateKeyFromSeed(Uint8Array.from(Buffer.from(entry.seedHex, 'hex')))
  if (!secret.ok) throw new Error(`bad TEST-ONLY seed ${name}`)
  const material = signingKeyFromSecret(purpose ?? entry.purpose, secret.value)
  if (!material.ok) throw new Error(`TEST-ONLY key ${name} refused: ${material.reason}`)
  return material.value
}

/** A client keyring pinning the given keys, as a device would after enrolment. */
export function pinnedKeyring(purpose: KeyPurpose, ...keys: SigningKeyMaterial[]): Keyring {
  const keyring = createKeyring(
    purpose,
    keys.map((key) => ({ kid: key.kid, publicKey: key.publicKey }))
  )
  if (!keyring.ok) throw new Error(`keyring refused: ${keyring.error.code}`)
  return keyring.value
}

export interface ProtocolTokenVector {
  id: string
  token: string
  verify: { issuer: string; device: string; now?: string; nonce?: string; boot?: string }
  construction: { claimsJson: string; signingKey: string }
}

export function protocolVector(
  dir: 'unlock-tokens' | 'policy-tokens' | 'time-tokens' | 'key-endorsements',
  id: string
): ProtocolTokenVector {
  return protocolFixture<ProtocolTokenVector>(`${dir}/${id}.json`)
}

/** The TEST-ONLY public-suffix excerpt (not the list: production uses tldts). */
export function testOnlyPublicSuffixCheck(): IsRegistrableDomain {
  return registrableDomainCheck(
    protocolFixture<{ suffixes: string[] }>('public-suffix/test-public-suffixes.json').suffixes
  )
}
