// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Loads the shared token vectors the way every platform does: list the JSON
 * files of a fixtures directory, build the keyring from `verify.keyring`,
 * convert `verify.now` to epoch seconds and compare with `expect`.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TokenErrorCode } from '../src/token_error.ts'
import type { TokenPurpose } from '../src/token_purpose.ts'

export function loadJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(packageRoot, relativePath), 'utf8'))
}

export interface TokenVector {
  readonly id: string
  readonly kind: 'unlock-token' | 'policy-token' | 'time-token'
  readonly description: string
  readonly token: string
  readonly verify: {
    readonly purpose: TokenPurpose
    readonly keyring: readonly { readonly kid: string; readonly publicKeyHex: string }[]
    readonly issuer: string
    readonly device: string
    /** Unlock and policy vectors. */
    readonly now?: string
    /** Time vectors. */
    readonly nonce?: string
    readonly boot?: string
  }
  readonly expect:
    | { readonly result: 'valid'; readonly kid: string; readonly claims: Record<string, unknown> }
    | { readonly result: 'invalid'; readonly error: TokenErrorCode }
  readonly construction: {
    readonly signingKey: string
    readonly claimsJson: string
    readonly footer: string
    readonly implicitAssertion: string
    readonly paeHex: string
    readonly tampering?: string
  }
}

export const packageRoot = fileURLToPath(new URL('..', import.meta.url))

export function loadTokenVectors(
  dir: 'unlock-tokens' | 'policy-tokens' | 'time-tokens'
): TokenVector[] {
  const absolute = join(packageRoot, 'fixtures', dir)
  return readdirSync(absolute)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(absolute, name), 'utf8')) as TokenVector)
}

export function hexBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, 'hex'))
}

/** Seed of a TEST-ONLY key, read from the only place it lives: `fixtures/keys/`. */
export function testOnlySeed(name: string): string {
  const file = join(packageRoot, 'fixtures/keys/TEST-ONLY-test-key-not-real.ed25519.json')
  const document = JSON.parse(readFileSync(file, 'utf8')) as {
    keys: { name: string; seedHex: string }[]
  }
  const key = document.keys.find((entry) => entry.name === name)
  if (key === undefined) throw new Error(`no TEST-ONLY key named ${name}`)
  return key.seedHex
}
