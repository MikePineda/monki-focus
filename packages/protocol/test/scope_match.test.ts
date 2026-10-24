// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { scopeMatches, type ScopeTarget } from '../src/scope_match.ts'
import { isUnlockClaims, type UnlockScope } from '../src/unlock_claims.ts'
import { loadJson, loadTokenVectors } from './token_vector_loader.ts'

interface ScopeCase {
  id: string
  scope: UnlockScope
  target: ScopeTarget
  matches: boolean
}

const { cases } = loadJson('fixtures/scope-match/cases.json') as { cases: ScopeCase[] }
const validClaims = JSON.parse(
  loadTokenVectors('unlock-tokens').find((vector) => vector.id === 'valid_unlock_token')
    ?.construction.claimsJson ?? '{}'
) as Record<string, unknown>

describe('shared scope-match vectors', () => {
  it.each(cases.map((entry) => [entry.id, entry] as const))('test_%s', (_id, entry) => {
    expect(scopeMatches(entry.scope, entry.target)).toBe(entry.matches)
  })

  it('test_every_scope_in_the_vectors_is_a_valid_claim', () => {
    for (const entry of cases) {
      expect(isUnlockClaims({ ...validClaims, scope: entry.scope }), entry.id).toBe(true)
    }
  })
})
