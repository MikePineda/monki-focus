// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { requestNonce } from '../../../../src/background/sync/RequestNonce'

describe('requestNonce', () => {
  it('nonce_matches_the_contract_pattern', () => {
    expect(requestNonce()).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(requestNonce((bytes) => bytes.fill(255))).toBe('_____________________w')
  })
})
