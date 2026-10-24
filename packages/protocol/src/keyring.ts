// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The pinned public keys a client trusts for one purpose. A keyring holds at
 * most two keys (the current one and, during a rotation, its successor or
 * predecessor), never mixes purposes, and refuses any entry whose kid is not
 * derived from its key. Only keyrings built here are accepted by the
 * verifiers.
 */
import type { KeyObject } from 'node:crypto'
import { publicKeyFromRaw } from './ed25519_key.ts'
import { deriveKeyId } from './key_id.ts'
import { fail, ok, type Result } from './token_error.ts'
import type { TokenPurpose } from './token_purpose.ts'

export const MAX_ACTIVE_KEYS = 2

export interface PinnedKey {
  readonly kid: string
  /** Raw 32-byte Ed25519 public key. */
  readonly publicKey: Uint8Array
}

export interface Keyring {
  readonly purpose: TokenPurpose
  readonly kids: readonly string[]
}

const keysByKeyring = new WeakMap<Keyring, ReadonlyMap<string, KeyObject>>()

export function createKeyring(
  purpose: TokenPurpose,
  pinned: readonly PinnedKey[]
): Result<Keyring> {
  if (pinned.length === 0 || pinned.length > MAX_ACTIVE_KEYS) {
    return fail('invalid_input')
  }
  const keys = new Map<string, KeyObject>()
  for (const entry of pinned) {
    const key = publicKeyFromRaw(entry.publicKey)
    if (!key.ok || keys.has(entry.kid) || deriveKeyId(entry.publicKey) !== entry.kid) {
      return fail('invalid_input')
    }
    keys.set(entry.kid, key.value)
  }
  const keyring: Keyring = Object.freeze({ purpose, kids: Object.freeze([...keys.keys()]) })
  keysByKeyring.set(keyring, keys)
  return ok(keyring)
}

/**
 * The key for `kid`, `unknown_kid` when the keyring does not hold it, or
 * `invalid_input` when `keyring` was not built by `createKeyring`.
 */
export function lookupKey(keyring: Keyring, kid: string): Result<KeyObject> {
  const keys = keysByKeyring.get(keyring)
  if (keys === undefined) {
    return fail('invalid_input')
  }
  const key = keys.get(kid)
  return key === undefined ? fail('unknown_kid') : ok(key)
}

export function isKeyring(value: unknown): value is Keyring {
  return typeof value === 'object' && value !== null && keysByKeyring.has(value as Keyring)
}
